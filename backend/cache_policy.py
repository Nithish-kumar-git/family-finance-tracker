"""Prevent storage of responses from routes requiring household authorization."""
from starlette.datastructures import MutableHeaders
from starlette.responses import PlainTextResponse

from auth import require_family_member


def _requires_family_member(dependant):
    if dependant is None:
        return False
    return (dependant.call is require_family_member
            or any(_requires_family_member(child) for child in dependant.dependencies))


def is_protected_response(scope):
    # Inspect the matched route, including nested dependencies. Do not apply an
    # API-prefix or Authorization-header rule to unrelated public resources.
    route = scope.get('route')
    return (getattr(route, 'path', '') == '/api/demo/ai/chat'
            or _requires_family_member(getattr(route, 'dependant', None)))


class ProtectedResponseCacheMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        async def send_with_cache_policy(message):
            if message['type'] == 'http.response.start' and is_protected_response(scope):
                # Replace conflicting cache directives, preserving other headers
                # and leaving streamed response bodies untouched.
                MutableHeaders(scope=message)['Cache-Control'] = 'no-store'
            await send(message)

        await self.app(scope, receive, send_with_cache_policy)


async def internal_server_error(request, exc):
    # Starlette's outer ServerErrorMiddleware creates unhandled 500 responses
    # outside user middleware. Preserve its default sanitized body/status and
    # apply the same route policy there; Starlette still re-raises for logging.
    headers = {'Cache-Control': 'no-store'} if is_protected_response(request.scope) else None
    return PlainTextResponse('Internal Server Error', status_code=500, headers=headers)
