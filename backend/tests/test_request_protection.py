"""Pre-JSON body and process-rate guards; synthetic requests, no SQL/providers."""
import json
import os
from pathlib import Path
import socket
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_ai_reset import forbidden, guarded_connect


class OfflineGuards:
    @classmethod
    def setUpClass(cls):
        from sqlalchemy.engine import Engine
        cls.connections = Mock(side_effect=AssertionError('Database access forbidden'))
        for guard in [
            patch.object(Engine, 'connect', cls.connections),
            patch.object(Engine, 'raw_connection', cls.connections),
            patch.dict(os.environ, {'SUPABASE_DATABASE_URL': 'sqlite://',
                'SUPABASE_URL': 'https://synthetic.supabase.co',
                'SUPABASE_PUBLISHABLE_KEY': 'synthetic-publishable',
                'FAMILY_EMAIL_PROFILES': json.dumps({'synthetic@example.invalid': 'nithish'})}),
            patch('dotenv.load_dotenv', return_value=False),
            patch.object(socket.socket, 'connect', guarded_connect),
            patch('socket.getaddrinfo', forbidden),
            patch('httpx.get', side_effect=AssertionError('Auth provider forbidden')),
            patch('google.genai.Client', side_effect=AssertionError('AI provider forbidden')),
        ]:
            guard.start()
            cls.addClassCleanup(guard.stop)
        from request_protection import RequestProtectionMiddleware, ProcessRateLimiter, MAX_BODY_BYTES
        cls.middleware_type = RequestProtectionMiddleware
        cls.limiter_type = ProcessRateLimiter
        cls.body_limit = MAX_BODY_BYTES


class BodyStreamTests(OfflineGuards, unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.addCleanup(self.connections.assert_not_called)

    async def probe(self, messages, headers=(), path='/api/ai/chat'):
        scope = {'type': 'http', 'path': path, 'method': 'POST', 'headers': list(headers)}
        receive = AsyncMock(side_effect=messages)
        send = AsyncMock()
        inner = AsyncMock()
        middleware = self.middleware_type(inner, routes=[])
        await middleware(scope, receive, send)
        return inner, receive, send

    def assert_rejected(self, result, status):
        inner, _, send = result
        inner.assert_not_called()  # No routing, JSON parsing, auth, SQL or AI.
        start = send.call_args_list[0].args[0]
        self.assertEqual(start['status'], status)
        self.assertIn((b'cache-control', b'no-store'), start['headers'])

    async def test_declared_oversize_rejected_without_reading_or_parsing(self):
        result = await self.probe([], [(b'content-length', str(self.body_limit + 1).encode())])
        self.assert_rejected(result, 413)
        result[1].assert_not_called()

    async def test_chunked_missing_length_and_underreported_length_cannot_bypass_cap(self):
        for headers in [[], [(b'transfer-encoding', b'chunked')], [(b'content-length', b'1')]]:
            with self.subTest(headers=headers):
                result = await self.probe([
                    {'type': 'http.request', 'body': b'x' * self.body_limit, 'more_body': True},
                    {'type': 'http.request', 'body': b'x', 'more_body': True},
                ], headers)
                self.assert_rejected(result, 413)
                self.assertEqual(result[1].call_count, 2)

    async def test_malformed_duplicate_or_conflicting_lengths_fail_before_body_read(self):
        for headers in [[(b'content-length', v)] for v in [b'', b'-1', b'+1', b'1.0', b' 1', b'1,1', b'9' * 21, b'\xd9\xa1']] + [
            [(b'content-length', b'1'), (b'content-length', b'1')],
            [(b'content-length', b'1'), (b'transfer-encoding', b'chunked')],
        ]:
            with self.subTest(headers=headers):
                result = await self.probe([], headers)
                self.assert_rejected(result, 400)
                result[1].assert_not_called()

    async def test_short_or_long_body_mismatches_are_rejected(self):
        for declared in [0, 3]:
            result = await self.probe([{'type': 'http.request', 'body': b'xx'}],
                                      [(b'content-length', str(declared).encode())])
            self.assert_rejected(result, 400)

    async def test_boundary_body_is_replayed_unchanged_without_truncation(self):
        for size in [0, self.body_limit - 1, self.body_limit]:
            body = b'x' * size
            sent = []

            async def inner(scope, receive, send):
                sent.append(await receive())
                sent.append(await receive())

            receive = AsyncMock(side_effect=[
                {'type': 'http.request', 'body': body[:size // 2], 'more_body': True},
                {'type': 'http.request', 'body': body[size // 2:], 'more_body': False},
                {'type': 'http.disconnect'},
            ])
            scope = {'type': 'http', 'method': 'POST', 'path': '/api/ai/chat', 'headers': []}
            await self.middleware_type(inner, routes=[])(scope, receive, AsyncMock())
            self.assertEqual(sent, [{'type': 'http.request', 'body': body, 'more_body': False},
                                    {'type': 'http.disconnect'}])

    async def test_disconnect_before_complete_body_never_enters_application(self):
        result = await self.probe([{'type': 'http.request', 'body': b'{', 'more_body': True},
                                   {'type': 'http.disconnect'}])
        result[0].assert_not_called()
        result[2].assert_not_called()

    async def test_compressed_body_rejected_without_reading(self):
        result = await self.probe([], [(b'content-encoding', b'gzip')])
        self.assert_rejected(result, 415)
        result[1].assert_not_called()

    async def test_public_assets_and_non_http_scopes_pass_through(self):
        result = await self.probe([], [(b'content-length', b'999999999')], '/static/synthetic.css')
        result[0].assert_awaited_once()
        result[1].assert_not_called()
        inner = AsyncMock()
        await self.middleware_type(inner, routes=[])({'type': 'lifespan'}, AsyncMock(), AsyncMock())
        inner.assert_awaited_once()


class ProcessLimiterTests(OfflineGuards, unittest.TestCase):
    def test_sliding_boundary_retry_and_failed_reservations_do_not_extend_window(self):
        now = [0.0]
        limiter = self.limiter_type({'auth': 2, 'ai': 1}, clock=lambda: now[0])
        self.assertEqual(limiter.reserve(['auth', 'ai']), 0)
        self.assertEqual(limiter.reserve(['auth', 'ai']), 60)
        self.assertEqual(len(limiter.events['auth']), 1)
        now[0] = 59.5
        self.assertEqual(limiter.reserve(['auth', 'ai']), 1)
        now[0] = 60.0
        self.assertEqual(limiter.reserve(['auth', 'ai']), 0)
        self.assertEqual(len(limiter.events['auth']), 1)
        self.connections.assert_not_called()

    def test_concurrent_reservations_cannot_exceed_budget(self):
        from concurrent.futures import ThreadPoolExecutor
        limiter = self.limiter_type({'ai': 3}, clock=lambda: 0)
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: limiter.reserve(['ai']), range(40)))
        self.assertEqual(results.count(0), 3)
        self.assertEqual(results.count(60), 37)
        self.assertEqual(len(limiter.events['ai']), 3)

    def test_processes_do_not_claim_shared_counters(self):
        first = self.limiter_type({'ai': 1}, clock=lambda: 0)
        second = self.limiter_type({'ai': 1}, clock=lambda: 0)
        self.assertEqual(first.reserve(['ai']), 0)
        self.assertEqual(first.reserve(['ai']), 60)
        self.assertEqual(second.reserve(['ai']), 0)


class RequestProtectionHTTPTests(OfflineGuards, unittest.TestCase):
    def setUp(self):
        from fastapi import Depends, FastAPI
        from fastapi.testclient import TestClient
        from cache_policy import ProtectedResponseCacheMiddleware, internal_server_error
        from fastapi.middleware.cors import CORSMiddleware
        from routers import ai, auth as auth_routes, expenses, reports, settings
        from database import get_db
        import auth
        from services import ai_service
        self.app = FastAPI()
        for router in [ai.router, expenses.router, reports.router, settings.router]:
            self.app.include_router(router, prefix='/api', dependencies=[Depends(auth.require_family_member)])
        self.app.include_router(auth_routes.router, prefix='/api')
        self.now = [0.0]
        self.limiter = self.limiter_type({'authentication': 100, 'ai': 2, 'reports': 2,
                                         'summaries': 2, 'health': 2}, clock=lambda: self.now[0])
        self.app.add_middleware(ProtectedResponseCacheMiddleware)
        self.app.add_exception_handler(Exception, internal_server_error)
        self.app.add_middleware(self.middleware_type, routes=self.app.routes, limiter=self.limiter)
        self.app.add_middleware(CORSMiddleware, allow_origins=['https://synthetic.invalid'],
                                allow_methods=['*'], allow_headers=['*'])
        self.session = Mock()
        self.database = Mock(return_value=self.session)
        self.app.dependency_overrides[get_db] = lambda: self.database()

        @self.app.get('/health')
        def health(db=Depends(get_db)):
            db.execute('SYNTHETIC MOCK ONLY')
            return {'status': 'ok'}

        identity = patch.object(auth.httpx, 'get')
        self.identity = identity.start()
        self.addCleanup(identity.stop)
        self.identity.return_value = Mock(status_code=200, json=lambda: {
            'id': 'synthetic-user', 'email': 'synthetic@example.invalid',
            'email_confirmed_at': 'synthetic', 'aud': 'authenticated'})
        provider = patch.object(ai_service, '_generate', return_value='Synthetic answer')
        self.provider = provider.start()
        self.addCleanup(provider.stop)
        self.addCleanup(self.connections.assert_not_called)
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)
        self.headers = {'Authorization': 'Bearer synthetic', 'Origin': 'https://synthetic.invalid'}
        self.payload = {'question': 'Synthetic question', 'context': {}, 'history': []}

    def assert_rejected_without_downstream(self, response, status):
        self.assertEqual(response.status_code, status, response.text[:200])
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertEqual(response.headers['access-control-allow-origin'], 'https://synthetic.invalid')
        self.identity.assert_not_called()
        self.database.assert_not_called()
        self.assertEqual(self.session.mock_calls, [])
        self.provider.assert_not_called()

    def reset_downstream(self):
        for mock in [self.identity, self.database, self.session, self.provider]:
            mock.reset_mock()

    def test_oversized_invalid_json_is_rejected_before_parser_auth_sql_or_ai(self):
        response = self.client.post('/api/ai/chat', content=b'{' * (self.body_limit + 1), headers=self.headers)
        self.assert_rejected_without_downstream(response, 413)

    def test_valid_json_at_body_boundary_and_one_byte_over(self):
        raw = json.dumps(self.payload).encode()
        raw += b' ' * (self.body_limit - len(raw))
        response = self.client.post('/api/ai/chat', content=raw,
                                    headers={**self.headers, 'Content-Type': 'application/json'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'answer': 'Synthetic answer'})
        self.reset_downstream()
        response = self.client.post('/api/ai/chat', content=raw + b' ', headers=self.headers)
        self.assert_rejected_without_downstream(response, 413)

    def test_auth_budget_precedes_token_verification_and_recovers_at_boundary(self):
        self.limiter.limits['authentication'] = 2
        for _ in range(2):
            self.assertEqual(self.client.get('/api/auth/me', headers=self.headers).status_code, 200)
        self.reset_downstream()
        response = self.client.get('/api/auth/me', headers={**self.headers, 'X-Forwarded-For': '192.0.2.123',
                                                           'Authorization': 'Bearer synthetic-rotated'})
        self.assert_rejected_without_downstream(response, 429)
        self.assertEqual(response.headers['retry-after'], '60')
        self.now[0] = 59.5
        self.assertEqual(self.client.get('/api/auth/me', headers=self.headers).headers['retry-after'], '1')
        self.now[0] = 60
        self.assertEqual(self.client.get('/api/auth/me', headers=self.headers).json(), {'profileId': 'nithish'})

    def test_all_ai_operations_share_budget_and_rejection_preserves_ai_error_contract(self):
        self.assertEqual(self.client.post('/api/ai/chat', headers=self.headers, json=self.payload).status_code, 200)
        self.provider.return_value = json.dumps(['Synthetic'] * 5)
        self.assertEqual(self.client.post('/api/ai/monthly-insights', headers=self.headers,
                                         json={'report': {}}).status_code, 200)
        self.reset_downstream()
        response = self.client.post('/api/ai/parse-transaction', headers=self.headers,
                                    json={'raw_text': 'Synthetic'})
        self.assert_rejected_without_downstream(response, 429)
        self.assertEqual(response.json()['error']['code'], 'AI_RATE_LIMITED')
        self.assertTrue(response.json()['error']['retryable'])
        # Malformed JSON is not parsed once the process budget is exhausted.
        response = self.client.post('/api/ai/chat', headers=self.headers, content=b'{')
        self.assert_rejected_without_downstream(response, 429)

    def test_authentication_budget_also_precedes_financial_endpoints(self):
        self.limiter.limits['authentication'] = 2
        for _ in range(2):
            response = self.client.patch('/api/settings/income', headers=self.headers,
                                         json={'pension': 1, 'nithish': 2, 'abeerami': 3})
            self.assertEqual(response.status_code, 200)
        self.reset_downstream()
        self.assert_rejected_without_downstream(
            self.client.get('/api/reports/snapshots', headers=self.headers), 429)

    def test_cors_preflight_does_not_consume_auth_or_ai_budgets(self):
        for _ in range(5):
            response = self.client.options('/api/ai/chat', headers={
                'Origin': 'https://synthetic.invalid', 'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'authorization,content-type'})
            self.assertEqual(response.status_code, 200)
        self.assertTrue(all(not events for events in self.limiter.events.values()))
        self.identity.assert_not_called()
        self.provider.assert_not_called()
        self.database.assert_not_called()

    def test_reports_and_expensive_expense_reads_are_rate_limited_before_database(self):
        query = self.session.query.return_value
        query.filter.return_value = query
        query.order_by.return_value = query
        query.all.return_value = []
        for path in ['/api/reports/snapshots', '/api/expenses?month=2026-01']:
            for _ in range(2):
                self.assertEqual(self.client.get(path, headers=self.headers).status_code, 200)
            self.reset_downstream()
            self.assert_rejected_without_downstream(self.client.get(path, headers=self.headers), 429)

    def test_health_database_probe_has_separate_budget(self):
        for _ in range(2):
            self.assertEqual(self.client.get('/health', headers=self.headers).status_code, 200)
        self.reset_downstream()
        self.assert_rejected_without_downstream(self.client.get('/health', headers=self.headers), 429)

    def test_normal_unauthorized_and_invalid_schema_requests_preserve_security_contracts(self):
        response = self.client.get('/api/auth/me', headers={'Origin': 'https://synthetic.invalid'})
        self.assert_rejected_without_downstream(response, 401)
        response = self.client.post('/api/ai/chat', json={**self.payload, 'question': 'x' * 4001}, headers=self.headers)
        self.assertEqual(response.status_code, 422)
        self.provider.assert_not_called()
        response = self.client.get('/api/expenses?month=%25', headers=self.headers)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.session.mock_calls, [])

    def test_actual_main_app_installs_guard_and_rejects_body_before_downstream(self):
        import main
        from fastapi.testclient import TestClient
        self.assertTrue(any(item.cls is self.middleware_type for item in main.app.user_middleware))
        with TestClient(main.app) as client:
            response = client.post('/api/ai/chat', content=b'{' * (self.body_limit + 1), headers=self.headers)
            self.assertEqual(response.status_code, 413)
            self.assertEqual(response.headers['cache-control'], 'no-store')
        self.identity.assert_not_called()
        self.provider.assert_not_called()
        self.database.assert_not_called()


if __name__ == '__main__':
    unittest.main()
