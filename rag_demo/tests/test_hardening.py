"""Small synthetic inputs only: parser bounds and operational evaluation failures."""
from contextlib import redirect_stdout
from dataclasses import replace
from io import BytesIO, StringIO
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch, MagicMock

import httpx
from fastapi.testclient import TestClient

from rag_demo.config import Settings
from rag_demo.app import create_app
from rag_demo.evaluate import (EvaluationFailed, LexicalMockProvider, REQUIRED_CHECKS,
                               evaluation_succeeded, load_dataset, main, print_report, run_evaluation)
from rag_demo.pipeline import extract_pages, InvalidDocument
from rag_demo.repository import Conflict
from rag_demo.service import RagService
from rag_demo.tests.fakes import MemoryRepository, SyntheticProvider
from rag_demo.tests.test_rag import synthetic_pdf


SETTINGS = Settings(dimensions=128)


def stream_pdf(streams, compressed=False):
    from pypdf import PdfWriter
    from pypdf.generic import NameObject, DecodedStreamObject, DictionaryObject
    writer = PdfWriter()
    for data in streams:
        page = writer.add_blank_page(300, 300)
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
                                 NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({
            NameObject("/F1"): writer._add_object(font)})})
        stream = DecodedStreamObject(); stream.set_data(data)
        page[NameObject("/Contents")] = writer._add_object(stream.flate_encode() if compressed else stream)
    output = BytesIO(); writer.write(output)
    return output.getvalue()


class ParserBoundsTests(unittest.TestCase):
    def test_pdf_page_and_extracted_character_limits(self):
        for settings in [replace(SETTINGS, max_pdf_pages=1), replace(SETTINGS, max_chars=10)]:
            with self.subTest(limit=settings), self.assertRaises(InvalidDocument):
                extract_pages("synthetic.pdf", "application/pdf", synthetic_pdf(), settings)

    def test_compressed_stream_rejected_with_small_decoder_limit(self):
        content = stream_pdf([b"BT /F1 12 Tf 20 200 Td (Synthetic policy.) Tj ET\n" + b"% synthetic filler\n" * 200], compressed=True)
        self.assertLess(len(content), 2048)
        self.assertIn("Synthetic policy.", extract_pages("synthetic.pdf", "application/pdf", content, SETTINGS)[0])
        with self.assertRaises(InvalidDocument):
            extract_pages("synthetic.pdf", "application/pdf", content,
                          replace(SETTINGS, max_pdf_stream_bytes=128))

    def test_aggregate_decoded_stream_limit(self):
        content = stream_pdf([b"BT /F1 12 Tf 20 200 Td (Synthetic policy.) Tj ET\n%" + b" " * 150 + b"\n"] * 3)
        self.assertEqual(len(extract_pages("synthetic.pdf", "application/pdf", content, SETTINGS)), 3)
        with self.assertRaises(InvalidDocument):
            extract_pages("synthetic.pdf", "application/pdf", content,
                          replace(SETTINGS, max_pdf_stream_bytes=512, max_pdf_total_stream_bytes=500))

    def test_incomplete_dct_inline_image_is_controlled(self):
        # Under 1 KiB; do not use a resource-consuming exploit fixture.
        content = stream_pdf([b"q BI /W 1 /H 1 /CS /RGB /BPC 8 /F /DCTDecode ID \xff\xd8synthetic-truncated"])
        with self.assertRaises(InvalidDocument) as failure:
            extract_pages("synthetic.pdf", "application/pdf", content, SETTINGS)
        self.assertNotIn("synthetic-truncated", str(failure.exception))

    def test_real_timeout_kills_and_reaps_worker_and_releases_slot(self):
        original = subprocess.Popen
        children = []
        def launch(*args, **kwargs):
            child = original(*args, **kwargs); children.append(child)
            return child
        with patch("rag_demo.pipeline.subprocess.Popen", side_effect=launch):
            with self.assertRaisesRegex(InvalidDocument, "time limit"):
                extract_pages("synthetic.pdf", "application/pdf", synthetic_pdf(),
                              replace(SETTINGS, pdf_timeout_seconds=0.000001))
        self.assertEqual(len(children), 1)
        self.assertIsNotNone(children[0].poll())
        self.assertEqual(len(extract_pages("synthetic.pdf", "application/pdf", synthetic_pdf(), SETTINGS)), 2)

    def test_worker_receives_no_credentials_and_errors_are_sanitized(self):
        with patch.dict("os.environ", {"RAG_GEMINI_API_KEY": "synthetic-secret"}), \
                patch("rag_demo.pipeline.subprocess.run", side_effect=OSError("synthetic-private-path")) as run:
            with self.assertRaises(InvalidDocument) as failure:
                extract_pages("synthetic.pdf", "application/pdf", synthetic_pdf(), SETTINGS)
        self.assertNotIn("synthetic-private", str(failure.exception))
        self.assertNotIn("RAG_GEMINI_API_KEY", run.call_args.kwargs["env"])
        self.assertNotIn("synthetic-secret", str(run.call_args))

    def test_unavailable_memory_limits_fail_closed(self):
        from rag_demo import pdf_worker
        limits = {"pdf_memory_bytes": SETTINGS.pdf_memory_bytes, "pdf_timeout_seconds": 5}
        with patch("sys.argv", ["pdf_worker", "unused", json.dumps(limits)]), \
                patch.object(pdf_worker, "resource_limits", side_effect=RuntimeError("synthetic-private")), \
                patch.object(pdf_worker, "parse") as parse:
            self.assertEqual(pdf_worker.main(), 1)
            parse.assert_not_called()

    def test_txt_character_and_early_byte_limits_include_multibyte_text(self):
        settings = replace(SETTINGS, max_chars=4)
        self.assertEqual(extract_pages("synthetic.txt", "text/plain", ("😀" * 4).encode(), settings), ["😀" * 4])
        for content in [b"x" * 5, b"x" * 20, ("😀" * 5).encode()]:
            with self.subTest(size=len(content)), self.assertRaises(InvalidDocument):
                extract_pages("synthetic.txt", "text/plain", content, settings)

    def test_limits_cannot_be_disabled_or_increased_past_ceilings(self):
        for changes in [{"max_chars": 0}, {"pdf_timeout_seconds": 0}, {"pdf_timeout_seconds": float("nan")},
                        {"max_pdf_pages": 41}, {"pdf_memory_bytes": 257 * 1024 * 1024},
                        {"upload_seconds": 61}, {"max_pdf_stream_bytes": True}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                replace(SETTINGS, **changes)


class UploadBoundsTests(unittest.TestCase):
    def setUp(self):
        self.repo = MemoryRepository(SETTINGS)
        self.provider = SyntheticProvider()
        self.service = RagService(self.repo, self.provider, SETTINGS)

    def upload(self):
        return self.service.upload("synthetic-owner", "synthetic.txt", "text/plain", b"Synthetic insurance policy.")

    def test_expired_indexing_budget_does_not_insert_partial_document(self):
        with patch("rag_demo.service.time.monotonic", side_effect=[0, 0, 61]):
            with self.assertRaisesRegex(InvalidDocument, "time budget"):
                self.upload()
        self.assertEqual(self.repo.documents, {})
        self.upload()  # Slot is released after failure.

    def test_one_upload_at_a_time_without_waiting_or_provider_duplication(self):
        original = self.provider.embed
        def embed(text, query=False):
            with self.assertRaises(Conflict):
                self.upload()
            return original(text, query)
        with patch.object(self.provider, "embed", side_effect=embed) as provider:
            self.upload()
            self.assertEqual(provider.call_count, 1)

    def test_quota_rejected_before_parser_or_provider_work(self):
        with patch.object(self.repo, "list_documents", return_value=[{}] * 20), \
                patch("rag_demo.service.extract_pages") as parser, patch.object(self.provider, "embed") as provider:
            with self.assertRaises(Conflict):
                self.upload()
            parser.assert_not_called(); provider.assert_not_called()

    def test_parser_rejection_through_authenticated_route_is_sanitized_and_atomic(self):
        settings = replace(SETTINGS, max_chars=10)
        repo, provider = MemoryRepository(settings), SyntheticProvider()
        client = TestClient(create_app(settings, repo, provider), base_url="http://127.0.0.1:8001")
        credentials = {"username": "synthetic", "password": "synthetic-only-password"}
        self.assertEqual(client.post("/rag/register", json=credentials).status_code, 201)
        token = client.post("/rag/login", json=credentials).json()["token"]
        with patch.object(provider, "embed") as embed:
            response = client.post("/rag/documents?filename=synthetic.pdf", content=synthetic_pdf(),
                headers={"Authorization": "Bearer " + token, "Content-Type": "application/pdf", "X-Synthetic-Document": "true"})
            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json(), {"detail": "PDF rejected: invalid, unsupported or exceeds extraction limits"})
            embed.assert_not_called()
        self.assertEqual(repo.documents, {})


class EvaluatorReliabilityTests(unittest.TestCase):
    def run_mock(self, provider=None):
        return run_evaluation(SETTINGS, MemoryRepository(SETTINGS), provider or LexicalMockProvider(128), "mock")

    def test_question_http_json_schema_and_transport_errors_fail_run(self):
        target = load_dataset()[0]["questions"][-1]["question"]
        original = TestClient.post
        for kind in ["http", "json", "schema", "transport"]:
            def post(client, url, **kwargs):
                if url == "/rag/ask" and kwargs.get("json", {}).get("question") == target:
                    if kind == "transport":
                        raise RuntimeError("synthetic-private")
                    if kind == "http":
                        return httpx.Response(503, json={"detail": "synthetic-private"})
                    if kind == "json":
                        return httpx.Response(200, content=b"invalid-json")
                    return httpx.Response(200, json={"abstained": True})
                return original(client, url, **kwargs)
            with self.subTest(kind=kind), patch.object(TestClient, "post", post):
                report = self.run_mock()
                self.assertEqual(report["metrics"]["questions"], 30)
                self.assertEqual(report["metrics"]["request_errors"], 1)
                self.assertFalse(report["success"])
                self.assertEqual(report["metrics"]["negative_abstention_rate"], 0)
                with redirect_stdout(StringIO()) as output:
                    self.assertEqual(print_report(report), 1)
                self.assertNotIn("synthetic-private", output.getvalue())

    def test_expected_unsupported_abstention_is_not_an_error(self):
        target = load_dataset()[0]["questions"][-1]["question"]
        provider = LexicalMockProvider(128)
        original = provider.answer
        def answer(question, passages):
            return {"insufficient_evidence": True} if question == target else original(question, passages)
        with patch.object(provider, "answer", side_effect=answer):
            report = self.run_mock(provider)
        self.assertTrue(report["success"])
        self.assertEqual(report["metrics"]["request_errors"], 0)
        self.assertEqual(report["metrics"]["negative_abstention_rate"], 1 / 6)

    def test_failed_isolation_check_fails_run(self):
        repository = MemoryRepository(SETTINGS)
        original = repository.delete_document
        calls = 0
        def delete(owner, document):
            nonlocal calls
            calls += 1
            return True if calls == 1 else original(owner, document)
        with patch.object(repository, "delete_document", side_effect=delete):
            report = run_evaluation(SETTINGS, repository, LexicalMockProvider(128), "mock")
        self.assertFalse(report["security_checks"]["other_account_delete_denied"])
        self.assertFalse(evaluation_succeeded(report))

    def test_mandatory_upload_failure_raises_without_exposing_payload(self):
        original = TestClient.post
        def post(client, url, **kwargs):
            if url == "/rag/documents":
                return httpx.Response(503, json={"detail": "synthetic-private"})
            return original(client, url, **kwargs)
        with patch.object(TestClient, "post", post), self.assertRaises(EvaluationFailed) as failure:
            self.run_mock()
        self.assertNotIn("synthetic-private", str(failure.exception))

    def test_logout_failure_is_mandatory(self):
        original = TestClient.post
        def post(client, url, **kwargs):
            return httpx.Response(503) if url == "/rag/logout" else original(client, url, **kwargs)
        with patch.object(TestClient, "post", post):
            report = self.run_mock()
        self.assertFalse(report["security_checks"]["logout_1"])
        self.assertFalse(report["success"])

    def test_missing_check_and_no_questions_cannot_report_success(self):
        report = {"metrics": {"questions": 30, "request_errors": 0},
                  "security_checks": {key: True for key in REQUIRED_CHECKS}}
        self.assertTrue(evaluation_succeeded(report))
        report["security_checks"].pop("owner_delete")
        self.assertFalse(evaluation_succeeded(report))
        report["security_checks"]["owner_delete"] = True
        report["metrics"]["questions"] = 0
        self.assertFalse(evaluation_succeeded(report))

    def test_live_cli_failed_report_returns_nonzero_with_no_live_calls(self):
        report = {"metrics": {"questions": 30, "request_errors": 1}, "security_checks": {}}
        with patch("sys.argv", ["evaluate", "--live", "--allow-provider-requests"]), \
                patch("rag_demo.evaluate.getpass", return_value="synthetic-only"), \
                patch("rag_demo.repository.PostgresRepository"), \
                patch("rag_demo.pipeline.GeminiProvider"), \
                patch("rag_demo.evaluate.run_evaluation", return_value=report), redirect_stdout(StringIO()):
            self.assertEqual(main(), 1)

    def test_live_cli_mandatory_failure_has_sanitized_nonzero_exit(self):
        with patch("sys.argv", ["evaluate", "--live", "--allow-provider-requests"]), \
                patch("rag_demo.evaluate.getpass", return_value="synthetic-only"), \
                patch("rag_demo.repository.PostgresRepository"), patch("rag_demo.pipeline.GeminiProvider"), \
                patch("rag_demo.evaluate.run_evaluation", side_effect=RuntimeError("synthetic-private")):
            with self.assertRaises(SystemExit) as failure:
                main()
        self.assertNotEqual(failure.exception.code, 0)
        self.assertNotIn("synthetic-private", str(failure.exception))

    def test_second_account_failure_still_revokes_first_session(self):
        original = TestClient.post
        logins = 0
        repository = MemoryRepository(SETTINGS)
        def post(client, url, **kwargs):
            nonlocal logins
            if url == "/rag/login":
                logins += 1
                if logins == 2:
                    return httpx.Response(503)
            return original(client, url, **kwargs)
        with patch.object(TestClient, "post", post), self.assertRaises(EvaluationFailed):
            run_evaluation(SETTINGS, repository, LexicalMockProvider(128), "mock")
        self.assertEqual(repository.sessions, {})

    def test_mock_cli_exit_codes_and_sanitized_mandatory_failure(self):
        root = Path(__file__).resolve().parents[2]
        import pypdf
        dependencies = Path(pypdf.__file__).resolve().parents[1]
        for kind, expected in [("success", 0), ("question", 1), ("isolation", 1), ("mandatory", 1)]:
            # Execute the real CLI entry point in a fresh interpreter with test
            # doubles, preserving the runner's network and .env guards.
            script = f"""
import sys, runpy
sys.path[:0] = {str(dependencies)!r}, {str(root)!r}
from unittest.mock import patch
from rag_demo.evaluate import REQUIRED_CHECKS
report = {{'metrics': {{'questions': 30, 'request_errors': {int(kind == 'question')}}},
          'security_checks': {{key: True for key in REQUIRED_CHECKS}}}}
if {kind!r} == 'isolation': report['security_checks']['owner_delete'] = False
sys.argv = ['run_tests.py', '--evaluate-mock', '--dependencies', {str(dependencies)!r}]
with patch('rag_demo.evaluate.run_mock', {'side_effect=RuntimeError("synthetic-private")' if kind == 'mandatory' else 'return_value=report'}):
    runpy.run_path({str(root / 'rag_demo' / 'run_tests.py')!r}, run_name='__main__')
"""
            with self.subTest(kind=kind):
                result = subprocess.run([sys.executable, "-I", "-B", "-c", script], capture_output=True, timeout=15)
                self.assertEqual(result.returncode, expected)
                self.assertNotIn(b"synthetic-private", result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
