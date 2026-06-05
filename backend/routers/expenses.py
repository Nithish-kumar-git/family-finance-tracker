"""Expense CRUD endpoints with pandas category aggregation."""

import uuid
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Expense
from schemas import ExpenseCreate, ExpenseResponse

router = APIRouter()

VALID_CATEGORIES = [
    "groceries", "utilities", "medical", "transport", "household",
    "lic_premium", "chit_contribution", "personal", "education", "other"
]


@router.get("/expenses")
def get_expenses(
    month: str = Query(..., description="Format: YYYY-MM"),
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
    expense = Expense(id=str(uuid.uuid4()), **body.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/expenses/bulk")
def bulk_delete_expenses(
    month: str = Query(..., description="Format: YYYY-MM"),
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
