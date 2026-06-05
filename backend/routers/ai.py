"""AI endpoints calling Gemini via ai_service. Returns 503 on failure."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from services import ai_service
from schemas import (
    ParseTransactionRequest, ParseTransactionResponse,
    MonthlyInsightsRequest, MonthlyInsightsResponse,
    ChatRequest, ChatResponse
)

router = APIRouter()


@router.post("/ai/parse-transaction", response_model=ParseTransactionResponse)
def parse_transaction(body: ParseTransactionRequest):
    """Parse a raw UPI/SMS text into structured expense fields using Gemini."""
    try:
        result = ai_service.parse_transaction(body.raw_text)
        return ParseTransactionResponse(**result)
    except Exception:
        return JSONResponse(status_code=503, content={"error": "AI unavailable"})


@router.post("/ai/monthly-insights", response_model=MonthlyInsightsResponse)
def monthly_insights(body: MonthlyInsightsRequest):
    """Generate 5 plain-English financial insights from a monthly report."""
    try:
        insights = ai_service.get_monthly_insights(body.report)
        return MonthlyInsightsResponse(insights=insights)
    except Exception:
        return JSONResponse(status_code=503, content={"error": "AI unavailable"})


@router.post("/ai/chat", response_model=ChatResponse)
def chat(body: ChatRequest):
    """Answer a natural language finance question with live context."""
    try:
        answer = ai_service.chat(body.question, body.context, body.history)
        return ChatResponse(answer=answer)
    except Exception:
        return JSONResponse(status_code=503, content={"error": "AI unavailable"})
