=== FILE: backend/routers/assets.py ===
"""Asset CRUD endpoints for FDs, Mutual Funds, LIC, Chit Funds, and Gold."""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import FixedDeposit, MutualFund, LICPolicy, ChitFund, Gold
from schemas import (
    FixedDepositCreate, FixedDepositUpdate, FixedDepositResponse,
    MutualFundCreate, MutualFundUpdate, MutualFundResponse,
    LICPolicyCreate, LICPolicyUpdate, LICPolicyResponse,
    ChitFundCreate, ChitFundUpdate, ChitFundResponse,
    GoldUpdate, GoldResponse,
    AssetSummaryResponse, MFValueUpdate
)

router = APIRouter()


# ── Asset Summary ─────────────────────────────────────────────────────────────

@router.get("/assets/summary", response_model=AssetSummaryResponse)
def get_asset_summary(db: Session = Depends(get_db)):
    """Compute total corpus across FDs, mutual funds, and gold."""
    fds = db.query(FixedDeposit).all()
    fds_total = sum(fd.principal for fd in fds) if fds else 0.0

    mfs = db.query(MutualFund).all()
    mf_total = sum(mf.currentValue for mf in mfs) if mfs else 0.0

    gold_row = db.query(Gold).first()
    gold_total = (gold_row.weightGrams * gold_row.currentValuePerGram) if gold_row else 0.0

    return AssetSummaryResponse(
        fds=fds_total,
        mutual_funds=mf_total,
        gold=gold_total,
        total=fds_total + mf_total + gold_total
    )


# ── Fixed Deposits ────────────────────────────────────────────────────────────

@router.get("/assets/fixeddeposits")
def get_fds(db: Session = Depends(get_db)):
    fds = db.query(FixedDeposit).all()
    return [FixedDepositResponse.model_validate(fd) for fd in fds]


@router.post("/assets/fixeddeposits", response_model=FixedDepositResponse, status_code=201)
def create_fd(body: FixedDepositCreate, db: Session = Depends(get_db)):
    fd = FixedDeposit(id=str(uuid.uuid4()), **body.model_dump())
    db.add(fd)
    db.commit()
    db.refresh(fd)
    return fd


@router.put("/assets/fixeddeposits/{fd_id}", response_model=FixedDepositResponse)
def update_fd(fd_id: str, body: FixedDepositUpdate, db: Session = Depends(get_db)):
    fd = db.query(FixedDeposit).filter(FixedDeposit.id == fd_id).first()
    if not fd:
        raise HTTPException(status_code=404, detail="Fixed deposit not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(fd, field, value)
    db.commit()
    db.refresh(fd)
    return fd


@router.delete("/assets/fixeddeposits/{fd_id}")
def delete_fd(fd_id: str, db: Session = Depends(get_db)):
    fd = db.query(FixedDeposit).filter(FixedDeposit.id == fd_id).first()
    if not fd:
        raise HTTPException(status_code=404, detail="Fixed deposit not found")
    db.delete(fd)
    db.commit()
    return {"deleted": True}


# ── Mutual Funds ──────────────────────────────────────────────────────────────

@router.get("/assets/mutualfunds")
def get_mfs(db: Session = Depends(get_db)):
    mfs = db.query(MutualFund).all()
    return [MutualFundResponse.model_validate(mf) for mf in mfs]


@router.post("/assets/mutualfunds", response_model=MutualFundResponse, status_code=201)
def create_mf(body: MutualFundCreate, db: Session = Depends(get_db)):
    mf = MutualFund(id=str(uuid.uuid4()), **body.model_dump())
    db.add(mf)
    db.commit()
    db.refresh(mf)
    return mf


@router.put("/assets/mutualfunds/{mf_id}", response_model=MutualFundResponse)
def update_mf(mf_id: str, body: MutualFundUpdate, db: Session = Depends(get_db)):
    mf = db.query(MutualFund).filter(MutualFund.id == mf_id).first()
    if not mf:
        raise HTTPException(status_code=404, detail="Mutual fund not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(mf, field, value)
    db.commit()
    db.refresh(mf)
    return mf


@router.patch("/assets/mutualfunds/{mf_id}/update-value", response_model=MutualFundResponse)
def update_mf_value(mf_id: str, body: MFValueUpdate, db: Session = Depends(get_db)):
    """Update only the currentValue field of a mutual fund."""
    mf = db.query(MutualFund).filter(MutualFund.id == mf_id).first()
    if not mf:
        raise HTTPException(status_code=404, detail="Mutual fund not found")
    mf.currentValue = body.currentValue
    db.commit()
    db.refresh(mf)
    return mf


@router.delete("/assets/mutualfunds/{mf_id}")
def delete_mf(mf_id: str, db: Session = Depends(get_db)):
    mf = db.query(MutualFund).filter(MutualFund.id == mf_id).first()
    if not mf:
        raise HTTPException(status_code=404, detail="Mutual fund not found")
    db.delete(mf)
    db.commit()
    return {"deleted": True}


# ── LIC Policies ──────────────────────────────────────────────────────────────

@router.get("/assets/lic")
def get_lic(db: Session = Depends(get_db)):
    policies = db.query(LICPolicy).all()
    return [LICPolicyResponse.model_validate(p) for p in policies]


@router.post("/assets/lic", response_model=LICPolicyResponse, status_code=201)
def create_lic(body: LICPolicyCreate, db: Session = Depends(get_db)):
    policy = LICPolicy(id=str(uuid.uuid4()), **body.model_dump())
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


@router.put("/assets/lic/{lic_id}", response_model=LICPolicyResponse)
def update_lic(lic_id: str, body: LICPolicyUpdate, db: Session = Depends(get_db)):
    policy = db.query(LICPolicy).filter(LICPolicy.id == lic_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="LIC policy not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(policy, field, value)
    db.commit()
    db.refresh(policy)
    return policy


@router.patch("/assets/lic/{lic_id}/mark-paid", response_model=LICPolicyResponse)
def mark_lic_paid(lic_id: str, db: Session = Depends(get_db)):
    """Increment premiumsPaid by 1 and advance nextDueDate by exactly 12 months."""
    policy = db.query(LICPolicy).filter(LICPolicy.id == lic_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="LIC policy not found")

    policy.premiumsPaid = (policy.premiumsPaid or 0) + 1

    # Advance nextDueDate by 12 months using safe month arithmetic
    try:
        from datetime import date as date_type
        parts = policy.nextDueDate.split("-")
        d = date_type(int(parts[0]), int(parts[1]), int(parts[2]))
        new_month = d.month + 12
        new_year = d.year + (new_month - 1) // 12
        new_month = ((new_month - 1) % 12) + 1
        # Handle month-end edge cases (e.g. Jan 31 → Feb 28)
        import calendar
        max_day = calendar.monthrange(new_year, new_month)[1]
        new_day = min(d.day, max_day)
        policy.nextDueDate = f"{new_year:04d}-{new_month:02d}-{new_day:02d}"
    except (ValueError, IndexError):
        # If date parsing fails, leave nextDueDate unchanged
        pass

    db.commit()
    db.refresh(policy)
    return policy


@router.delete("/assets/lic/{lic_id}")
def delete_lic(lic_id: str, db: Session = Depends(get_db)):
    policy = db.query(LICPolicy).filter(LICPolicy.id == lic_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="LIC policy not found")
    db.delete(policy)
    db.commit()
    return {"deleted": True}


# ── Chit Funds ────────────────────────────────────────────────────────────────

@router.get("/assets/chitfunds")
def get_chits(db: Session = Depends(get_db)):
    chits = db.query(ChitFund).all()
    return [ChitFundResponse.model_validate(c) for c in chits]


@router.post("/assets/chitfunds", response_model=ChitFundResponse, status_code=201)
def create_chit(body: ChitFundCreate, db: Session = Depends(get_db)):
    chit = ChitFund(id=str(uuid.uuid4()), **body.model_dump())
    db.add(chit)
    db.commit()
    db.refresh(chit)
    return chit


@router.put("/assets/chitfunds/{chit_id}", response_model=ChitFundResponse)
def update_chit(chit_id: str, body: ChitFundUpdate, db: Session = Depends(get_db)):
    chit = db.query(ChitFund).filter(ChitFund.id == chit_id).first()
    if not chit:
        raise HTTPException(status_code=404, detail="Chit fund not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(chit, field, value)
    db.commit()
    db.refresh(chit)
    return chit


@router.delete("/assets/chitfunds/{chit_id}")
def delete_chit(chit_id: str, db: Session = Depends(get_db)):
    chit = db.query(ChitFund).filter(ChitFund.id == chit_id).first()
    if not chit:
        raise HTTPException(status_code=404, detail="Chit fund not found")
    db.delete(chit)
    db.commit()
    return {"deleted": True}


# ── Gold ──────────────────────────────────────────────────────────────────────

@router.patch("/assets/gold", response_model=GoldResponse)
def update_gold(body: GoldUpdate, db: Session = Depends(get_db)):
    """Upsert gold record — update existing or insert if none exists."""
    gold = db.query(Gold).first()
    if gold:
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(gold, field, value)
    else:
        data = body.model_dump(exclude_unset=True)
        gold = Gold(id=str(uuid.uuid4()), **data)
        db.add(gold)
    db.commit()
    db.refresh(gold)
    return gold
=== END: backend/routers/assets.py ===
=== FILE: familyfinancetracker/src/hooks/useAssets.js ===
// Hook for loading and computing asset data.
// Primary data source: api.assets.getAll()
// Fallback (offline): Zustand store fields.
import { useCallback } from 'react'

import { api } from '../utils/api'
import { daysUntil } from '../utils/formatters'
import useStore from '../store/useStore'

export const useAssets = () => {
  /**
   * loadAssets — fetch all 4 asset types from the backend.
   * Falls back to store data if the API is unreachable.
   */
  const loadAssets = useCallback(async () => {
    const fromApi = (obj) => {
      if (!obj || typeof obj !== 'object') return obj
      if (Array.isArray(obj)) return obj.map(fromApi)
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [
          k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
          Array.isArray(v) ? v.map(i =>
            typeof i === 'object' ? fromApi(i) : i) : v,
        ])
      )
    }

    const BASE_URL = typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_API_URL ?? 'http://localhost:8000')
      : 'http://localhost:8000'

    try {
      const [fds, mfs, lics, chits] = await Promise.all([
        fetch(`${BASE_URL}/api/assets/fixeddeposits`).then(r => r.json()),
        fetch(`${BASE_URL}/api/assets/mutualfunds`).then(r => r.json()),
        fetch(`${BASE_URL}/api/assets/lic`).then(r => r.json()),
        fetch(`${BASE_URL}/api/assets/chitfunds`).then(r => r.json()),
      ])
      const result = {
        fixedDeposits: fromApi(fds),
        mutualFunds: fromApi(mfs),
        licPolicies: fromApi(lics),
        chitFunds: fromApi(chits),
      }
      // Save to store so localStorage is always in sync with server
      useStore.setState(result)
      return result
    } catch {
      // API unreachable — use localStorage data
      const s = useStore.getState()
      return {
        fixedDeposits: s.fixedDeposits ?? [],
        mutualFunds: s.mutualFunds ?? [],
        licPolicies: s.licPolicies ?? [],
        chitFunds: s.chitFunds ?? [],
      }
    }
  }, [])

  /**
   * getTotalCorpus — pure function, no API call.
   * Computes totals from the provided data.
   */
  const getTotalCorpus = (fixedDeposits, mutualFunds, gold) => {
    const fds = fixedDeposits.reduce((sum, fd) => sum + fd.principal, 0)
    const mfs = mutualFunds.reduce((sum, mf) => sum + mf.currentValue, 0)
    const goldTotal = gold.weightGrams * gold.currentValuePerGram
    return {
      fds,
      mfs,
      gold: goldTotal,
      total: fds + mfs + goldTotal,
    }
  }

  /**
   * getUpcomingFDMaturities — pure function.
   * Returns FDs maturing within `days` days, sorted ascending.
   */
  const getUpcomingFDMaturities = (fixedDeposits, days = 90) => {
    return fixedDeposits
      .filter((fd) => {
        const d = daysUntil(fd.maturityDate)
        return d !== null && d >= 0 && d <= days
      })
      .sort(
        (a, b) => new Date(a.maturityDate) - new Date(b.maturityDate)
      )
  }

  /**
   * getUpcomingLICDues — pure function.
   * Returns LIC policies due within `days` days, sorted ascending.
   */
  const getUpcomingLICDues = (licPolicies, days = 60) => {
    return licPolicies
      .filter((lic) => {
        const d = daysUntil(lic.nextDueDate)
        return d !== null && d >= 0 && d <= days
      })
      .sort(
        (a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate)
      )
  }

  return { loadAssets, getTotalCorpus, getUpcomingFDMaturities, getUpcomingLICDues }
}
=== END: familyfinancetracker/src/hooks/useAssets.js ===
