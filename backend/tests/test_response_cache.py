"""Protected HTTP cache policy with synthetic identities and no SQL/network."""
import json
import os
from pathlib import Path
import re
import socket
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_ai_reset import forbidden, guarded_connect


class ProtectedResponseCacheTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from sqlalchemy.engine import Engine
        cls.connections = Mock(side_effect=AssertionError('Database access forbidden'))
        for guard in [
            patch.object(Engine, 'connect', cls.connections),
            patch.object(Engine, 'raw_connection', cls.connections),
            patch.dict(os.environ, {'SUPABASE_DATABASE_URL': 'sqlite://'}),
            patch('dotenv.load_dotenv', return_value=False),
            patch.object(socket.socket, 'connect', guarded_connect),
            patch('socket.getaddrinfo', forbidden),
        ]:
            guard.start()
            cls.addClassCleanup(guard.stop)
        import main
        import auth
        from database import get_db
        from fastapi.testclient import TestClient
        from services import ai_service
        cls.app, cls.auth, cls.ai_service = main.app, auth, ai_service
        cls.get_db = staticmethod(get_db)
        cls.client = TestClient(main.app, raise_server_exceptions=False)
        cls.addClassCleanup(cls.client.close)

    def setUp(self):
        self.addCleanup(self.connections.assert_not_called)
        env = patch.dict(os.environ, {
            'SUPABASE_URL': 'https://synthetic.supabase.co',
            'SUPABASE_PUBLISHABLE_KEY': 'synthetic-publishable',
            'FAMILY_EMAIL_PROFILES': json.dumps({'synthetic@example.invalid': 'nithish'}),
        })
        env.start()
        self.addCleanup(env.stop)
        self.session = Mock()
        self.database = Mock(return_value=self.session)
        self.app.dependency_overrides[self.get_db] = lambda: self.database()
        self.addCleanup(self.app.dependency_overrides.clear)
        identity = patch.object(self.auth.httpx, 'get')
        self.identity = identity.start()
        self.addCleanup(identity.stop)
        self.identity.return_value = Mock(status_code=200, json=lambda: {
            'id': 'synthetic-user', 'email': 'synthetic@example.invalid',
            'email_confirmed_at': 'synthetic-confirmed', 'aud': 'authenticated',
        })
        provider = patch.object(self.ai_service, '_generate', side_effect=AssertionError('Provider forbidden'))
        self.provider = provider.start()
        self.addCleanup(provider.stop)
        self.headers = {'Authorization': 'Bearer synthetic-token'}

    def assert_no_store(self, response, status):
        self.assertEqual(response.status_code, status, response.text[:300])
        self.assertEqual(response.headers.get_list('cache-control'), ['no-store'])

    def test_auth_me_success_does_not_allow_storage(self):
        response = self.client.get('/api/auth/me', headers=self.headers)
        self.assert_no_store(response, 200)
        self.assertEqual(response.json(), {'profileId': 'nithish'})
        self.database.assert_not_called()
        self.provider.assert_not_called()

    def test_all_current_protected_operations_reject_anonymous_requests_without_storage(self):
        from fastapi.routing import APIRoute
        operations = 0
        for route in self.app.routes:
            if not isinstance(route, APIRoute) or not route.path.startswith('/api/') or route.path == '/api/reset':
                continue
            for method in route.methods:
                with self.subTest(path=route.path, method=method):
                    response = self.client.request(method, re.sub(r'\{[^}]+\}', 'synthetic', route.path))
                    self.assert_no_store(response, 401)
                    self.assertEqual(response.headers['www-authenticate'], 'Bearer')
                    operations += 1
        self.assertGreater(operations, 40)
        self.database.assert_not_called()
        self.identity.assert_not_called()
        self.provider.assert_not_called()

    def test_auth_errors_are_not_stored(self):
        for status in [401, 403]:
            with self.subTest(provider_status=status):
                self.identity.return_value = Mock(status_code=status)
                response = self.client.get('/api/auth/me', headers=self.headers)
                self.assert_no_store(response, 401)
                self.assertEqual(response.headers['www-authenticate'], 'Bearer')
        self.identity.return_value = Mock(status_code=200, json=lambda: {
            'id': 'synthetic-outsider', 'email': 'outsider@example.invalid',
            'email_confirmed_at': 'synthetic-confirmed', 'aud': 'authenticated',
        })
        self.assert_no_store(self.client.get('/api/auth/me', headers=self.headers), 403)
        import httpx
        self.identity.side_effect = httpx.ReadTimeout('Synthetic private details')
        response = self.client.get('/api/auth/me', headers=self.headers)
        self.assert_no_store(response, 503)
        self.assertNotIn('private', response.text)
        with patch.dict(os.environ, {'FAMILY_EMAIL_PROFILES': '{}'}):
            self.assert_no_store(self.client.get('/api/auth/me', headers=self.headers), 503)
        self.database.assert_not_called()

    def test_financial_reads_and_income_echo_are_not_stored(self):
        query = self.session.query.return_value
        query.filter.return_value = query
        query.order_by.return_value = query
        query.all.return_value = []
        response = self.client.get('/api/expenses?month=2026-01', headers=self.headers)
        self.assert_no_store(response, 200)
        self.assertEqual(response.json()['expenses'], [])
        response = self.client.get('/api/milestones', headers=self.headers)
        self.assert_no_store(response, 200)
        self.assertEqual(response.json(), [])
        response = self.client.patch('/api/settings/income', headers=self.headers,
                                     json={'pension': 1, 'nithish': 2, 'abeerami': 3})
        self.assert_no_store(response, 200)
        self.assertEqual(response.json(), {'pension': 1, 'nithish': 2, 'abeerami': 3, 'updated': True})
        self.provider.assert_not_called()

    def test_validation_and_missing_record_errors_are_not_stored(self):
        response = self.client.get('/api/expenses?month=%25', headers=self.headers)
        self.assert_no_store(response, 422)
        response = self.client.post('/api/ai/chat', headers=self.headers,
                                    json={'question': 'x' * 4001, 'context': {}, 'history': []})
        self.assert_no_store(response, 422)
        self.assertEqual(self.session.mock_calls, [])
        self.provider.assert_not_called()
        self.session.query.return_value.filter.return_value.first.return_value = None
        response = self.client.delete('/api/expenses/synthetic-missing', headers=self.headers)
        self.assert_no_store(response, 404)
        self.session.commit.assert_not_called()
        self.session.delete.assert_not_called()

    def test_ai_success_and_provider_errors_preserve_contracts_without_storage(self):
        payload = {'question': 'Synthetic question', 'context': {}, 'history': []}
        self.provider.side_effect = None
        self.provider.return_value = 'Synthetic answer'
        response = self.client.post('/api/ai/chat', headers=self.headers, json=payload)
        self.assert_no_store(response, 200)
        self.assertEqual(response.json(), {'answer': 'Synthetic answer'})
        for code, status in [('AI_UNAVAILABLE', 503), ('AI_RATE_LIMITED', 429)]:
            self.provider.side_effect = self.ai_service.AIServiceError(code, 'Synthetic failure', True, status)
            response = self.client.post('/api/ai/chat', headers=self.headers, json=payload)
            self.assert_no_store(response, status)
            self.assertEqual(response.json()['error']['code'], code)
            if status == 429:
                self.assertEqual(response.headers['retry-after'], '60')
        self.database.assert_not_called()

    def test_unhandled_protected_error_is_not_stored_or_exposed(self):
        self.identity.side_effect = RuntimeError('Synthetic private exception details')
        response = self.client.get('/api/auth/me', headers=self.headers)
        self.assert_no_store(response, 500)
        self.assertEqual(response.text, 'Internal Server Error')
        self.assertNotIn('private', response.text)
        self.database.assert_not_called()

    def test_unhandled_500_keeps_cors_and_no_store_for_allowed_origins(self):
        import main
        self.assertTrue(main.allowed_origins)
        self.identity.side_effect = RuntimeError('Synthetic private exception details')
        for origin in main.allowed_origins:
            with self.subTest(origin=origin):
                response = self.client.get('/api/auth/me', headers={**self.headers, 'Origin': origin})
                self.assert_no_store(response, 500)
                self.assertEqual(response.headers.get_list('access-control-allow-origin'), [origin])
                self.assertIn('Origin', response.headers.get('vary', '').split(', '))
                self.assertNotIn('access-control-allow-credentials', response.headers)
                self.assertEqual(response.text, 'Internal Server Error')
        self.database.assert_not_called()
        self.provider.assert_not_called()

    def test_unhandled_500_does_not_grant_cors_to_other_or_missing_origins(self):
        import main
        blocked = 'https://synthetic-untrusted.invalid'
        self.assertNotIn(blocked, main.allowed_origins)
        self.identity.side_effect = RuntimeError('Synthetic private exception details')
        for extra_headers in [{}, {'Origin': blocked}]:
            response = self.client.get('/api/auth/me', headers={**self.headers, **extra_headers})
            self.assert_no_store(response, 500)
            self.assertNotIn('access-control-allow-origin', response.headers)
            self.assertNotIn('access-control-allow-credentials', response.headers)
            self.assertEqual(response.text, 'Internal Server Error')
        self.database.assert_not_called()
        self.provider.assert_not_called()

    def test_handled_413_422_and_429_keep_cors_and_no_store(self):
        import main
        headers = {**self.headers, 'Origin': main.allowed_origins[0]}
        payload = {'question': 'Synthetic question', 'context': {}, 'history': []}
        response = self.client.post('/api/ai/chat', headers=headers, content=b'x' * (256 * 1024 + 1))
        self.assert_no_store(response, 413)
        self.assertEqual(response.headers.get_list('access-control-allow-origin'), [headers['Origin']])
        self.identity.assert_not_called()
        self.provider.assert_not_called()
        response = self.client.post('/api/ai/chat', headers=headers, json={**payload, 'question': 'x' * 4001})
        self.assert_no_store(response, 422)
        self.assertEqual(response.headers.get_list('access-control-allow-origin'), [headers['Origin']])
        self.provider.assert_not_called()
        self.provider.side_effect = self.ai_service.AIServiceError('AI_RATE_LIMITED', 'Synthetic failure', True, 429)
        response = self.client.post('/api/ai/chat', headers=headers, json=payload)
        self.assert_no_store(response, 429)
        self.assertEqual(response.headers.get_list('access-control-allow-origin'), [headers['Origin']])
        self.assertEqual(response.headers['retry-after'], '60')
        self.database.assert_not_called()

    def test_method_not_allowed_on_protected_route_is_not_stored(self):
        response = self.client.post('/api/auth/me', headers=self.headers)
        self.assert_no_store(response, 405)
        self.assertIn('GET', response.headers['allow'])
        self.identity.assert_not_called()
        self.database.assert_not_called()

    def test_public_health_response_remains_unchanged_with_mocked_database(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok', 'database': 'connected'})
        self.assertNotIn('cache-control', response.headers)
        # This is only a synthetic session mock; Engine connections stay blocked.
        self.session.execute.assert_called_once()
        self.identity.assert_not_called()
        self.provider.assert_not_called()

    def test_public_responses_and_disabled_reset_remain_unchanged(self):
        for path, status in [('/docs', 200), ('/redoc', 200), ('/openapi.json', 200),
                             ('/synthetic-not-found', 404), ('/api/synthetic-not-found', 404)]:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, status)
                self.assertNotIn('cache-control', response.headers)
        response = self.client.delete('/api/reset', headers=self.headers)
        self.assertEqual(response.status_code, 403)
        self.assertNotIn('cache-control', response.headers)
        self.database.assert_not_called()
        self.identity.assert_not_called()
        self.provider.assert_not_called()

    def test_cache_policy_tracks_auth_dependencies_and_preserves_public_asset_headers(self):
        from fastapi import Depends, FastAPI
        from fastapi.responses import Response, StreamingResponse
        from fastapi.testclient import TestClient
        from cache_policy import ProtectedResponseCacheMiddleware, internal_server_error
        app = FastAPI()
        app.add_middleware(ProtectedResponseCacheMiddleware)
        app.add_exception_handler(Exception, internal_server_error)

        def nested_identity(member=Depends(self.auth.require_family_member)):
            return member

        @app.get('/synthetic-private', dependencies=[Depends(nested_identity)])
        def private_stream():
            return StreamingResponse(iter(['Synthetic', ' private response']),
                                     headers={'Cache-Control': 'public, max-age=3600',
                                              'Vary': 'Origin', 'X-Synthetic': 'unchanged'})

        @app.get('/static/synthetic.css')
        def public_asset():
            return Response('/* Synthetic public asset */', media_type='text/css',
                            headers={'Cache-Control': 'public, max-age=3600'})

        @app.get('/api/synthetic-public')
        def public_api():
            return {'public': True}

        @app.get('/synthetic-public-error')
        def public_error():
            raise RuntimeError('Synthetic error')

        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get('/synthetic-private', headers=self.headers)
            self.assert_no_store(response, 200)
            self.assertEqual(response.text, 'Synthetic private response')
            self.assertEqual(response.headers['vary'], 'Origin')
            self.assertEqual(response.headers['x-synthetic'], 'unchanged')
            response = client.get('/static/synthetic.css', headers=self.headers)
            self.assertEqual(response.headers['cache-control'], 'public, max-age=3600')
            self.assertEqual(response.text, '/* Synthetic public asset */')
            response = client.get('/api/synthetic-public', headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertNotIn('cache-control', response.headers)
            response = client.get('/synthetic-public-error')
            self.assertEqual(response.status_code, 500)
            self.assertEqual(response.text, 'Internal Server Error')
            self.assertNotIn('cache-control', response.headers)


if __name__ == '__main__':
    unittest.main()
