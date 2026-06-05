"""Milestone CRUD with status update and filtered queries."""

import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Milestone
from schemas import MilestoneCreate, MilestoneResponse, MilestoneStatusUpdate

router = APIRouter()


@router.get("/milestones")
def get_milestones(
    status: Optional[str] = Query(None),
    upcoming_days: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Return milestones with optional status and upcoming_days filters."""
    query = db.query(Milestone)
    if status:
        query = query.filter(Milestone.status == status)
    if upcoming_days is not None:
        cutoff = (datetime.utcnow() + timedelta(days=upcoming_days)).strftime("%Y-%m-%d")
        query = query.filter(Milestone.date <= cutoff, Milestone.status == "pending")
    milestones = query.order_by(Milestone.date.asc()).all()
    return [MilestoneResponse.model_validate(m) for m in milestones]


@router.post("/milestones", response_model=MilestoneResponse, status_code=201)
def create_milestone(body: MilestoneCreate, db: Session = Depends(get_db)):
    """Create a new milestone."""
    milestone = Milestone(id=str(uuid.uuid4()), **body.model_dump())
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return milestone


@router.patch("/milestones/{milestone_id}/status", response_model=MilestoneResponse)
def update_milestone_status(
    milestone_id: str,
    body: MilestoneStatusUpdate,
    db: Session = Depends(get_db)
):
    """Update milestone status. Sets completedAt when status is 'done'."""
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    milestone.status = body.status
    if body.status == "done":
        milestone.completedAt = datetime.utcnow()
    else:
        milestone.completedAt = None
    db.commit()
    db.refresh(milestone)
    return milestone


@router.delete("/milestones/{milestone_id}")
def delete_milestone(milestone_id: str, db: Session = Depends(get_db)):
    """Delete a milestone by id."""
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    db.delete(milestone)
    db.commit()
    return {"deleted": True}
