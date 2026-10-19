"""Bound API input before parsing; best-effort burst limits per Python process.

These counters are NOT shared between Vercel instances. See the operator plan in
security/REQUEST_PROTECTION.md for distributed rate limiting and remaining gaps.
"""
from collections import deque
import math
from threading import Lock
from time import monotonic

from starlette.responses import JSONResponse
from starlette.routing import Match

from cache_policy import is_protected_response

MAX_BODY_BYTES = 256 * 1024
WINDOW_SECONDS = 60
DEFAULT_LIMITS = {'authentication': 600, 'ai': 20, 'reports': 60,
                  'summaries': 120, 'health': 120}


class ProcessRateLimiter:
    """Atomic shared-household budgets with bounded memory and a monotonic clock."""
    def __init__(self, limits=None, window=WINDOW_SECONDS, clock=monotonic):
        self.limits = dict(DEFAULT_LIMITS if limits is None else limits)
        if window <= 0 or any(limit <= 0 for limit in self.limits.values()):
            raise ValueError('Rate limits and window must be positive')
        self.window, self.clock = window, clock
        self.events = {group: deque() for group in self.limits}
        self.lock = Lock()

    def reserve(self, groups):
        with self.lock:
            now = self.clock()
            retry_after = 0
            for group in groups:
                events = self.events[group]
                while events and events[0] <= now - self.window:
                    events.popleft()
                if len(events) >= self.limits[group]:
                    retry_after = max(retry_after, math.ceil(events[0] + self.window - now))
            if retry_after:
                return retry_after
            for group in groups:
                self.events[group].append(now)
            return 0


class RequestProtectionMiddleware:
    def __init__(self, app, routes, max_body_bytes=MAX_BODY_BYTES, limiter=None):
        self.app, self.routes = app, routes
        self.max_body_bytes = max_body_bytes
        self.limiter = limiter if limiter is not None else ProcessRateLimiter()

    def _route(self, scope):
        # The current backend has flat APIRoutes. Match before parsing or auth;
        # never set scope['route'] early or trust client-provided identity/IPs.
        for route in self.routes:
            match, _ = route.matches(scope)
            if match == Match.FULL:
                return route
        return None

    @staticmethod
    def _groups(route):
        if route is None:
            return []
        path = getattr(route, 'path', '')
        if path == '/health':
            return ['health']
        if not is_protected_response({'route': route}):
            return []
        groups = ['authentication']  # Every protected request verifies with Auth.
        if path.startswith('/api/ai/'):
            groups.append('ai')  # One shared budget across all three AI routes.
        elif path.startswith('/api/reports/'):
            groups.append('reports')
        elif path in {'/api/expenses', '/api/assets/summary', '/api/employment/stats'}:
            if 'GET' in route.methods:
                groups.append('summaries')
        return groups

    async def _reject(self, scope, receive, send, status, code, message, retry_after=None):
        headers = {'Cache-Control': 'no-store'}
        if retry_after is not None:
            headers['Retry-After'] = str(retry_after)
        if code == 'AI_RATE_LIMITED':
            body = {'error': {'code': code, 'message': message, 'retryable': True}}
        else:
            body = {'detail': {'code': code, 'message': message}}
        await JSONResponse(body, status_code=status, headers=headers)(scope, receive, send)

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        route = self._route(scope)
        path = scope['path']
        if not (path == '/api' or path.startswith('/api/') or path == '/health'
                or is_protected_response({'route': route})):
            await self.app(scope, receive, send)
            return

        lengths = [value for name, value in scope.get('headers', []) if name.lower() == b'content-length']
        transfer = any(name.lower() == b'transfer-encoding' for name, _ in scope.get('headers', []))
        declared = None
        if lengths:
            value = lengths[0]
            if (len(lengths) != 1 or transfer or not value or len(value) > 20
                    or any(char < 48 or char > 57 for char in value)):
                await self._reject(scope, receive, send, 400, 'INVALID_BODY_LENGTH', 'Invalid request body length.')
                return
            declared = int(value)
            if declared > self.max_body_bytes:
                await self._reject(scope, receive, send, 413, 'REQUEST_TOO_LARGE', 'Request body exceeds the allowed size.')
                return
        if any(name.lower() == b'content-encoding' and value.strip().lower() != b'identity'
               for name, value in scope.get('headers', [])):
            await self._reject(scope, receive, send, 415, 'UNSUPPORTED_CONTENT_ENCODING', 'Compressed request bodies are not supported.')
            return

        # Buffer only the bounded raw bytes, not parsed JSON. Do not call the app
        # until the entire body fits, even if Content-Length is absent or false.
        body = bytearray()
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            chunk = message.get('body', b'')
            if len(body) + len(chunk) > self.max_body_bytes:
                await self._reject(scope, receive, send, 413, 'REQUEST_TOO_LARGE', 'Request body exceeds the allowed size.')
                return
            body.extend(chunk)
            if not message.get('more_body', False):
                break
        if declared is not None and declared != len(body):
            await self._reject(scope, receive, send, 400, 'INVALID_BODY_LENGTH', 'Request body length does not match Content-Length.')
            return

        groups = self._groups(route)
        retry_after = self.limiter.reserve(groups)
        if retry_after:
            is_ai = 'ai' in groups
            await self._reject(scope, receive, send, 429,
                               'AI_RATE_LIMITED' if is_ai else 'RATE_LIMITED',
                               'Too many requests. Wait before trying again.', retry_after)
            return

        replayed = False

        async def replay_body():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
            return await receive()

        await self.app(scope, replay_body, send)
