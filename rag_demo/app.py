"""Run separately: uvicorn rag_demo.app:app --host 127.0.0.1 --port 8001.

Never registered with the family backend. No dotenv or automatic DDL.
"""
import secrets
import time
from uuid import UUID

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field, ConfigDict

from .auth import DUMMY_HASH, password_hash, verify_password, token_hash
from .config import from_environment
from .pipeline import GeminiProvider, InvalidDocument, ProviderUnavailable
from .repository import PostgresRepository, Conflict
from .service import RagService


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(pattern=r"^[a-z][a-z0-9_-]{2,31}$")
    password: str = Field(min_length=12, max_length=128)


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1, max_length=1000)
    document_ids: list[UUID] = Field(default_factory=list, max_length=20)


class BodyLimit:
    """Bound request bodies before JSON parsers allocate memory; raw uploads only."""
    def __init__(self, app, limit):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        try:
            length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await JSONResponse({"detail": "Invalid request length"}, 400)(scope, receive, send)
        limit = self.limit if scope["path"] == "/rag/documents" else 8192
        if length < 0 or length > limit:
            return await JSONResponse({"detail": "Request too large"}, 413)(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > limit:
                return await JSONResponse({"detail": "Request too large"}, 413)(scope, receive, send)
            if not message.get("more_body", False):
                break
        consumed = False
        async def bounded_receive():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()
        await self.app(scope, bounded_receive, send)


def create_app(settings=None, repository=None, provider=None):
    configuration_error = False
    if settings is None:
        try:
            settings = from_environment()
        except (ValueError, TypeError):
            configuration_error = True
    repo = repository or (PostgresRepository(settings) if settings else None)
    service = RagService(repo, provider or GeminiProvider(settings), settings) if settings else None
    app = FastAPI(title="Synthetic local financial-document RAG", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(BodyLimit, limit=settings.max_bytes if settings else 2 * 1024 * 1024)
    app.add_middleware(CORSMiddleware, allow_origins=["http://127.0.0.1:5174"],
                       allow_methods=["GET", "POST", "DELETE"],
                       allow_headers=["Authorization", "Content-Type", "X-Synthetic-Document"])
    bearer = HTTPBearer(auto_error=False)
    attempts = {}

    @app.middleware("http")
    async def local_only(request, call_next):
        # Also prevent DNS-rebinding Host headers and cross-origin form requests.
        if request.headers.get("host", "").split(":")[0] != "127.0.0.1":
            return JSONResponse({"detail": "Loopback demo only"}, 403)
        origin = request.headers.get("origin")
        if origin and origin != "http://127.0.0.1:5174":
            return JSONResponse({"detail": "Origin not allowed"}, 403)
        if configuration_error:
            return JSONResponse({"detail": "Local demo disabled or misconfigured; see setup instructions"}, 503)
        try:
            response = await call_next(request)
        except Exception:
            # Never return database URLs, provider responses or document contents.
            response = JSONResponse({"detail": "Local demo dependency unavailable"}, 503)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    def owner(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if not credentials or credentials.scheme.lower() != "bearer" or len(credentials.credentials) > 128:
            raise HTTPException(401, "Demo login required")
        identity = repo.session_owner(token_hash(credentials.credentials), int(time.time()))
        if not identity:
            raise HTTPException(401, "Demo session expired or invalid; sign in again")
        return identity

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, error):
        # FastAPI's default validation detail can echo credentials and questions.
        return JSONResponse({"detail": "Invalid demo request fields; check names, sizes and formats"}, 422)

    def throttle(request):
        key = request.client.host if request.client else "local"
        now = time.monotonic()
        recent = [t for t in attempts.get(key, []) if now - t < 60]
        if len(recent) >= 10:
            raise HTTPException(429, "Too many demo login attempts; wait one minute")
        attempts[key] = recent + [now]

    @app.post("/rag/register", status_code=201)
    def register(body: Credentials, request: Request):
        throttle(request)
        try:
            repo.create_account(body.username, password_hash(body.password))
        except Conflict as error:
            raise HTTPException(409, str(error)) from None
        return {"registered": True}

    @app.post("/rag/login")
    def login(body: Credentials, request: Request):
        throttle(request)
        account = repo.account(body.username)
        valid = verify_password(body.password, account["password_hash"] if account else DUMMY_HASH)
        if not account or not valid:
            raise HTTPException(401, "Invalid demo credentials")
        token = secrets.token_urlsafe(32)
        repo.create_session(account["id"], token_hash(token), int(time.time()) + settings.session_seconds)
        return {"token": token, "expires_in": settings.session_seconds}

    @app.post("/rag/logout")
    def logout(identity=Depends(owner), credentials=Depends(bearer)):
        repo.revoke_session(token_hash(credentials.credentials))
        return {"signed_out": True}

    @app.get("/rag/documents")
    def documents(identity=Depends(owner)):
        return {"documents": repo.list_documents(identity)}

    @app.post("/rag/documents", status_code=201)
    async def upload(request: Request, filename: str, identity=Depends(owner)):
        if request.headers.get("x-synthetic-document") != "true":
            raise HTTPException(400, "Confirm that this is a synthetic demo document")
        from starlette.concurrency import run_in_threadpool
        try:
            content = await request.body()
            return await run_in_threadpool(service.upload, identity, filename,
                                          request.headers.get("content-type", "").split(";")[0], content)
        except InvalidDocument as error:
            raise HTTPException(422, str(error)) from None
        except Conflict as error:
            raise HTTPException(409, str(error)) from None
        except ProviderUnavailable:
            raise HTTPException(503, "Demo embedding service unavailable; no document was saved") from None

    @app.delete("/rag/documents/{document}")
    def delete(document: UUID, identity=Depends(owner)):
        if not repo.delete_document(identity, str(document)):
            raise HTTPException(404, "Document unavailable")
        return {"deleted": True}

    @app.post("/rag/ask")
    def ask(body: Question, identity=Depends(owner)):
        if not body.question.strip():
            raise HTTPException(422, "Question is empty")
        try:
            return service.ask(identity, body.question.strip(), [str(d) for d in body.document_ids])
        except PermissionError:
            raise HTTPException(404, "Document unavailable") from None
        except Conflict as error:
            raise HTTPException(409, str(error)) from None
        except ProviderUnavailable:
            raise HTTPException(503, "Demo AI service unavailable; retry without changing documents") from None

    return app


app = create_app()
