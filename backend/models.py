"""SQLAlchemy ORM models for all FamilyFinanceTracker entities."""

import uuid
from sqlalchemy import (
    Column, String, Float, Boolean, DateTime, Integer, JSON, Numeric
)
from sqlalchemy.sql import func
from database import Base


def _uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    pin = Column(String, nullable=False)
    color = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String, primary_key=True, default=_uuid)
    userId = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    date = Column(String, nullable=False)  # stored as 'YYYY-MM-DD' string
    isRecurring = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(String, primary_key=True, default=_uuid)
    category = Column(String, nullable=False, unique=True)
    monthlyLimit = Column(Float, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class FixedDeposit(Base):
    __tablename__ = "fixed_deposits"

    id = Column(String, primary_key=True, default=_uuid)
    bank = Column(String, nullable=False)
    holders = Column(JSON, nullable=False)  # JSON array of strings
    principal = Column(Float, nullable=False)
    rate = Column(Float, nullable=False)
    startDate = Column(String, nullable=True)
    maturityDate = Column(String, nullable=False)
    purpose = Column(String, nullable=False)  # emergency|marriage|renovation|core
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class MutualFund(Base):
    __tablename__ = "mutual_funds"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    platform = Column(String, nullable=True)
    investedAmount = Column(Float, nullable=False, default=0)
    currentValue = Column(Float, nullable=False, default=0)
    purchaseDate = Column(String, nullable=True)
    planType = Column(String, nullable=False)  # direct|regular
    type = Column(String, nullable=False)       # equity|debt|hybrid
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class LICPolicy(Base):
    __tablename__ = "lic_policies"

    id = Column(String, primary_key=True, default=_uuid)
    insured = Column(String, nullable=False)
    plan = Column(String, nullable=False)
    annualPremium = Column(Float, nullable=False)
    nextDueDate = Column(String, nullable=False)
    premiumsPaid = Column(Integer, nullable=False, default=0)
    paidUpEligibleDate = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ChitFund(Base):
    __tablename__ = "chit_funds"

    id = Column(String, primary_key=True, default=_uuid)
    organizer = Column(String, nullable=False)
    monthlyContribution = Column(Float, nullable=False, default=0)
    expectedPrize = Column(Float, nullable=False)
    completionDate = Column(String, nullable=False)
    status = Column(String, nullable=False, default="active")  # active|completed|defaulted
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Gold(Base):
    __tablename__ = "gold"

    id = Column(String, primary_key=True, default=_uuid)
    weightGrams = Column(Float, nullable=False)
    currentValuePerGram = Column(Float, nullable=False)
    lastUpdated = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class EmergencyFund(Base):
    __tablename__ = "emergency_fund"

    id = Column(String, primary_key=True, default=_uuid)
    target = Column(Float, nullable=False)
    liquidFundBalance = Column(Float, nullable=False, default=0)
    cashInBank = Column(Float, nullable=False, default=0)
    isIsolated = Column(Boolean, default=False)
    rule = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class MonthlyIncome(Base):
    __tablename__ = "monthly_income"

    id = Column(String, primary_key=True, default=_uuid)
    pension = Column(Float, nullable=False, default=0)
    nithish = Column(Float, nullable=False, default=0)
    abeerami = Column(Float, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String, nullable=False)
    date = Column(String, nullable=False)
    category = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending|done|skipped
    amount = Column(Float, nullable=True)
    isUrgent = Column(Boolean, default=False)
    isDangerous = Column(Boolean, default=False)
    notes = Column(String, nullable=True)
    completedAt = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(String, primary_key=True, default=_uuid)
    company = Column(String, nullable=False)
    role = Column(String, nullable=False)
    platform = Column(String, nullable=False)
    appliedDate = Column(String, nullable=False)
    status = Column(String, nullable=False, default="applied")
    followUpDate = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class MonthlySnapshot(Base):
    __tablename__ = "monthly_snapshots"

    id = Column(String, primary_key=True, default=_uuid)
    month = Column(String, nullable=False, unique=True)  # YYYY-MM
    totalIncome = Column(Float, nullable=False, default=0)
    totalExpenses = Column(Float, nullable=False, default=0)
    deficit = Column(Float, nullable=False, default=0)
    corpusTotal = Column(Float, nullable=False, default=0)
    emergencyFundBalance = Column(Float, nullable=False, default=0)
    milestonesDone = Column(Integer, nullable=False, default=0)
    milestonesOverdue = Column(Integer, nullable=False, default=0)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
