import json
from contextlib import redirect_stderr
from io import StringIO
import unittest
from unittest.mock import patch

from rag_demo.config import Settings
from rag_demo.evaluate import (aggregate, document_bytes, load_dataset, score_case,
                               run_evaluation, LexicalMockProvider, RecordingRepository, RecordingProvider)
from rag_demo.evaluate import main
from rag_demo.pipeline import extract_pages, chunk_pages, grounded_answer, ProviderUnavailable
from rag_demo.tests.fakes import MemoryRepository


class EvaluationTests(unittest.TestCase):
    def test_live_cli_requires_explicit_provider_consent_before_credentials_or_database(self):
        with patch("sys.argv", ["evaluate", "--live"]), patch("rag_demo.evaluate.getpass") as prompt, \
                patch("rag_demo.repository.PostgresRepository") as repository, redirect_stderr(StringIO()):
            with self.assertRaises(SystemExit) as failure:
                main()
            self.assertEqual(failure.exception.code, 2)
            prompt.assert_not_called()
            repository.assert_not_called()

    def test_empty_live_credentials_fail_closed_before_database_creation(self):
        with patch("sys.argv", ["evaluate", "--live", "--allow-provider-requests"]), \
                patch("rag_demo.evaluate.getpass", return_value=""), \
                patch("rag_demo.repository.PostgresRepository") as repository:
            with self.assertRaises(SystemExit):
                main()
            repository.assert_not_called()

    def test_labels_cover_thirty_questions_negatives_multi_section_and_distractors(self):
        dataset, sections = load_dataset()
        self.assertEqual(len(dataset["questions"]), 30)
        self.assertEqual(len(dataset["documents"]), 6)
        self.assertEqual(len(sections), 18)
        self.assertEqual(sum(not q["supports"] for q in dataset["questions"]), 6)
        self.assertEqual(sum(len(q["supports"]) > 1 for q in dataset["questions"]), 6)
        self.assertTrue(any("auto" in q["question"] for q in dataset["questions"]))
        self.assertTrue(any("business" in q["question"] for q in dataset["questions"]))

    def test_pdf_and_txt_label_text_survives_real_extraction_and_chunking(self):
        dataset, _ = load_dataset()
        settings = Settings()
        for document in dataset["documents"]:
            mime, content = document_bytes(document)
            chunks = chunk_pages(extract_pages(document["filename"], mime, content, settings), settings)
            for section in document["sections"]:
                self.assertTrue(any(section["text"] in c.text for c in chunks))
            if mime == "application/pdf":
                self.assertEqual([c.page for c in chunks], [1, 2, 3])

    def test_metrics_are_passage_based_not_just_document_hit(self):
        sections = {"a": {"filename": "x.txt", "text": "Synthetic supported sentence."},
                    "b": {"filename": "x.txt", "text": "Synthetic second section."}}
        item = {"supports": ["a", "b"]}
        irrelevant = {"filename": "x.txt", "document_id": "synthetic", "page": 1,
                      "text": "Synthetic irrelevant sentence."}
        supported = irrelevant | {"text": sections["a"]["text"]}
        response = {"abstained": False, "citations": [supported | {"passage": supported["text"], "quote": supported["text"]}]}
        case = score_case(item, [irrelevant, supported], response, sections, 10)
        self.assertEqual(case["hit1"], 0)
        self.assertEqual(case["recall5"], .5)
        self.assertEqual(case["evidence_coverage"], .5)
        self.assertEqual(case["valid_citations"], 1)
        self.assertEqual(case["relevant_citations"], 1)

    def test_wrong_quote_and_irrelevant_literal_citation_are_distinguished(self):
        sections = {"a": {"filename": "good.txt", "text": "Synthetic relevant evidence."}}
        passage = {"document_id": "other", "filename": "other.txt", "page": 1, "text": "Synthetic irrelevant evidence."}
        response = {"citations": [passage | {"passage": passage["text"], "quote": passage["text"]}], "abstained": False}
        case = score_case({"supports": ["a"]}, [passage], response, sections, 1)
        self.assertEqual(case["valid_citations"], 1)
        self.assertEqual(case["relevant_citations"], 0)
        response["citations"][0]["quote"] = "invented evidence"
        self.assertEqual(score_case({"supports": ["a"]}, [passage], response, sections, 1)["valid_citations"], 0)

    def test_errors_remain_in_denominators_and_are_not_abstentions(self):
        sections = {"a": {"filename": "x.txt", "text": "Synthetic evidence."}}
        good = {"document_id": "doc", "filename": "x.txt", "page": 1, "text": sections["a"]["text"]}
        cases = [score_case({"supports": ["a"]}, [good], {"abstained": True}, sections, 10),
                 score_case({"supports": ["a"]}, [], {}, sections, 20, failed=True),
                 score_case({"supports": []}, [], {"abstained": True}, sections, 30),
                 score_case({"supports": []}, [], {"abstained": True}, sections, 40, failed=True)]
        report = aggregate(cases)
        self.assertEqual(report["hit_at_1"], .5)
        self.assertEqual(report["recall_at_5"], .5)
        self.assertEqual(report["negative_abstention_rate"], .5)
        self.assertEqual(report["answerable_abstention_rate"], .5)
        self.assertEqual(report["request_errors"], 2)
        self.assertIsNone(report["citation_gold_source_precision"])
        self.assertEqual(report["latency_ms_mean"], 25)
        self.assertEqual(report["latency_ms_p95"], 40)

    def test_invalid_quotes_contribute_zero_evidence_coverage(self):
        sections = {"gold": {"filename": "policy.txt", "text": "Synthetic insurance window is thirty days."}}
        passage = {"document_id": "synthetic", "filename": "policy.txt", "page": 1,
                   "text": sections["gold"]["text"]}
        for quote in ["Invented supporting quotation.", "short", None]:
            with self.subTest(quote=quote):
                response = {"abstained": False, "citations": [passage | {"passage": passage["text"], "quote": quote}]}
                case = score_case({"supports": ["gold"]}, [passage], response, sections, 1)
                self.assertEqual(case["recall5"], 1)
                self.assertEqual(case["citations"], 1)
                self.assertEqual(case["valid_citations"], 0)
                self.assertEqual(case["relevant_citations"], 0)
                self.assertEqual(case["evidence_coverage"], 0)

    def test_unmatched_citation_metadata_contributes_zero_coverage(self):
        sections = {"gold": {"filename": "policy.txt", "text": "Synthetic insurance window is thirty days."}}
        passage = {"document_id": "synthetic", "filename": "policy.txt", "page": 1,
                   "text": sections["gold"]["text"]}
        for mismatch in [{"document_id": "other"}, {"page": 2}]:
            with self.subTest(mismatch=mismatch):
                citation = passage | {"passage": passage["text"], "quote": passage["text"]} | mismatch
                case = score_case({"supports": ["gold"]}, [passage], {"citations": [citation]}, sections, 1)
                self.assertEqual(case["valid_citations"], 0)
                self.assertEqual(case["evidence_coverage"], 0)

    def test_mixed_citations_cover_only_integrity_valid_gold_sections(self):
        sections = {"a": {"filename": "policy.txt", "text": "Synthetic claims require receipts."},
                    "b": {"filename": "policy.txt", "text": "Synthetic claims require a signed form."}}
        passages = [{"document_id": "synthetic", "filename": "policy.txt", "page": index,
                     "text": section["text"]} for index, section in enumerate(sections.values(), 1)]
        citations = [p | {"passage": p["text"], "quote": p["text"]} for p in passages]
        citations[1]["quote"] = "Invented supporting quotation."
        case = score_case({"supports": ["a", "b"]}, passages, {"citations": citations}, sections, 1)
        self.assertEqual(case["recall5"], 1)
        self.assertEqual(case["citations"], 2)
        self.assertEqual(case["valid_citations"], 1)
        self.assertEqual(case["relevant_citations"], 1)
        self.assertEqual(case["evidence_coverage"], .5)

    def test_irrelevant_same_document_quote_receives_no_relevance_credit(self):
        sections = {"gold": {"filename": "policy.txt", "text": "Synthetic insurance window is thirty days."}}
        passage = {"document_id": "synthetic", "filename": "policy.txt", "page": 2,
                   "text": "Synthetic insurance claims require a receipt."}
        response = {"abstained": False, "citations": [passage | {"passage": passage["text"], "quote": passage["text"]}]}
        case = score_case({"supports": ["gold"]}, [passage], response, sections, 1)
        self.assertEqual(case["valid_citations"], 1)
        self.assertEqual(case["relevant_citations"], 0)
        self.assertEqual(case["evidence_coverage"], 0)
        report = aggregate([case])
        self.assertEqual(report["citation_quote_integrity"], 1)
        self.assertEqual(report["citation_gold_source_precision"], 0)

    def test_unsupported_question_mock_citations_remain_evaluation_failures(self):
        passage = {"document_id": "synthetic", "filename": "policy.txt", "page": 1,
                   "text": "Synthetic insurance window is thirty days."}
        response = grounded_answer("What is the synthetic insurance premium?", [passage], LexicalMockProvider(128))
        case = score_case({"supports": []}, [passage], response, {}, 1)
        self.assertFalse(case["abstained"])
        self.assertEqual(case["valid_citations"], 1)
        self.assertEqual(case["relevant_citations"], 0)
        self.assertIsNone(case["evidence_coverage"])
        report = aggregate([case])
        self.assertEqual(report["negative_abstention_rate"], 0)
        self.assertEqual(report["citation_gold_source_precision"], 0)
        self.assertEqual(report["citation_quote_integrity"], 1)

    def test_observers_delegate_real_changed_methods_and_ignore_failed_calls(self):
        settings = Settings(dimensions=128)
        repository = RecordingRepository(MemoryRepository(settings))
        self.assertEqual(repository.search("owner", [1]*128, None, 5, .65), [])
        self.assertEqual(repository.searches, 1)
        provider = RecordingProvider(LexicalMockProvider(128))
        self.assertEqual(len(provider.embed("insurance")), 128)
        self.assertEqual(provider.embeddings, 1)
        with patch.object(provider.delegate, "embed", side_effect=ProviderUnavailable()):
            with self.assertRaises(ProviderUnavailable):
                provider.embed("insurance")
        self.assertEqual(provider.embeddings, 1)

    def test_full_mock_evaluation_uses_actual_auth_upload_retrieval_delete_routes(self):
        settings = Settings(dimensions=128)
        repository = MemoryRepository(settings)
        # Existing unrelated test account and document must survive the run.
        owner = repository.create_account("existing", "synthetic-hash")
        repository.documents["existing-doc"] = {"id": "existing-doc", "owner": owner, "filename": "existing.txt", "chunks": 0}
        report = run_evaluation(settings, repository, LexicalMockProvider(128), "mock")
        self.assertEqual(report["metrics"]["questions"], 30)
        self.assertEqual(report["metrics"]["request_errors"], 0)
        self.assertEqual(report["chunks"], 12)
        self.assertTrue(all(report["security_checks"].values()))
        self.assertEqual(report["completed_embedding_calls"], 43)
        self.assertGreater(report["completed_generation_calls"], 0)
        self.assertFalse(report["real_embeddings_verified"])
        self.assertFalse(report["postgres_storage_and_search_verified"])
        self.assertFalse(report["real_generation_verified"])
        self.assertIn("existing-doc", repository.documents)
        serialized = json.dumps(report)
        for private_field in ["Bearer", "password", "existing-doc", "original receipt", "question\""]:
            self.assertNotIn(private_field, serialized)


if __name__ == "__main__":
    unittest.main()
