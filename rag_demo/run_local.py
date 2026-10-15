"""Interactive loopback launcher; never writes credentials or loads .env."""
from getpass import getpass
import os
from urllib.parse import quote
from .config import Settings, validate_local_database


def main():
    print("Synthetic local RAG only. Database: fft_rag_demo on 127.0.0.1:5544.")
    password = getpass("Local rag_app database password: ")
    key = getpass("Separate demo Gemini API key: ")
    if not password or not key:
        raise SystemExit("Both local-demo credentials are required")
    settings = Settings(database_url=validate_local_database(
        "postgresql://rag_app:" + quote(password, safe="") + "@127.0.0.1:5544/fft_rag_demo"), api_key=key,
        answer_model=os.getenv("RAG_ANSWER_MODEL", Settings().answer_model))
    from .app import create_app
    import uvicorn
    uvicorn.run(create_app(settings), host="127.0.0.1", port=8001, access_log=False, log_level="warning")


if __name__ == "__main__":
    main()
