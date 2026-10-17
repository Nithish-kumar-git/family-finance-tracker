from fastapi import APIRouter, Depends
from auth import require_family_member

router = APIRouter()


@router.get('/auth/me')
def current_member(member=Depends(require_family_member)):
    return member
