from dataclasses import dataclass
import os
from urllib.parse import urlsplit, unquote


@dataclass(frozen=True)
class Settings:
    database_url: str = ""
    api_key: str = ""
    embedding_model: str = "gemini-embedding-001"
    dimensions: int = 768
    answer_model: str = "gemini-3.5-flash-lite"
    chunk_size: int = 900
    overlap: int = 150
    top_k: int = 5
    min_score: float = 0.65
    max_bytes: int = 2 * 1024 * 1024
    max_chars: int = 100_000
    max_chunks: int = 160
    max_pdf_pages: int = 40
    max_pdf_stream_bytes: int = 2 * 1024 * 1024
    max_pdf_total_stream_bytes: int = 8 * 1024 * 1024
    pdf_timeout_seconds: float = 5
    pdf_memory_bytes: int = 256 * 1024 * 1024
    upload_seconds: float = 60
    session_seconds: int = 3600

    def __post_init__(self):
        if not (128 <= self.dimensions <= 3072):
            raise ValueError("Embedding dimensions must be 128..3072")
        if not (100 <= self.chunk_size <= 2000 and 0 <= self.overlap < self.chunk_size):
            raise ValueError("Invalid chunk size/overlap")
        if not (1 <= self.top_k <= 10 and 0 <= self.min_score <= 1):
            raise ValueError("Invalid retrieval settings")
        if not self.embedding_model or not self.answer_model:
            raise ValueError("Models must be explicit")
        # Hard ceilings: callers may tighten limits, never disable them.
        limits = ((self.max_bytes, 2 * 1024 * 1024), (self.max_chars, 100_000),
                  (self.max_chunks, 160), (self.max_pdf_pages, 40),
                  (self.max_pdf_stream_bytes, 2 * 1024 * 1024),
                  (self.max_pdf_total_stream_bytes, 8 * 1024 * 1024),
                  (self.pdf_memory_bytes, 256 * 1024 * 1024))
        if any(type(value) is not int or not 1 <= value <= ceiling for value, ceiling in limits):
            raise ValueError("Invalid document resource limits")
        if not (0 < self.pdf_timeout_seconds <= 5 and 0 < self.upload_seconds <= 60):
            raise ValueError("Invalid document processing deadline")


def validate_local_database(url):
    """Reject production destinations, URL options and alternative databases."""
    try:
        parsed = urlsplit(url)
        valid = (parsed.scheme == "postgresql" and parsed.hostname == "127.0.0.1"
                 and parsed.username == "rag_app"
                 and unquote(parsed.path) == "/fft_rag_demo" and not parsed.query
                 and not parsed.fragment and parsed.port is not None)
    except ValueError:
        valid = False
    if not valid:
        raise ValueError("RAG database must be a plain loopback PostgreSQL URL for fft_rag_demo")
    return url


def from_environment():
    # Deliberately never load .env or read SUPABASE_DATABASE_URL / family keys.
    if os.getenv("RAG_DEMO_ENABLED") != "1":
        raise ValueError("Local RAG demo is disabled; follow rag_demo/README.md")
    return Settings(
        database_url=validate_local_database(os.getenv("RAG_DATABASE_URL", "")),
        api_key=os.getenv("RAG_GEMINI_API_KEY", ""),
        embedding_model=os.getenv("RAG_EMBEDDING_MODEL", "gemini-embedding-001"),
        dimensions=int(os.getenv("RAG_EMBEDDING_DIMENSIONS", "768")),
        answer_model=os.getenv("RAG_ANSWER_MODEL", "gemini-3.5-flash-lite"),
        chunk_size=int(os.getenv("RAG_CHUNK_SIZE", "900")),
        overlap=int(os.getenv("RAG_CHUNK_OVERLAP", "150")),
    )
