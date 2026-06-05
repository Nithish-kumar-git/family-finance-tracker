"""Pydantic request/response schemas for all API endpoints."""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime


# ── User ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    id: str
    name: str
    pin: str
    color: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    pin: Optional[str] = None
    color: Optional[str] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    pin: str
    color: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── Expense ───────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    userId: str
    amount: float
    category: str
    description: Optional[str] = None
    date: str
    isRecurring: bool = False


class ExpenseUpdate(BaseModel):
    userId: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    isRecurring: Optional[bool] = None


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    userId: str
    amount: float
    category: str
    description: Optional[str] = None
    date: str
    isRecurring: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── Budget ────────────────────────────────────────────────────────────────────

class BudgetCreate(BaseModel):
    category: str
    monthlyLimit: float


class BudgetUpdate(BaseModel):
    category: Optional[str] = None
    monthlyLimit: Optional[float] = None


class BudgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    category: str
    monthlyLimit: float
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── FixedDeposit ──────────────────────────────────────────────────────────────

class FixedDepositCreate(BaseModel):
    bank: str
    holders: List[str]
    principal: float
    rate: float
    startDate: Optional[str] = None
    maturityDate: str
    purpose: str
    notes: Optional[str] = None


class FixedDepositUpdate(BaseModel):
    bank: Optional[str] = None
    holders: Optional[List[str]] = None
    principal: Optional[float] = None
    rate: Optional[float] = None
    startDate: Optional[str] = None
    maturityDate: Optional[str] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None


class FixedDepositResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    bank: str
    holders: List[str]
    principal: float
    rate: float
    startDate: Optional[str] = None
    maturityDate: str
    purpose: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── MutualFund ────────────────────────────────────────────────────────────────

class MutualFundCreate(BaseModel):
    name: str
    platform: Optional[str] = None
    investedAmount: float = 0
    currentValue: float = 0
    purchaseDate: Optional[str] = None
    planType: str
    type: str
    notes: Optional[str] = None


class MutualFundUpdate(BaseModel):
    name: Optional[str] = None
    platform: Optional[str] = None
    investedAmount: Optional[float] = None
    currentValue: Optional[float] = None
    purchaseDate: Optional[str] = None
    planType: Optional[str] = None
    type: Optional[str] = None
    notes: Optional[str] = None


class MutualFundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    platform: Optional[str] = None
    investedAmount: float
    currentValue: float
    purchaseDate: Optional[str] = None
    planType: str
    type: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── LICPolicy ─────────────────────────────────────────────────────────────────

class LICPolicyCreate(BaseModel):
    insured: str
    plan: str
    annualPremium: float
    nextDueDate: str
    premiumsPaid: int = 0
    paidUpEligibleDate: Optional[str] = None
    notes: Optional[str] = None


class LICPolicyUpdate(BaseModel):
    insured: Optional[str] = None
    plan: Optional[str] = None
    annualPremium: Optional[float] = None
    nextDueDate: Optional[str] = None
    premiumsPaid: Optional[int] = None
    paidUpEligibleDate: Optional[str] = None
    notes: Optional[str] = None


class LICPolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    insured: str
    plan: str
    annualPremium: float
    nextDueDate: str
    premiumsPaid: int
    paidUpEligibleDate: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── ChitFund ──────────────────────────────────────────────────────────────────

class ChitFundCreate(BaseModel):
    organizer: str
    monthlyContribution: float = 0
    expectedPrize: float
    completionDate: str
    status: str = "active"
    notes: Optional[str] = None


class ChitFundUpdate(BaseModel):
    organizer: Optional[str] = None
    monthlyContribution: Optional[float] = None
    expectedPrize: Optional[float] = None
    completionDate: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ChitFundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organizer: str
    monthlyContribution: float
    expectedPrize: float
    completionDate: str
    status: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── Gold ──────────────────────────────────────────────────────────────────────

class GoldCreate(BaseModel):
    weightGrams: float
    currentValuePerGram: float
    lastUpdated: Optional[str] = None
    notes: Optional[str] = None


class GoldUpdate(BaseModel):
    weightGrams: Optional[float] = None
    currentValuePerGram: Optional[float] = None
    lastUpdated: Optional[str] = None
    notes: Optional[str] = None


class GoldResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    weightGrams: float
    currentValuePerGram: float
    lastUpdated: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── EmergencyFund ─────────────────────────────────────────────────────────────

class EmergencyFundCreate(BaseModel):
    target: float
    liquidFundBalance: float = 0
    cashInBank: float = 0
    isIsolated: bool = False
    rule: Optional[str] = None


class EmergencyFundUpdate(BaseModel):
    target: Optional[float] = None
    liquidFundBalance: Optional[float] = None
    cashInBank: Optional[float] = None
    isIsolated: Optional[bool] = None
    rule: Optional[str] = None


class EmergencyFundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    target: float
    liquidFundBalance: float
    cashInBank: float
    isIsolated: bool
    rule: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── MonthlyIncome ─────────────────────────────────────────────────────────────

class MonthlyIncomeCreate(BaseModel):
    pension: float = 0
    nithish: float = 0
    abeerami: float = 0


class MonthlyIncomeUpdate(BaseModel):
    pension: Optional[float] = None
    nithish: Optional[float] = None
    abeerami: Optional[float] = None


class MonthlyIncomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    pension: float
    nithish: float
    abeerami: float
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── Milestone ─────────────────────────────────────────────────────────────────

class MilestoneCreate(BaseModel):
    title: str
    date: str
    category: str
    status: str = "pending"
    amount: Optional[float] = None
    isUrgent: bool = False
    isDangerous: bool = False
    notes: Optional[str] = None


class MilestoneUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    amount: Optional[float] = None
    isUrgent: Optional[bool] = None
    isDangerous: Optional[bool] = None
    notes: Optional[str] = None


class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    date: str
    category: str
    status: str
    amount: Optional[float] = None
    isUrgent: bool
    isDangerous: bool
    notes: Optional[str] = None
    completedAt: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── JobApplication ────────────────────────────────────────────────────────────

class JobApplicationCreate(BaseModel):
    company: str
    role: str
    platform: str
    appliedDate: str
    status: str = "applied"
    followUpDate: Optional[str] = None
    notes: Optional[str] = None


class JobApplicationUpdate(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    platform: Optional[str] = None
    appliedDate: Optional[str] = None
    status: Optional[str] = None
    followUpDate: Optional[str] = None
    notes: Optional[str] = None


class JobApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company: str
    role: str
    platform: str
    appliedDate: str
    status: str
    followUpDate: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── MonthlySnapshot ───────────────────────────────────────────────────────────

class MonthlySnapshotCreate(BaseModel):
    month: str
    totalIncome: float = 0
    totalExpenses: float = 0
    deficit: float = 0
    corpusTotal: float = 0
    emergencyFundBalance: float = 0
    milestonesDone: int = 0
    milestonesOverdue: int = 0
    notes: Optional[str] = None


class MonthlySnapshotUpdate(BaseModel):
    month: Optional[str] = None
    totalIncome: Optional[float] = None
    totalExpenses: Optional[float] = None
    deficit: Optional[float] = None
    corpusTotal: Optional[float] = None
    emergencyFundBalance: Optional[float] = None
    milestonesDone: Optional[int] = None
    milestonesOverdue: Optional[int] = None
    notes: Optional[str] = None


class MonthlySnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    month: str
    totalIncome: float
    totalExpenses: float
    deficit: float
    corpusTotal: float
    emergencyFundBalance: float
    milestonesDone: int
    milestonesOverdue: int
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ── Additional response schemas ───────────────────────────────────────────────

class AssetSummaryResponse(BaseModel):
    fds: float
    mutual_funds: float
    gold: float
    total: float


class EmploymentStatsResponse(BaseModel):
    total: int
    this_week: int
    interviews: int
    offers: int
    by_status: Dict[str, int]
    applications_by_month: List[Dict[str, Any]]


class ParseTransactionResponse(BaseModel):
    amount: float
    category: str
    description: str
    confidence: float


class MonthlyInsightsResponse(BaseModel):
    insights: List[str]


class ChatResponse(BaseModel):
    answer: str


class ResetResponse(BaseModel):
    reset: bool
    tables_cleared: List[str]
    timestamp: str


# ── AI request schemas ────────────────────────────────────────────────────────

class ParseTransactionRequest(BaseModel):
    raw_text: str


class MonthlyInsightsRequest(BaseModel):
    report: Dict[str, Any]


class ChatRequest(BaseModel):
    question: str
    context: Dict[str, Any]
    history: List[Dict[str, Any]]


# ── Status update schemas ─────────────────────────────────────────────────────

class MilestoneStatusUpdate(BaseModel):
    status: str


class JobStatusUpdate(BaseModel):
    status: str


class MFValueUpdate(BaseModel):
    currentValue: float
