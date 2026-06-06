"""Settings router — income configuration endpoint."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/settings", tags=["settings"])


class MonthlyIncomeUpdate(BaseModel):
    pension: float
    nithish: float
    abeerami: float


@router.patch("/income")
def update_income(body: MonthlyIncomeUpdate):
    """Validate and echo back monthly income values.

    Income is stored in Zustand/localStorage as the source of truth.
    This endpoint exists for API consistency and future sync support.
    Returns 422 if any value is negative.
    """
    if body.pension < 0 or body.nithish < 0 or body.abeerami < 0:
        raise HTTPException(
            status_code=422,
            detail="Income values cannot be negative",
        )
    return {
        "pension": body.pension,
        "nithish": body.nithish,
        "abeerami": body.abeerami,
        "updated": True,
    }
