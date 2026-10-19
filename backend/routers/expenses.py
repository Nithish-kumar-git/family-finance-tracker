"""Expense CRUD endpoints with pandas category aggregation."""

import uuid
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional

from database import get_db
from models import Expense
from schemas import ExpenseCreate, ExpenseResponse

router = APIRouter()

# ASCII calendar years 0001-9999 and months 01-12; no LIKE wildcards.
EXPENSE_MONTH_PATTERN = (
    r"^(?:[1-9][0-9]{3}|0[1-9][0-9]{2}|00[1-9][0-9]|000[1-9])"
    r"-(?:0[1-9]|1[0-2])$"
)

VALID_CATEGORIES = [
    "groceries", "utilities", "medical", "transport", "household",
    "lic_premium", "chit_contribution", "personal", "education", "other"
]


@router.get("/expenses")
def get_expenses(
    month: str = Query(..., min_length=7, max_length=7,
                       pattern=EXPENSE_MONTH_PATTERN, description="Format: YYYY-MM"),
    userId: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Return all expenses for a month with pandas category totals."""
    query = db.query(Expense).filter(Expense.date.like(f"{month}%"))
    if userId:
        query = query.filter(Expense.userId == userId)
    expenses = query.order_by(Expense.date.desc()).all()

    category_totals = {cat: 0.0 for cat in VALID_CATEGORIES}
    if expenses:
        data = [{"category": e.category, "amount": e.amount} for e in expenses]
        df = pd.DataFrame(data)
        if not df.empty:
            grouped = df.groupby("category")["amount"].sum().to_dict()
            for cat, total in grouped.items():
                if cat in category_totals:
                    category_totals[cat] = float(total)

    return {
        "expenses": [ExpenseResponse.model_validate(e) for e in expenses],
        "category_totals": category_totals
    }


@router.post("/expenses", response_model=ExpenseResponse, status_code=201)
def create_expense(body: ExpenseCreate, db: Session = Depends(get_db)):
    """Create a new expense record."""
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {body.category}")
    values = body.model_dump(exclude={'id'})
    expense_id = body.id or str(uuid.uuid4())

    def existing_submission():
        existing = db.query(Expense).filter(Expense.id == expense_id).first()
        if existing and any(getattr(existing, key) != value for key, value in values.items()):
            raise HTTPException(status_code=409, detail='Submission ID already used for a different expense')
        return existing

    if body.id:
        existing = existing_submission()
        if existing:
            return existing
    expense = Expense(id=expense_id, **values)
    db.add(expense)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # The primary key also guards overlapping retries from separate requests.
        existing = existing_submission() if body.id else None
        if existing:
            return existing
        raise
    db.refresh(expense)
    return expense


@router.delete("/expenses/bulk")
def bulk_delete_expenses(
    month: str = Query(..., min_length=7, max_length=7,
                       pattern=EXPENSE_MONTH_PATTERN, description="Format: YYYY-MM"),
    userId: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Delete all expenses matching a month (and optionally userId)."""
    query = db.query(Expense).filter(Expense.date.like(f"{month}%"))
    if userId:
        query = query.filter(Expense.userId == userId)
    count = query.delete(synchronize_session=False)
    db.commit()
    return {"deleted": count}


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: str, db: Session = Depends(get_db)):
    """Delete a single expense by id."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
    return {"deleted": True}
