"""Aggregate-only evaluation through the real authenticated ASGI routes.

Live mode is explicit, loopback-only and never initializes schema. Mock mode uses
test doubles, NOT Gemini/Postgres, and is run under run_tests.py's network guard.
Neither mode prints credentials, responses, passages, or account/document IDs.
"""
from getpass import getpass
import hashlib
from io import BytesIO
import json
from pathlib import Path
import re
import secrets
import statistics
import textwrap
import time
from urllib.parse import quote

from .config import Settings, from_environment, validate_local_database


DATASET = Path(__file__).parent / "evaluation" / "corpus.json"


def normalize(text):
    return " ".join(text.split())


def load_dataset():
    dataset = json.loads(DATASET.read_text(encoding="utf-8"))
    assert dataset["synthetic_only"] is True
    sections = {}
    names = set()
    for document in dataset["documents"]:
        filename = document["filename"]
        assert re.fullmatch(r"[a-z_]+\.(pdf|txt)", filename) and filename not in names
        names.add(filename)
        for section in document["sections"]:
            assert section["id"] not in sections and section["text"].startswith("Synthetic ")
            sections[section["id"]] = {"filename": filename, "text": normalize(section["text"])}
    ids = set()
    for item in dataset["questions"]:
        assert item["id"] not in ids and 0 < len(item["question"]) <= 1000
        ids.add(item["id"])
        assert len(set(item["supports"])) == len(item["supports"])
        assert set(item["supports"]) <= sections.keys()
    return dataset, sections


def document_bytes(document):
    """Only the shipped synthetic corpus is used; no arbitrary file argument."""
    if document["filename"].endswith(".txt"):
        return "text/plain", "\n\n".join(s["text"] for s in document["sections"]).encode()
    from pypdf import PdfWriter
    from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
    writer = PdfWriter()
    for section in document["sections"]:
        page = writer.add_blank_page(650, 780)
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"),
                                NameObject("/Subtype"): NameObject("/Type1"),
                                NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({
            NameObject("/F1"): writer._add_object(font)})})
        lines = []
        for line in textwrap.wrap(section["text"], 85):
            escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            lines.append(f"({escaped}) Tj T*")
        stream = DecodedStreamObject()
        stream.set_data(("BT /F1 11 Tf 14 TL 30 740 Td " + " ".join(lines) + " ET").encode("ascii"))
        page[NameObject("/Contents")] = writer._add_object(stream)
    output = BytesIO()
    writer.write(output)
    return "application/pdf", output.getvalue()


class LexicalMockProvider:
    """Label-blind topic/hashed-word vectors and extractive echo, not an LLM.

    This intentionally cannot determine semantic answerability. Same-topic
    negatives expose that limitation instead of using evaluation labels as an
    oracle to manufacture perfect abstention scores.
    """
    features = ("insurance", "savings", "travel", "harbor", "meadow", "cedar",
                "auto", "personal", "business", "employee", "guest")

    def __init__(self, dimensions):
        self.dimensions = dimensions

    def embed(self, text, query=False):
        tokens = set(re.findall(r"[a-z]+", text.lower()))
        vector = [0.0] * self.dimensions
        for index, term in enumerate(self.features):
            if term in tokens:
                vector[index] = 3.0 if index < 3 else 2.0
        for term in tokens:
            position = 24 + int.from_bytes(hashlib.sha256(term.encode()).digest()[:4], "big") % (self.dimensions - 24)
            vector[position] += 0.35
        return vector

    def answer(self, question, passages):
        selected = passages[:2]
        return {"answer": " ".join(p["text"] for p in selected), "insufficient_evidence": False,
                "citations": [{"source": i + 1, "quote": p["text"]} for i, p in enumerate(selected)]}


class RecordingRepository:
    """Observe actual search results; all SQL/auth/ownership stays in delegate."""
    def __init__(self, delegate):
        self.delegate = delegate
        self.retrieved = []
        self.searches = 0

    def __getattr__(self, name):
        return getattr(self.delegate, name)

    def search(self, *args, **kwargs):
        self.retrieved = self.delegate.search(*args, **kwargs)
        self.searches += 1
        return self.retrieved


class RecordingProvider:
    def __init__(self, delegate):
        self.delegate = delegate
        self.embeddings = 0
        self.generations = 0

    def embed(self, *args, **kwargs):
        result = self.delegate.embed(*args, **kwargs)
        self.embeddings += 1
        return result

    def answer(self, *args, **kwargs):
        result = self.delegate.answer(*args, **kwargs)
        self.generations += 1
        return result


def supporting_units(passages, sections):
    return {key for key, section in sections.items() for p in passages
            if p["filename"] == section["filename"] and section["text"] in normalize(p["text"])}


def score_case(item, passages, response, sections, elapsed_ms, failed=False):
    relevant = set(item["supports"])
    top1 = supporting_units(passages[:1], sections)
    top5 = supporting_units(passages[:5], sections)
    citations = response.get("citations", []) if not failed else []
    correct, valid = 0, 0
    integrity_valid_passages = []
    for citation in citations:
        # Count literal source/quote integrity separately from labeled relevance.
        matching = [p for p in passages if p["document_id"] == citation.get("document_id")
                    and p["filename"] == citation.get("filename") and p["page"] == citation.get("page")
                    and p["text"] == citation.get("passage")]
        quote_text = citation.get("quote")
        integrity = bool(matching) and isinstance(quote_text, str) and len(quote_text.strip()) >= 8 and quote_text in matching[0]["text"]
        valid += int(integrity)
        if integrity:
            integrity_valid_passages.append(matching[0])
        correct += int(integrity and any(sections[key]["filename"] == citation.get("filename")
                                        and sections[key]["text"] in normalize(citation["passage"])
                                        for key in relevant))
    # Coverage still measures labeled sections in cited passages, not semantic
    # entailment of the quote/answer. Only integrity-valid citations qualify.
    cited_units = supporting_units(integrity_valid_passages, sections)
    return {"answerable": bool(relevant), "multi_section": len(relevant) > 1,
            "hit1": int(bool(relevant & top1)),
            "recall5": len(relevant & top5) / len(relevant) if relevant else None,
            "citations": len(citations), "valid_citations": valid, "relevant_citations": correct,
            "evidence_coverage": len(relevant & cited_units) / len(relevant) if relevant else None,
            "abstained": response.get("abstained") is True and not failed,
            "failed": failed, "elapsed_ms": elapsed_ms}


def aggregate(cases):
    answerable = [c for c in cases if c["answerable"]]
    negative = [c for c in cases if not c["answerable"]]
    multi = [c for c in cases if c["multi_section"]]
    ratio = lambda numerator, denominator: numerator / denominator if denominator else None
    mean = lambda values: statistics.mean(values) if values else None
    citation_count = sum(c["citations"] for c in cases)
    latency = sorted(c["elapsed_ms"] for c in cases)
    return {"questions": len(cases), "answerable": len(answerable), "multi_section": len(multi),
            "unanswerable": len(negative), "request_errors": sum(c["failed"] for c in cases),
            "hit_at_1": mean([c["hit1"] for c in answerable]),
            "recall_at_5": mean([c["recall5"] for c in answerable]),
            "multi_section_recall_at_5": mean([c["recall5"] for c in multi]),
            "citations_emitted": citation_count,
            "citation_quote_integrity": ratio(sum(c["valid_citations"] for c in cases), citation_count),
            "citation_gold_source_precision": ratio(sum(c["relevant_citations"] for c in cases), citation_count),
            "answerable_citation_evidence_coverage": mean([c["evidence_coverage"] for c in answerable]),
            "negative_abstention_rate": ratio(sum(c["abstained"] for c in negative), len(negative)),
            "answerable_abstention_rate": ratio(sum(c["abstained"] for c in answerable), len(answerable)),
            "latency_ms_mean": mean(latency),
            "latency_ms_p95": latency[max(0, (95 * len(latency) + 99) // 100 - 1)] if latency else None}


class EvaluationFailed(Exception):
    """Never include raw database/provider/HTTP payloads in diagnostics."""


REQUIRED_CHECKS = frozenset({
    "unauthenticated_list_denied", "owner_list_complete", "other_account_list_empty",
    "other_account_explicit_retrieval_denied", "other_account_delete_denied",
    "other_account_unfiltered_retrieval_empty", "owner_delete", "deleted_document_unavailable",
    "logout_1", "logout_2",
})


def evaluation_succeeded(report):
    """Operational success only; quality metrics retain their measured values."""
    checks, metrics = report.get("security_checks", {}), report.get("metrics", {})
    return (metrics.get("request_errors") == 0 and metrics.get("questions", 0) > 0
            and REQUIRED_CHECKS <= checks.keys()
            and all(value is True for value in checks.values()))


def print_report(report):
    print(json.dumps(report, indent=2))
    return 0 if evaluation_succeeded(report) else 1


def run_evaluation(settings, repository, provider, mode):
    from fastapi.testclient import TestClient
    from .app import create_app
    dataset, sections = load_dataset()
    recording = RecordingRepository(repository)
    recorded_provider = RecordingProvider(provider)
    checks = {}
    cases = []
    uploaded = []
    chunk_count = 0
    start = time.perf_counter()
    with TestClient(create_app(settings, recording, recorded_provider), base_url="http://127.0.0.1:8001",
                    raise_server_exceptions=False) as client:
        def require(response, status):
            if response.status_code != status:
                raise EvaluationFailed("Synthetic integration check failed; inspect local setup privately")
            try:
                body = response.json()
                if not isinstance(body, dict):
                    raise ValueError()
                return body
            except Exception:
                raise EvaluationFailed("Synthetic integration response was invalid") from None

        def account():
            credentials = {"username": "eval_" + secrets.token_hex(8), "password": secrets.token_urlsafe(24)}
            require(client.post("/rag/register", json=credentials), 201)
            response = require(client.post("/rag/login", json=credentials), 200)
            return {"Authorization": "Bearer " + response["token"]}

        sessions = []
        try:
            alpha = account(); sessions.append(alpha)
            beta = account(); sessions.append(beta)
            checks["unauthenticated_list_denied"] = client.get("/rag/documents").status_code == 401
            for document in dataset["documents"]:
                mime, content = document_bytes(document)
                result = require(client.post("/rag/documents", params={"filename": document["filename"]},
                    headers=alpha | {"Content-Type": mime, "X-Synthetic-Document": "true"}, content=content), 201)
                uploaded.append(result["id"])
                chunk_count += result["chunks"]
            checks["owner_list_complete"] = len(require(client.get("/rag/documents", headers=alpha), 200)["documents"]) == len(uploaded)
            checks["other_account_list_empty"] = require(client.get("/rag/documents", headers=beta), 200)["documents"] == []
            checks["other_account_explicit_retrieval_denied"] = client.post("/rag/ask", headers=beta,
                json={"question": dataset["questions"][0]["question"], "document_ids": [uploaded[0]]}).status_code == 404
            checks["other_account_delete_denied"] = client.delete("/rag/documents/" + uploaded[0], headers=beta).status_code == 404
            other = require(client.post("/rag/ask", headers=beta, json={"question": dataset["questions"][0]["question"]}), 200)
            checks["other_account_unfiltered_retrieval_empty"] = other["abstained"] is True and other["citations"] == []
            for item in dataset["questions"]:
                recording.retrieved = []
                began = time.perf_counter()
                failed, body = False, {}
                try:
                    result = client.post("/rag/ask", headers=alpha, json={"question": item["question"]})
                    body = require(result, 200)
                    if (not isinstance(body.get("answer"), str) or not body["answer"].strip()
                            or type(body.get("abstained")) is not bool
                            or not isinstance(body.get("citations"), list)
                            or any(not isinstance(c, dict) for c in body["citations"])
                            or (body["abstained"] and body["citations"])
                            or (not body["abstained"] and not body["citations"])):
                        raise EvaluationFailed("Invalid question response")
                except Exception:
                    # A transport/HTTP/JSON/schema failure is never abstention.
                    failed, body = True, {}
                elapsed = (time.perf_counter() - began) * 1000
                cases.append(score_case(item, recording.retrieved, body, sections, elapsed, failed))
            # Only newly uploaded synthetic documents are deleted; never preexisting data.
            checks["owner_delete"] = client.delete("/rag/documents/" + uploaded[0], headers=alpha).status_code == 200
            checks["deleted_document_unavailable"] = client.post("/rag/ask", headers=alpha,
                json={"question": dataset["questions"][0]["question"], "document_ids": [uploaded[0]]}).status_code == 404
        finally:
            # No auto-retry or cleanup deletes on failure: writes may be unconfirmed.
            for index, headers in enumerate(sessions, 1):
                try:
                    response = require(client.post("/rag/logout", headers=headers), 200)
                    checks[f"logout_{index}"] = response.get("signed_out") is True
                except Exception:
                    checks[f"logout_{index}"] = False
    report = {"mode": mode, "dataset": dataset["version"], "documents": len(uploaded), "chunks": chunk_count,
            "synthetic_accounts_created": 2,
            "synthetic_documents_retained": len(uploaded) - int(checks.get("owner_delete", False)),
            "embedding_dimensions": settings.dimensions, "retrieval_min_score": settings.min_score,
            "security_checks": checks, "metrics": aggregate(cases),
            "completed_embedding_calls": recorded_provider.embeddings,
            "completed_generation_calls": recorded_provider.generations,
            "completed_repository_searches": recording.searches,
            "total_elapsed_ms": (time.perf_counter() - start) * 1000,
            "claim_entailment_verified": False,
            "real_embeddings_verified": mode == "live" and recorded_provider.embeddings > 0,
            "postgres_storage_and_search_verified": mode == "live" and len(uploaded) == len(dataset["documents"]) and recording.searches > 0,
            "real_generation_verified": mode == "live" and recorded_provider.generations > 0}
    report["success"] = evaluation_succeeded(report)
    # Never label a failed run as verified merely because some calls succeeded.
    for name in ("real_embeddings_verified", "postgres_storage_and_search_verified", "real_generation_verified"):
        report[name] = report[name] and report["success"]
    return report


def run_mock():
    from .tests.fakes import MemoryRepository
    settings = Settings(dimensions=128)
    return run_evaluation(settings, MemoryRepository(settings), LexicalMockProvider(settings.dimensions), "mock")


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", required=True)
    parser.add_argument("--allow-provider-requests", action="store_true", help="Explicit consent to provider calls/possible billing")
    parser.add_argument("--environment", action="store_true", help="Use only RAG_ process variables instead of private prompts")
    args = parser.parse_args()
    if not args.allow_provider_requests:
        parser.error("Live evaluation requires --allow-provider-requests; nothing was contacted")
    try:
        if args.environment:
            settings = from_environment()
        else:
            password = getpass("Local rag_app password (127.0.0.1:5544/fft_rag_demo only): ")
            key = getpass("Separate synthetic-demo Gemini key: ")
            if not password or not key:
                raise EvaluationFailed("Both demo credentials are required")
            settings = Settings(database_url=validate_local_database("postgresql://rag_app:" + quote(password, safe="")
                               + "@127.0.0.1:5544/fft_rag_demo"), api_key=key)
        if not settings.api_key:
            raise EvaluationFailed("A separate demo key is required")
        from .repository import PostgresRepository
        from .pipeline import GeminiProvider
        report = run_evaluation(settings, PostgresRepository(settings), GeminiProvider(settings), "live")
    except Exception:
        raise SystemExit("Live evaluation blocked or failed; verify dedicated local schema, role, model contract and demo credentials privately. No raw diagnostic payload is printed.") from None
    return print_report(report)


if __name__ == "__main__":
    raise SystemExit(main())
