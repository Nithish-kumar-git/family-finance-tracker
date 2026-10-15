import math
import uuid
from rag_demo.repository import Conflict


class MemoryRepository:
    """Test double only; never offered as a runtime database fallback."""
    def __init__(self, settings):
        self.settings = settings
        self.accounts, self.sessions, self.documents, self.chunks = {}, {}, {}, []

    def create_account(self, username, password_hash):
        if username in self.accounts:
            raise Conflict("Demo username already exists")
        owner = str(uuid.uuid4())
        self.accounts[username] = {"id": owner, "password_hash": password_hash}
        return owner

    def account(self, username):
        return self.accounts.get(username)

    def create_session(self, owner, digest, expires):
        self.sessions[digest] = (owner, expires)

    def session_owner(self, digest, now):
        session = self.sessions.get(digest)
        return session[0] if session and session[1] > now else None

    def revoke_session(self, digest):
        self.sessions.pop(digest, None)

    def add_document(self, owner, filename, chunks, vectors):
        if len(self.list_documents(owner)) >= 20:
            raise Conflict("Demo document quota")
        document = str(uuid.uuid4())
        self.documents[document] = {"id": document, "owner": owner, "filename": filename, "chunks": len(chunks)}
        for chunk, vector in zip(chunks, vectors, strict=True):
            self.chunks.append({"document_id": document, "owner": owner, "filename": filename,
                                "page": chunk.page, "ordinal": chunk.ordinal, "text": chunk.text,
                                "vector": vector, "model": self.settings.embedding_model,
                                "dimensions": self.settings.dimensions})
        return {k: v for k, v in self.documents[document].items() if k != "owner"}

    def list_documents(self, owner):
        return [{k: v for k, v in doc.items() if k != "owner"} for doc in self.documents.values() if doc["owner"] == owner]

    def delete_document(self, owner, document):
        if document not in self.documents or self.documents[document]["owner"] != owner:
            return False
        del self.documents[document]
        self.chunks = [c for c in self.chunks if c["document_id"] != document]
        return True

    def search(self, owner, vector, document_ids, limit, min_score):
        if document_ids and not set(document_ids) <= {d["id"] for d in self.list_documents(owner)}:
            raise PermissionError("Document unavailable")
        candidates = []
        for chunk in self.chunks:
            if chunk["owner"] != owner or (document_ids and chunk["document_id"] not in document_ids):
                continue
            if (chunk["model"], chunk["dimensions"]) != (self.settings.embedding_model, self.settings.dimensions):
                continue
            score = sum(a * b for a, b in zip(chunk["vector"], vector, strict=True)) / (
                math.sqrt(sum(a*a for a in vector)) * math.sqrt(sum(b*b for b in chunk["vector"])))
            if score >= min_score:
                candidates.append({k: v for k, v in chunk.items() if k not in {"owner", "vector", "model", "dimensions"}} | {"score": score})
        return sorted(candidates, key=lambda c: (-c["score"], c["document_id"], c["ordinal"]))[:limit]


class SyntheticProvider:
    """Deterministic topic embeddings; NOT a real semantic quality benchmark."""
    topics = ["insurance", "savings", "travel"]
    def __init__(self, dimensions=128):
        self.dimensions = dimensions
        self.answer_calls = 0

    def embed(self, text, query=False):
        vector = [0.0] * self.dimensions
        found = False
        for i, topic in enumerate(self.topics):
            if topic in text.lower():
                vector[i] = 1.0
                found = True
        if not found:
            vector[-1] = 1.0
        return vector

    def answer(self, question, passages):
        self.answer_calls += 1
        return {"answer": passages[0]["text"], "insufficient_evidence": False,
                "citations": [{"source": 1, "quote": passages[0]["text"]}]}
