"""Full HTTP tests against synthetic SQLite; no real tokens, rows or providers."""
import json
import os
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class HouseholdBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.dict(os.environ, {'SUPABASE_DATABASE_URL': 'sqlite://'}), patch('dotenv.load_dotenv'):
            import main
            import auth
            from database import Base, get_db
            from models import Expense
            from sqlalchemy import create_engine
            from sqlalchemy.orm import sessionmaker
            from sqlalchemy.pool import StaticPool
            from fastapi.testclient import TestClient
        cls.app, cls.auth, cls.Expense = main.app, auth, Expense
        cls.get_db = staticmethod(get_db)
        cls.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)
        cls.client = TestClient(main.app)
        cls.addClassCleanup(cls.client.close)
        cls.addClassCleanup(cls.engine.dispose)

    def setUp(self):
        env = patch.dict(os.environ, {'SUPABASE_URL': 'https://synthetic.supabase.co',
            'SUPABASE_PUBLISHABLE_KEY': 'synthetic-public',
            'FAMILY_EMAIL_PROFILES': json.dumps({'member@example.invalid': 'nithish'})})
        env.start(); self.addCleanup(env.stop)
        self.identity = {'id': 'synthetic-auth-user', 'email': 'member@example.invalid',
                         'email_confirmed_at': 'synthetic-confirmed', 'aud': 'authenticated'}
        provider = patch.object(self.auth.httpx, 'get')
        self.provider = provider.start(); self.addCleanup(provider.stop)
        self.provider.return_value = Mock(status_code=200, json=lambda: self.identity)
        self.headers = {'Authorization': 'Bearer synthetic-token'}
        self.acquisitions = 0
        def database():
            self.acquisitions += 1
            with self.Session() as session:
                yield session
        self.app.dependency_overrides[self.get_db] = database
        self.addCleanup(self.app.dependency_overrides.clear)
        with self.Session() as session:
            session.query(self.Expense).delete(); session.commit()

    def protected_requests(self):
        from fastapi.routing import APIRoute
        for route in self.app.routes:
            if not isinstance(route, APIRoute) or not route.path.startswith('/api/') or route.path == '/api/reset':
                continue
            path = re.sub(r'\{[^}]+\}', 'synthetic-guessed-record', route.path)
            for method in route.methods:
                yield method, path

    def test_other_family_cannot_bypass_any_route_using_profile_or_record_ids(self):
        self.identity.update(email='other-family@example.invalid',
                             user_metadata={'profileId': 'nithish', 'familyId': 'approved'})
        for method, path in self.protected_requests():
            with self.subTest(method=method, path=path):
                response = self.client.request(method, path, headers={**self.headers, 'X-User-Id': 'nithish'},
                    params={'month': '2099-01', 'userId': 'mother', 'familyId': 'approved'},
                    json={'id': 'synthetic-guessed-record', 'userId': 'nithish', 'amount': 1})
                self.assertEqual(response.status_code, 403)
        self.assertEqual(self.acquisitions, 0)

    def test_invalid_and_expired_tokens_rejected_on_every_route_before_queries(self):
        for status in [401, 403]:
            self.provider.return_value = Mock(status_code=status)
            for method, path in self.protected_requests():
                with self.subTest(provider_status=status, method=method, path=path):
                    response = self.client.request(method, path, headers=self.headers)
                    self.assertEqual(response.status_code, 401)
        self.assertEqual(self.acquisitions, 0)

    def test_approved_members_share_household_expenses_and_retries_do_not_duplicate(self):
        body = {'id': 'synthetic-submission', 'userId': 'mother', 'amount': 1,
                'category': 'other', 'date': '2099-01-01', 'description': 'Synthetic test only'}
        for _ in range(2):
            response = self.client.post('/api/expenses', headers=self.headers, json=body)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()['id'], body['id'])
        response = self.client.get('/api/expenses', headers=self.headers, params={'month': '2099-01'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['expenses']), 1)
        self.assertEqual(response.json()['expenses'][0]['userId'], 'mother')
        response = self.client.delete('/api/expenses/' + body['id'], headers=self.headers)
        self.assertEqual(response.json(), {'deleted': True})
        self.assertEqual(self.client.delete('/api/expenses/' + body['id'], headers=self.headers).status_code, 404)
        with self.Session() as session:
            self.assertEqual(session.query(self.Expense).count(), 0)

    def test_reset_never_acquires_database_even_for_approved_member(self):
        response = self.client.delete('/api/reset', headers={**self.headers, 'X-Confirm-Reset': 'DELETE-ALL-DATA'})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.acquisitions, 0)
        self.provider.assert_not_called()

    def test_authenticated_ai_errors_remain_sanitized_and_retryable(self):
        from services import ai_service
        failure = ai_service.AIServiceError('AI_RATE_LIMITED', 'Please try again shortly.', True, 429)
        with patch.object(ai_service, 'chat', side_effect=failure):
            response = self.client.post('/api/ai/chat', headers=self.headers,
                json={'question': 'Synthetic test', 'context': {}, 'history': []})
        self.assertEqual(response.status_code, 429)
        self.assertTrue(response.json()['error']['retryable'])
        self.assertEqual(response.json()['error']['code'], 'AI_RATE_LIMITED')
        self.assertEqual(self.acquisitions, 0)

    def test_malformed_auth_configuration_fails_closed_without_traceback(self):
        with patch.dict(os.environ, {'SUPABASE_URL': 'https://['}):
            response = self.client.get('/api/auth/me', headers=self.headers)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['detail']['code'], 'AUTH_NOT_CONFIGURED')
        self.assertEqual(self.acquisitions, 0)
        self.provider.assert_not_called()


if __name__ == '__main__':
    unittest.main()
