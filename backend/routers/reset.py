"""Full data reset endpoint — truncates all tables except users."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import (
    MonthlySnapshot, JobApplication, Milestone, Expense, Budget,
    MutualFund, FixedDeposit, LICPolicy, ChitFund, Gold,
    EmergencyFund, MonthlyIncome
)
from schemas import ResetResponse

router = APIRouter()

TABLES_ORDER = [
    (MonthlySnapshot, "monthly_snapshots"),
    (JobApplication, "job_applications"),
    (Milestone, "milestones"),
    (Expense, "expenses"),
    (Budget, "budgets"),
    (MutualFund, "mutual_funds"),
    (FixedDeposit, "fixed_deposits"),
    (LICPolicy, "lic_policies"),
    (ChitFund, "chit_funds"),
    (Gold, "gold"),
    (EmergencyFund, "emergency_fund"),
    (MonthlyIncome, "monthly_income"),
]


@router.delete("/reset", response_model=ResetResponse)
def reset_all_data(
    x_confirm_reset: Optional[str] = Header(None, alias="X-Confirm-Reset"),
    db: Session = Depends(get_db)
):
    """Truncate all tables except users. Requires X-Confirm-Reset header."""
    if x_confirm_reset != "DELETE-ALL-DATA":
        raise HTTPException(
            status_code=400,
            detail="Missing or invalid X-Confirm-Reset header"
        )
    cleared = []
    for model, table_name in TABLES_ORDER:
        db.query(model).delete(synchronize_session=False)
        cleared.append(table_name)
    db.commit()
    return ResetResponse(
        reset=True,
        tables_cleared=cleared,
        timestamp=datetime.utcnow().isoformat()
    )
