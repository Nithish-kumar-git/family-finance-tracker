=== ROUTES IN assets.py ===
@router.get("/assets/summary", response_model=AssetSummaryResponse)
@router.get("/assets/fixeddeposits")
@router.post("/assets/fixeddeposits", response_model=FixedDepositResponse, status_code=201)
@router.put("/assets/fixeddeposits/{fd_id}", response_model=FixedDepositResponse)
@router.delete("/assets/fixeddeposits/{fd_id}")
@router.get("/assets/mutualfunds")
@router.post("/assets/mutualfunds", response_model=MutualFundResponse, status_code=201)
@router.put("/assets/mutualfunds/{mf_id}", response_model=MutualFundResponse)
@router.patch("/assets/mutualfunds/{mf_id}/update-value", response_model=MutualFundResponse)
@router.delete("/assets/mutualfunds/{mf_id}")
@router.get("/assets/lic")
@router.post("/assets/lic", response_model=LICPolicyResponse, status_code=201)
@router.put("/assets/lic/{lic_id}", response_model=LICPolicyResponse)
@router.patch("/assets/lic/{lic_id}/mark-paid", response_model=LICPolicyResponse)
@router.delete("/assets/lic/{lic_id}")
@router.get("/assets/chitfunds")
@router.post("/assets/chitfunds", response_model=ChitFundResponse, status_code=201)
@router.put("/assets/chitfunds/{chit_id}", response_model=ChitFundResponse)
@router.delete("/assets/chitfunds/{chit_id}")
@router.patch("/assets/gold", response_model=GoldResponse)
=== END ROUTES ===

=== FETCH CALLS IN Assets.jsx ===
      const res = await fetch(
      const res = await fetch(`${BASE}/api/assets/fixeddeposits/${updated.id}`, {
      const res = await fetch(`${BASE}/api/assets/lic/${updated.id}`, {
      const res = await fetch(`${BASE}/api/assets/chitfunds/${updated.id}`, {
      await fetch(`${BASE}/api/assets/gold`, {
                    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/assets/fixeddeposits`).then(r => r.json()),
                    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/assets/mutualfunds`).then(r => r.json()),
                    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/assets/lic`).then(r => r.json()),
                    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/assets/chitfunds`).then(r => r.json()),
=== END FETCH CALLS ===
