"""Public, read-only demonstration. Never imports a database or household model."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from schemas import DemoChatRequest, ChatResponse
from services import ai_service
from routers.ai import _failure

router = APIRouter()

# Matches the initial synthetic browser fixture, not real household records.
# Edits to browser records are deliberately not uploaded through this endpoint.
DEMO_CONTEXT = {
    "workspace": "fictional demonstration; never a real household",
    "monthly_income": 70000,
    "total_expenses_this_month": 23580,
    "monthly_surplus": 46420,
    "category_totals": {"groceries": 4250, "transport": 900, "household": 14000,
                        "utilities": 2100, "medical": 650, "personal": 480, "education": 1200},
    "total_corpus": 267500,
    "emergency_fund_balance": 40000,
    "note": "Use only this original synthetic example. Browser edits are not included. "
            "No access to private records, tools, accounts, or write operations.",
}

@router.post("/demo/ai/chat", response_model=ChatResponse)
def demo_chat(body: DemoChatRequest):
    try:
        answer = ai_service.chat(body.question, DEMO_CONTEXT, body.history)
        return JSONResponse({"answer": answer}, headers={"Cache-Control": "no-store"})
    except Exception as error:
        return _failure(error)
