"""Job application CRUD, bulk delete, and statistics endpoints."""

import uuid
import pandas as pd
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import JobApplication
from schemas import (
    JobApplicationCreate, JobApplicationUpdate,
    JobApplicationResponse, EmploymentStatsResponse, JobStatusUpdate
)

router = APIRouter()


@router.get("/employment")
def get_applications(db: Session = Depends(get_db)):
    """Return all job applications ordered by appliedDate descending."""
    apps = db.query(JobApplication).order_by(JobApplication.appliedDate.desc()).all()
    return [JobApplicationResponse.model_validate(a) for a in apps]


@router.post("/employment", response_model=JobApplicationResponse, status_code=201)
def create_application(body: JobApplicationCreate, db: Session = Depends(get_db)):
    """Create a new job application."""
    app = JobApplication(id=str(uuid.uuid4()), **body.model_dump())
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


@router.put("/employment/{app_id}", response_model=JobApplicationResponse)
def update_application(app_id: str, body: JobApplicationUpdate, db: Session = Depends(get_db)):
    """Update a job application."""
    app = db.query(JobApplication).filter(JobApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(app, field, value)
    db.commit()
    db.refresh(app)
    return app


@router.patch("/employment/{app_id}/status", response_model=JobApplicationResponse)
def update_application_status(
    app_id: str,
    body: JobStatusUpdate,
    db: Session = Depends(get_db)
):
    """Update only the status of a job application."""
    app = db.query(JobApplication).filter(JobApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")
    app.status = body.status
    db.commit()
    db.refresh(app)
    return app


@router.delete("/employment/bulk")
def bulk_delete_applications(
    status: str = Query(..., description="Status to delete, or 'all'"),
    db: Session = Depends(get_db)
):
    """Delete all job applications by status, or all if status=='all'."""
    if status == "all":
        count = db.query(JobApplication).delete(synchronize_session=False)
    else:
        count = db.query(JobApplication).filter(
            JobApplication.status == status
        ).delete(synchronize_session=False)
    db.commit()
    return {"deleted": count}


@router.delete("/employment/{app_id}")
def delete_application(app_id: str, db: Session = Depends(get_db)):
    """Delete a single job application."""
    app = db.query(JobApplication).filter(JobApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")
    db.delete(app)
    db.commit()
    return {"deleted": True}


@router.get("/employment/stats", response_model=EmploymentStatsResponse)
def get_employment_stats(db: Session = Depends(get_db)):
    """Return aggregated job application statistics."""
    all_apps = db.query(JobApplication).all()
    total = len(all_apps)

    seven_days_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    this_week = sum(1 for a in all_apps if a.appliedDate >= seven_days_ago)

    interviews = sum(
        1 for a in all_apps
        if a.status in ("interview_scheduled", "interviewed")
    )
    offers = sum(1 for a in all_apps if a.status == "offered")

    # by_status aggregation
    by_status: dict = {}
    for a in all_apps:
        by_status[a.status] = by_status.get(a.status, 0) + 1

    # applications_by_month using pandas
    applications_by_month = []
    if all_apps:
        data = [{"month": a.appliedDate[:7], "id": a.id} for a in all_apps]
        df = pd.DataFrame(data)
        grouped = df.groupby("month")["id"].count().reset_index()
        grouped.columns = ["month", "count"]
        grouped = grouped.sort_values("month")
        applications_by_month = grouped.to_dict(orient="records")

    return EmploymentStatsResponse(
        total=total,
        this_week=this_week,
        interviews=interviews,
        offers=offers,
        by_status=by_status,
        applications_by_month=applications_by_month
    )
