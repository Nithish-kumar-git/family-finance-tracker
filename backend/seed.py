"""One-time seed script: creates tables and inserts initial family data."""

if __name__ == "__main__":
    from database import Base, engine, SessionLocal
    import models  # noqa: F401 — ensures all models are registered with Base.metadata

    print("Creating tables...")
    Base.metadata.create_all(engine)
    print("Tables created.")

    db = SessionLocal()
    try:
        import uuid

        # ── Users ─────────────────────────────────────────────────────────
        from models import User
        if db.query(User).count() == 0:
            users = [
                User(id="mother",   name="Amma",     pin="1111", color="#7C3AED"),
                User(id="nithish",  name="Nithish",  pin="2222", color="#0891B2"),
                User(id="abeerami", name="Abeerami", pin="3333", color="#059669"),
            ]
            db.add_all(users)
            print("Users seeded.")

        # ── Monthly Income ────────────────────────────────────────────────
        from models import MonthlyIncome
        if db.query(MonthlyIncome).count() == 0:
            db.add(MonthlyIncome(
                id=str(uuid.uuid4()),
                pension=37604,
                nithish=0,
                abeerami=0
            ))
            print("Monthly income seeded.")

        # ── Emergency Fund ────────────────────────────────────────────────
        from models import EmergencyFund
        if db.query(EmergencyFund).count() == 0:
            db.add(EmergencyFund(
                id=str(uuid.uuid4()),
                target=420000,
                liquidFundBalance=350000,
                cashInBank=70000,
                isIsolated=False,
                rule="Touch ONLY for: medical emergency, roof collapse, or 3+ months zero income."
            ))
            print("Emergency fund seeded.")

        # ── Gold ──────────────────────────────────────────────────────────
        from models import Gold
        if db.query(Gold).count() == 0:
            db.add(Gold(
                id=str(uuid.uuid4()),
                weightGrams=8,
                currentValuePerGram=14650,
                lastUpdated="",
                notes="22K physical jewellery. Zero yield. Sale costs 5-10% in deductions."
            ))
            print("Gold seeded.")

        # ── Budgets ───────────────────────────────────────────────────────
        from models import Budget
        if db.query(Budget).count() == 0:
            budget_data = [
                ("groceries",          20000),
                ("utilities",           3000),
                ("medical",             3000),
                ("transport",           3000),
                ("household",           2000),
                ("lic_premium",         3031),
                ("chit_contribution",      0),
                ("personal",            5000),
                ("education",           2000),
                ("other",               5000),
            ]
            for category, limit in budget_data:
                db.add(Budget(id=str(uuid.uuid4()), category=category, monthlyLimit=limit))
            print("Budgets seeded.")

        # ── Fixed Deposits ────────────────────────────────────────────────
        from models import FixedDeposit
        if db.query(FixedDeposit).count() == 0:
            fds = [
                FixedDeposit(
                    id="fd1", bank="Canara Bank", holders=["mother"],
                    principal=600000, rate=6.45, startDate="",
                    maturityDate="2026-10-15", purpose="marriage",
                    notes="Do NOT renew. Move to marriage fund account at maturity."
                ),
                FixedDeposit(
                    id="fd2", bank="Canara Bank", holders=["mother"],
                    principal=600000, rate=6.45, startDate="",
                    maturityDate="2026-12-20", purpose="marriage",
                    notes="Do NOT renew. Complete marriage budget funding."
                ),
                FixedDeposit(
                    id="fd3", bank="Canara Bank", holders=["mother"],
                    principal=315000, rate=6.25, startDate="",
                    maturityDate="2027-03-10", purpose="renovation",
                    notes="Renovation Phase 1 funding."
                ),
            ]
            db.add_all(fds)
            print("Fixed deposits seeded.")

        # ── Mutual Funds ──────────────────────────────────────────────────
        from models import MutualFund
        if db.query(MutualFund).count() == 0:
            mfs = [
                MutualFund(
                    id="mf1", name="UTI Nifty 50 Index Fund Direct Growth",
                    platform="Groww", investedAmount=0, currentValue=0,
                    purchaseDate="", planType="direct", type="equity", notes=""
                ),
                MutualFund(
                    id="mf2", name="Parag Parikh Flexi Cap Fund Direct Growth",
                    platform="Groww", investedAmount=0, currentValue=0,
                    purchaseDate="", planType="direct", type="equity", notes=""
                ),
                MutualFund(
                    id="mf3", name="ICICI Pru Large & Mid Cap Regular Growth",
                    platform="", investedAmount=59997, currentValue=59304,
                    purchaseDate="2025-07-03", planType="regular", type="equity",
                    notes="SWITCH TO DIRECT on or after 04 Jul 2026. Tax: Rs.0 (LTCG below exemption)."
                ),
                MutualFund(
                    id="mf4", name="ICICI Pru Multi Asset Allocation Regular Growth",
                    platform="", investedAmount=39998, currentValue=42084,
                    purchaseDate="2025-07-03", planType="regular", type="hybrid",
                    notes="SWITCH TO DIRECT on or after 04 Jul 2026. Verify equity allocation >65% first."
                ),
                MutualFund(
                    id="mf5", name="HDFC Balanced Advantage Fund Direct Growth",
                    platform="Groww", investedAmount=0, currentValue=0,
                    purchaseDate="", planType="direct", type="hybrid", notes=""
                ),
                MutualFund(
                    id="mf6", name="Mirae Asset Liquid Fund Direct Growth",
                    platform="Groww", investedAmount=350000, currentValue=350000,
                    purchaseDate="", planType="direct", type="debt",
                    notes="EMERGENCY FUND. Do NOT redeem unless genuine emergency."
                ),
            ]
            db.add_all(mfs)
            print("Mutual funds seeded.")

        # ── LIC Policies ──────────────────────────────────────────────────
        from models import LICPolicy
        if db.query(LICPolicy).count() == 0:
            policies = [
                LICPolicy(
                    id="lic1", insured="nithish", plan="Jeevan Labh Plan 736",
                    annualPremium=18150, nextDueDate="2026-08-25",
                    premiumsPaid=0, paidUpEligibleDate="",
                    notes="Pay premiums only. Do not surrender before paid-up date."
                ),
                LICPolicy(
                    id="lic2", insured="abeerami", plan="Jeevan Labh Plan 736",
                    annualPremium=18225, nextDueDate="2026-08-25",
                    premiumsPaid=0, paidUpEligibleDate="",
                    notes="Pay premiums only. Do not surrender before paid-up date."
                ),
            ]
            db.add_all(policies)
            print("LIC policies seeded.")

        # ── Chit Funds ────────────────────────────────────────────────────
        from models import ChitFund
        if db.query(ChitFund).count() == 0:
            chits = [
                ChitFund(
                    id="chit1", organizer="Nadar Sangam", monthlyContribution=0,
                    expectedPrize=277000, completionDate="2027-04-30", status="active",
                    notes="Verify monthly contribution amount with organiser."
                ),
                ChitFund(
                    id="chit2", organizer="Nadar Sangam", monthlyContribution=0,
                    expectedPrize=280000, completionDate="2027-06-30", status="active",
                    notes="Verify monthly contribution amount with organiser."
                ),
                ChitFund(
                    id="chit3", organizer="Nadar Sangam", monthlyContribution=0,
                    expectedPrize=280000, completionDate="2028-01-31", status="active",
                    notes="Verify monthly contribution amount with organiser."
                ),
            ]
            db.add_all(chits)
            print("Chit funds seeded.")

        # ── Milestones ────────────────────────────────────────────────────
        from models import Milestone
        if db.query(Milestone).count() == 0:
            milestones = [
                Milestone(
                    id="m1",
                    title="Resolve U1: Form 15G or Form 121 valid today?",
                    date="2026-06-07", category="form_submission",
                    status="pending", amount=None, isUrgent=True, isDangerous=True,
                    notes="Call Canara Bank branch. Ask: which TDS exemption form is valid FY2026-27?"
                ),
                Milestone(
                    id="m2",
                    title="Submit TDS exemption form at Canara Bank",
                    date="2026-06-28", category="form_submission",
                    status="pending", amount=None, isUrgent=True, isDangerous=True,
                    notes="Submit before first FD interest credit. Get stamped acknowledgement copy."
                ),
                Milestone(
                    id="m3",
                    title="Open Mother Groww account (KYC complete)",
                    date="2026-06-14", category="account_setup",
                    status="pending", amount=None, isUrgent=True, isDangerous=False, notes=""
                ),
                Milestone(
                    id="m4",
                    title="Open Abeerami Groww account (KYC complete)",
                    date="2026-06-14", category="account_setup",
                    status="pending", amount=None, isUrgent=True, isDangerous=False, notes=""
                ),
                Milestone(
                    id="m5",
                    title="Isolate emergency fund - Rs.3.5L to Mirae Liquid",
                    date="2026-06-21", category="account_setup",
                    status="pending", amount=350000, isUrgent=True, isDangerous=True,
                    notes="Transfer Rs.3.5L to Mirae Asset Liquid Fund Direct via Mother Groww account."
                ),
                Milestone(
                    id="m6",
                    title="ICICI Regular to Direct switch (both funds)",
                    date="2026-07-04", category="other",
                    status="pending", amount=101388, isUrgent=True, isDangerous=False,
                    notes="Redeem both ICICI Regular plans. Purchase Direct equivalents same day."
                ),
                Milestone(
                    id="m7",
                    title="LIC Premium - Nithish + Abeerami (Rs.36,375 total)",
                    date="2026-08-25", category="lic_premium",
                    status="pending", amount=36375, isUrgent=True, isDangerous=True,
                    notes="Pay via licindia.in or net banking. Missing grace period = policy lapse."
                ),
                Milestone(
                    id="m8",
                    title="FD1 Maturity - Rs.6,00,000",
                    date="2026-10-15", category="fd_maturity",
                    status="pending", amount=600000, isUrgent=False, isDangerous=False,
                    notes="Do NOT auto-renew. Move to marriage fund. If re-investing: 180-day tenure only."
                ),
                Milestone(
                    id="m9",
                    title="LIC Premium - Q2 (Rs.36,375 total)",
                    date="2026-11-25", category="lic_premium",
                    status="pending", amount=36375, isUrgent=False, isDangerous=True, notes=""
                ),
                Milestone(
                    id="m10",
                    title="FD2 Maturity - Rs.6,00,000",
                    date="2026-12-20", category="fd_maturity",
                    status="pending", amount=600000, isUrgent=False, isDangerous=False,
                    notes="Do NOT auto-renew. Complete marriage budget."
                ),
                Milestone(
                    id="m11",
                    title="FD3 Maturity - Rs.3,15,000",
                    date="2027-03-10", category="fd_maturity",
                    status="pending", amount=315000, isUrgent=False, isDangerous=False,
                    notes="Renovation Phase 1 funding."
                ),
                Milestone(
                    id="m12",
                    title="Chit 1 Prize - Nadar Sangam (Rs.2,77,000)",
                    date="2027-04-30", category="chit_completion",
                    status="pending", amount=277000, isUrgent=False, isDangerous=False,
                    notes="Renovation Phase 1 continuation. Verify organiser health before counting on this."
                ),
                Milestone(
                    id="m13",
                    title="Chit 2 Prize - Nadar Sangam (Rs.2,80,000)",
                    date="2027-06-30", category="chit_completion",
                    status="pending", amount=280000, isUrgent=False, isDangerous=False,
                    notes="Renovation Phase 2."
                ),
                Milestone(
                    id="m14",
                    title="LIC Paid-Up Conversion - Both policies",
                    date="2028-02-01", category="other",
                    status="pending", amount=None, isUrgent=False, isDangerous=False,
                    notes="Visit LIC Chengalpattu branch with both policy bonds. Stop future premiums."
                ),
                Milestone(
                    id="m15",
                    title="Chit 3 Prize - Nadar Sangam (Rs.2,80,000)",
                    date="2028-01-31", category="chit_completion",
                    status="pending", amount=280000, isUrgent=False, isDangerous=False,
                    notes="Final renovation phase."
                ),
                Milestone(
                    id="m16",
                    title="Mother turns 60 - Restructure to Senior Citizen FDs",
                    date="2028-09-01", category="fd_maturity",
                    status="pending", amount=None, isUrgent=False, isDangerous=False,
                    notes="+0.50% on entire core corpus automatically. Plan FD ladder to hit this date."
                ),
            ]
            db.add_all(milestones)
            print("Milestones seeded (16 records).")

        db.commit()
        print("Seed complete. Tables created and data inserted.")

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()
