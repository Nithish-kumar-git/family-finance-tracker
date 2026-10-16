"""Reset is disabled until server-verified administrator authorization exists."""
from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.delete('/reset')
def reset_all_data():
    # A browser PIN, supplied user ID, bearer string or static confirmation
    # header cannot establish administrator authorization. Never acquire a DB.
    raise HTTPException(status_code=403, detail='Data reset is disabled. Contact the app administrator.')
