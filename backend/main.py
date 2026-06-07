"""FastAPI application entry point with CORS and router registration."""

import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

from database import get_db
from routers import expenses, assets, milestones, employment, reports, ai, reset
from routers.settings import router as settings_router

app = FastAPI(title="FamilyFinanceTracker API", version="1.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
frontend_url = os.getenv("FRONTEND_URL", "*")
if frontend_url == "*" or not frontend_url:
    allowed_origins = ["*"]
else:
    allowed_origins = [frontend_url]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(expenses.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(milestones.router, prefix="/api")
app.include_router(employment.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(reset.router, prefix="/api")
app.include_router(settings_router, prefix="/api")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        return {"status": "ok", "database": "error"}
