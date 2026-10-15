from .pipeline import chunk_pages, extract_pages, checked_vector, grounded_answer
from .pipeline import InvalidDocument
from .repository import Conflict
from threading import BoundedSemaphore
import time


_UPLOAD_SLOT = BoundedSemaphore(1)


class RagService:
    def __init__(self, repository, provider, settings):
        self.repository, self.provider, self.settings = repository, provider, settings

    def upload(self, owner, filename, content_type, content):
        if not _UPLOAD_SLOT.acquire(blocking=False):
            raise Conflict("Another demo upload is processing; try again later")
        try:
            deadline = time.monotonic() + self.settings.upload_seconds
            def check_deadline():
                if time.monotonic() >= deadline:
                    raise InvalidDocument("Document indexing exceeded its time budget; no document was saved")

            # Cheap preflight before parsing/provider calls; SQL still atomically
            # enforces quota at insertion, including concurrent processes.
            if len(self.repository.list_documents(owner)) >= 20:
                raise Conflict("Demo limit is 20 documents per account")
            pages = extract_pages(filename, content_type, content, self.settings)
            chunks = chunk_pages(pages, self.settings)
            vectors = []
            for chunk in chunks:
                check_deadline()
                vectors.append(checked_vector(self.provider.embed(chunk.text), self.settings.dimensions))
            check_deadline()
            # No insertion after an exhausted budget or partial embeddings.
            return self.repository.add_document(owner, filename, chunks, vectors)
        finally:
            _UPLOAD_SLOT.release()

    def ask(self, owner, question, document_ids=None):
        # Ownership preflight avoids calling providers for foreign document IDs.
        if document_ids:
            available = {d["id"] for d in self.repository.list_documents(owner)}
            if not set(document_ids) <= available:
                raise PermissionError("Document unavailable")
        vector = checked_vector(self.provider.embed(question, query=True), self.settings.dimensions)
        passages = self.repository.search(owner, vector, document_ids, self.settings.top_k, self.settings.min_score)
        return grounded_answer(question, passages, self.provider)
