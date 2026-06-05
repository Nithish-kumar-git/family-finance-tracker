"""Pandas-based analytics functions for monthly aggregation and trends."""

import pandas as pd
import calendar
from datetime import datetime, date
from sqlalchemy.orm import Session

from models import Expense, MonthlyIncome

VALID_CATEGORIES = [
    "groceries", "utilities", "medical", "transport", "household",
    "lic_premium", "chit_contribution", "personal", "education", "other"
]


def get_monthly_totals(db: Session, year: int, month: int) -> dict:
    """Return total income, expenses, and deficit for a given month."""
    month_prefix = f"{year:04d}-{month:02d}"
    expenses = db.query(Expense).filter(Expense.date.like(f"{month_prefix}%")).all()
    total_expenses = sum(e.amount for e in expenses) if expenses else 0.0

    income_row = db.query(MonthlyIncome).first()
    if income_row:
        total_income = (income_row.pension or 0) + (income_row.nithish or 0) + (income_row.abeerami or 0)
    else:
        total_income = 0.0

    return {
        "income": total_income,
        "expenses": total_expenses,
        "deficit": total_income - total_expenses
    }


def get_category_breakdown(db: Session, year: int, month: int) -> dict:
    """Return spending per expense category for a given month using pandas."""
    month_prefix = f"{year:04d}-{month:02d}"
    expenses = db.query(Expense).filter(Expense.date.like(f"{month_prefix}%")).all()

    # Initialise all 10 categories at zero
    result = {cat: 0.0 for cat in VALID_CATEGORIES}

    if expenses:
        data = [{"category": e.category, "amount": e.amount} for e in expenses]
        df = pd.DataFrame(data)
        if not df.empty:
            grouped = df.groupby("category")["amount"].sum().to_dict()
            for cat, total in grouped.items():
                if cat in result:
                    result[cat] = float(total)

    return result


def get_budget_vs_actual(db: Session, year: int, month: int, budgets: dict) -> list:
    """Compare actual spending against budget limits for each category."""
    actuals = get_category_breakdown(db, year, month)
    rows = []
    for cat in VALID_CATEGORIES:
        actual = actuals.get(cat, 0.0)
        budget = float(budgets.get(cat, 0.0))
        remaining = budget - actual
        pct_used = (actual / budget * 100) if budget > 0 else 0.0
        rows.append({
            "category": cat,
            "budget": budget,
            "actual": actual,
            "remaining": remaining,
            "pct_used": round(pct_used, 2)
        })
    return rows


def get_monthly_trend(db: Session, months: int = 6) -> list:
    """Return income, expenses, and deficit for each of the last N months."""
    today = date.today()
    result = []

    # Build list of (year, month) tuples for the past N months, ending at current
    targets = []
    y, m = today.year, today.month
    for _ in range(months):
        targets.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    targets.reverse()

    for (target_year, target_month) in targets:
        month_str = f"{target_year:04d}-{target_month:02d}"
        totals = get_monthly_totals(db, target_year, target_month)
        result.append({
            "month": month_str,
            "total_expenses": totals["expenses"],
            "total_income": totals["income"],
            "deficit": totals["deficit"]
        })

    return result
