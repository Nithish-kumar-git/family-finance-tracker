"""Monthly snapshot save and retrieval endpoints."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import MonthlySnapshot
from schemas import MonthlySnapshotCreate, MonthlySnapshotResponse

router = APIRouter()


@router.post("/reports/snapshot", response_model=MonthlySnapshotResponse)
def save_snapshot(body: MonthlySnapshotCreate, db: Session = Depends(get_db)):
    """Upsert a monthly snapshot — update if same month exists, insert if new."""
    existing = db.query(MonthlySnapshot).filter(MonthlySnapshot.month == body.month).first()
    if existing:
        for field, value in body.model_dump().items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing
    snapshot = MonthlySnapshot(id=str(uuid.uuid4()), **body.model_dump())
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.get("/reports/snapshot", response_model=MonthlySnapshotResponse)
def get_snapshot(month: str = Query(..., description="Format: YYYY-MM"), db: Session = Depends(get_db)):
    """Retrieve the snapshot for a given month."""
    snapshot = db.query(MonthlySnapshot).filter(MonthlySnapshot.month == month).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found for this month")
    return snapshot


@router.get("/reports/snapshots")
def get_all_snapshots(db: Session = Depends(get_db)):
    """Return all monthly snapshots ordered by month descending."""
    snapshots = db.query(MonthlySnapshot).order_by(MonthlySnapshot.month.desc()).all()
    return [MonthlySnapshotResponse.model_validate(s) for s in snapshots]
