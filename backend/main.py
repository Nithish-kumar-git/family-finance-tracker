"""FastAPI application entry point with CORS and router registration."""

import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

from database import get_db
from auth import require_family_member
from cache_policy import ProtectedResponseCacheMiddleware, internal_server_error
from request_protection import RequestProtectionMiddleware
from routers.auth import router as auth_router
from routers.demo_ai import router as demo_ai_router
from routers import expenses, assets, milestones, employment, reports, ai, reset
from routers.settings import router as settings_router

app = FastAPI(title="FamilyFinanceTracker API", version="1.0.0")
app.add_middleware(ProtectedResponseCacheMiddleware)
app.add_middleware(RequestProtectionMiddleware, routes=app.routes)

# ── CORS ──────────────────────────────────────────────────────────────────────
allowed_origins = [origin.strip().rstrip('/') for origin in os.getenv(
    'FRONTEND_URL', 'https://scintillating-donut-a597ff.netlify.app').split(',')
    if origin.strip() and origin.strip() != '*']


async def cors_internal_server_error(request, exc):
    # ServerErrorMiddleware runs outside CORSMiddleware. Apply the same explicit
    # origin allowlist to its sanitized response; credentials remain disallowed.
    response = await internal_server_error(request, exc)
    origin = request.headers.get('origin')
    if origin in allowed_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers.add_vary_header('Origin')
    return response


app.add_exception_handler(Exception, cors_internal_server_error)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
protected = [Depends(require_family_member)]
app.include_router(expenses.router, prefix="/api", dependencies=protected)
app.include_router(assets.router, prefix="/api", dependencies=protected)
app.include_router(milestones.router, prefix="/api", dependencies=protected)
app.include_router(employment.router, prefix="/api", dependencies=protected)
app.include_router(reports.router, prefix="/api", dependencies=protected)
app.include_router(ai.router, prefix="/api", dependencies=protected)
app.include_router(demo_ai_router, prefix="/api")
app.include_router(reset.router, prefix="/api")
app.include_router(settings_router, prefix="/api", dependencies=protected)
app.include_router(auth_router, prefix="/api")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        return {"status": "ok", "database": "error"}
