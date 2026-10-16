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


def _failure(error):
    if not isinstance(error, ai_service.AIServiceError):
        error = ai_service.AIServiceError('AI_UNAVAILABLE', 'AI is temporarily unavailable. Please try again shortly.', True)
    headers = {'Retry-After': '60'} if error.code == 'AI_RATE_LIMITED' else None
    return JSONResponse(status_code=error.status_code, headers=headers, content={
        'error': {'code': error.code, 'message': error.message, 'retryable': error.retryable}})


@router.post("/ai/parse-transaction", response_model=ParseTransactionResponse)
def parse_transaction(body: ParseTransactionRequest):
    """Parse a raw UPI/SMS text into structured expense fields using Gemini."""
    try:
        result = ai_service.parse_transaction(body.raw_text)
        return ParseTransactionResponse(**result)
    except Exception as error:
        return _failure(error)


@router.post("/ai/monthly-insights", response_model=MonthlyInsightsResponse)
def monthly_insights(body: MonthlyInsightsRequest):
    """Generate 5 plain-English financial insights from a monthly report."""
    try:
        insights = ai_service.get_monthly_insights(body.report)
        return MonthlyInsightsResponse(insights=insights)
    except Exception as error:
        return _failure(error)


@router.post("/ai/chat", response_model=ChatResponse)
def chat(body: ChatRequest):
    """Answer a natural language finance question with live context."""
    try:
        answer = ai_service.chat(body.question, body.context, body.history)
        return ChatResponse(answer=answer)
    except Exception as error:
        return _failure(error)
