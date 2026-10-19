"""Synthetic complete-app authorization tests. No household rows or provider traffic."""
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class AuthorizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # This suite must remain usable when all SQL execution is forbidden.
        # Fail before any SQLAlchemy database connection, including SQLite.
        from sqlalchemy.engine import Engine
        cls.connection_attempts = Mock(side_effect=AssertionError('Database connections are forbidden'))
        for method in ['connect', 'raw_connection']:
            guard = patch.object(Engine, method, cls.connection_attempts)
            guard.start()
            cls.addClassCleanup(guard.stop)
        with patch.dict(os.environ, {'SUPABASE_DATABASE_URL': 'sqlite://'}), patch('dotenv.load_dotenv'):
            import main
            import auth
            from database import get_db
            from fastapi.testclient import TestClient
        cls.app = main.app
        cls.auth = auth
        cls.get_db = staticmethod(get_db)
        cls.client = TestClient(main.app)
        cls.addClassCleanup(cls.client.close)

    def setUp(self):
        self.addCleanup(self.connection_attempts.assert_not_called)
        self.env = patch.dict(os.environ, {'SUPABASE_URL': 'https://synthetic.supabase.co',
            'SUPABASE_PUBLISHABLE_KEY': 'synthetic-publishable',
            'FAMILY_EMAIL_PROFILES': json.dumps({'synthetic@example.invalid': 'nithish'})})
        self.env.start(); self.addCleanup(self.env.stop)
        self.database = Mock(side_effect=AssertionError('Unauthorized requests must never acquire a database'))
        self.app.dependency_overrides[self.get_db] = self.database
        self.addCleanup(self.app.dependency_overrides.clear)
        self.provider = patch.object(self.auth.httpx, 'get')
        self.get_user = self.provider.start(); self.addCleanup(self.provider.stop)
        self.get_user.return_value = Mock(status_code=200, json=lambda: {
            'id': 'synthetic-auth-user', 'email': 'synthetic@example.invalid',
            'email_confirmed_at': '2026-10-17T00:00:00Z', 'aud': 'authenticated',
            'user_metadata': {'profileId': 'mother'},
        })

    def test_every_financial_and_ai_route_requires_identity_before_database(self):
        from fastapi.routing import APIRoute
        for route in self.app.routes:
            if not isinstance(route, APIRoute) or not route.path.startswith('/api/') or route.path == '/api/reset':
                continue
            for method in route.methods:
                with self.subTest(path=route.path, method=method):
                    path = route.path.replace('{expense_id}', 'synthetic')
                    # FastAPI resolves auth before financial DB dependencies.
                    response = self.client.request(method, path)
                    self.assertEqual(response.status_code, 401)
        self.database.assert_not_called()
        self.get_user.assert_not_called()

    def test_verified_email_maps_to_server_profile_ignoring_editable_metadata(self):
        response = self.client.get('/api/auth/me', headers={'Authorization': 'Bearer synthetic-token'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'profileId': 'nithish'})
        self.assertEqual(self.get_user.call_args.args[0], 'https://synthetic.supabase.co/auth/v1/user')

    def test_forged_expired_or_other_project_tokens_are_rejected(self):
        for status in [401, 403]:
            self.get_user.return_value = Mock(status_code=status)
            response = self.client.get('/api/auth/me', headers={'Authorization': 'Bearer synthetic-forged'})
            self.assertEqual(response.status_code, 401)

    def test_unapproved_unconfirmed_anonymous_accounts_cannot_access(self):
        for overrides in [{'email': 'stranger@example.invalid'}, {'email_confirmed_at': None},
                          {'is_anonymous': True}, {'aud': 'service_role'}]:
            user = {'id': 'synthetic', 'email': 'synthetic@example.invalid',
                    'email_confirmed_at': 'synthetic-confirmed', 'aud': 'authenticated', **overrides}
            self.get_user.return_value = Mock(status_code=200, json=lambda: user)
            response = self.client.get('/api/auth/me', headers={'Authorization': 'Bearer synthetic-token'})
            self.assertEqual(response.status_code, 403)

    def test_missing_configuration_and_provider_failure_fail_closed(self):
        with patch.dict(os.environ, {'FAMILY_EMAIL_PROFILES': '{}'}):
            response = self.client.get('/api/auth/me', headers={'Authorization': 'Bearer synthetic'})
            self.assertEqual(response.status_code, 503)
        import httpx
        self.get_user.side_effect = httpx.ReadTimeout('Synthetic private credentials')
        response = self.client.get('/api/auth/me', headers={'Authorization': 'Bearer synthetic'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', response.text)
        self.database.assert_not_called()

    def test_reset_denied_even_to_verified_family(self):
        response = self.client.delete('/api/reset', headers={'Authorization': 'Bearer synthetic',
                                                            'X-Confirm-Reset': 'DELETE-ALL-DATA'})
        self.assertEqual(response.status_code, 403)
        self.database.assert_not_called()

    def test_same_token_is_reverified_when_account_authorization_changes(self):
        headers = {'Authorization': 'Bearer synthetic-token'}
        response = self.client.get('/api/auth/me', headers=headers)
        self.assertEqual(response.status_code, 200)
        self.get_user.return_value = Mock(status_code=200, json=lambda: {
            'id': 'synthetic-auth-user', 'email': 'outsider@example.invalid',
            'email_confirmed_at': 'synthetic-confirmed', 'aud': 'authenticated',
            'user_metadata': {'profileId': 'nithish'},
        })
        response = self.client.get('/api/auth/me', headers=headers)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.get_user.call_count, 2)
        self.database.assert_not_called()

    def test_malformed_provider_identity_and_json_fail_closed(self):
        for payload in [None, [], 'synthetic-invalid', {'email': None},
                        {'id': 'synthetic', 'email': 123}]:
            with self.subTest(payload_type=type(payload).__name__):
                self.get_user.return_value = Mock(status_code=200, json=lambda: payload)
                response = self.client.get('/api/auth/me', headers={'Authorization': 'Bearer synthetic'})
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()['detail']['code'], 'FAMILY_ACCESS_DENIED')
        self.get_user.return_value = Mock(status_code=200)
        self.get_user.return_value.json.side_effect = ValueError('Synthetic private provider details')
        response = self.client.get('/api/auth/me', headers={'Authorization': 'Bearer synthetic'})
        self.assertEqual(response.status_code, 403)
        self.assertNotIn('private', response.text)
        self.database.assert_not_called()

    def test_wrong_scheme_or_oversized_token_never_reaches_provider(self):
        for authorization in ['Basic synthetic', 'Bearer', 'Bearer ' + 'x' * 8193]:
            response = self.client.get('/api/auth/me', headers={'Authorization': authorization})
            self.assertEqual(response.status_code, 401)
        self.get_user.assert_not_called()
        self.database.assert_not_called()


if __name__ == '__main__':
    unittest.main()
