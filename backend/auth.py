"""Server-verified, allowlisted Supabase identities for this one household."""
import json
import os
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer = HTTPBearer(auto_error=False)
PROFILE_IDS = {'mother', 'nithish', 'abeerami'}


def _configuration():
    url = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = os.getenv('SUPABASE_PUBLISHABLE_KEY', '')
    parsed = urlsplit(url)
    try:
        profiles = json.loads(os.getenv('FAMILY_EMAIL_PROFILES', '{}'))
    except (ValueError, TypeError):
        profiles = None
    if (parsed.scheme != 'https' or not (parsed.hostname or '').endswith('.supabase.co')
            or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment
            or not key or not isinstance(profiles, dict) or not profiles
            or any(not isinstance(email, str) or '@' not in email or not isinstance(profile, str) or profile not in PROFILE_IDS
                   for email, profile in profiles.items())):
        raise HTTPException(503, detail={'code': 'AUTH_NOT_CONFIGURED',
                            'message': 'Family sign-in needs configuration by the app administrator.'})
    return url, key, {email.strip().lower(): profile for email, profile in profiles.items()}


def require_family_member(credentials: HTTPAuthorizationCredentials = Security(bearer)):
    if not credentials or credentials.scheme.lower() != 'bearer' or len(credentials.credentials) > 8192:
        raise HTTPException(401, detail={'code': 'AUTH_REQUIRED', 'message': 'Sign in to continue.'},
                            headers={'WWW-Authenticate': 'Bearer'})
    url, key, profiles = _configuration()
    try:
        # Auth verifies signature, issuer, expiry and current user state. Never
        # authorize using client profile IDs or editable user_metadata claims.
        response = httpx.get(url + '/auth/v1/user', headers={
            'apikey': key, 'Authorization': 'Bearer ' + credentials.credentials,
        }, timeout=5.0, follow_redirects=False)
    except httpx.HTTPError:
        raise HTTPException(503, detail={'code': 'AUTH_UNAVAILABLE',
                            'message': 'Sign-in verification is temporarily unavailable.'}) from None
    if response.status_code in {401, 403}:
        raise HTTPException(401, detail={'code': 'AUTH_REQUIRED', 'message': 'Please sign in again.'},
                            headers={'WWW-Authenticate': 'Bearer'})
    if response.status_code != 200:
        raise HTTPException(503, detail={'code': 'AUTH_UNAVAILABLE',
                            'message': 'Sign-in verification is temporarily unavailable.'})
    try:
        user = response.json()
        email = user.get('email', '').strip().lower()
        profile = profiles.get(email)
        allowed = (user.get('id') and user.get('email_confirmed_at')
                   and user.get('aud') == 'authenticated'
                   and user.get('is_anonymous') is not True and profile)
    except (ValueError, AttributeError, TypeError):
        allowed = False
    if not allowed:
        raise HTTPException(403, detail={'code': 'FAMILY_ACCESS_DENIED',
                            'message': 'This account is not authorized for this household.'})
    return {'profileId': profile}
