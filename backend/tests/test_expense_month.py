"""HTTP month validation with synthetic identities and no SQL/provider access."""
import os
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class ExpenseMonthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from sqlalchemy.engine import Engine
        cls.connections = Mock(side_effect=AssertionError('Database connections are forbidden'))
        for method in ['connect', 'raw_connection']:
            guard = patch.object(Engine, method, cls.connections)
            guard.start()
            cls.addClassCleanup(guard.stop)
        with patch.dict(os.environ, {'SUPABASE_DATABASE_URL': 'sqlite://'}), patch('dotenv.load_dotenv'):
            import main
            import auth
            from database import get_db
            from fastapi.testclient import TestClient
            from services import ai_service
        cls.app, cls.auth, cls.ai_service = main.app, auth, ai_service
        cls.get_db = staticmethod(get_db)
        cls.client = TestClient(main.app)
        cls.addClassCleanup(cls.client.close)

    def setUp(self):
        self.db = Mock()
        self.query = Mock()
        self.db.query.return_value = self.query
        self.query.filter.return_value = self.query
        self.query.order_by.return_value = self.query
        self.query.all.return_value = []
        self.query.delete.return_value = 2
        self.app.dependency_overrides[self.get_db] = lambda: self.db
        # Exercise query validation after a synthetic identity is authorized.
        # Authentication itself remains covered by test_authorization.py.
        self.app.dependency_overrides[self.auth.require_family_member] = lambda: {'profileId': 'nithish'}
        self.addCleanup(self.app.dependency_overrides.clear)
        self.addCleanup(self.connections.assert_not_called)
        provider = patch.object(self.auth.httpx, 'get', side_effect=AssertionError('Provider access forbidden'))
        self.auth_provider = provider.start()
        self.addCleanup(provider.stop)
        self.addCleanup(self.auth_provider.assert_not_called)
        ai = patch.object(self.ai_service, '_generate', side_effect=AssertionError('AI access forbidden'))
        self.ai_provider = ai.start()
        self.addCleanup(ai.stop)
        self.addCleanup(self.ai_provider.assert_not_called)

    def assert_invalid_months(self, method, path):
        invalid = ['%', '_', '2099-99', '2026-00', '2026-13', '', 'malformed',
                   '2026-1', '26-01', '02026-01', '2026/01', '2026-01-01',
                   ' 2026-01', '2026-01 ', '2026-01\n', '2026-01\x00',
                   '2026-%', '2026-_', '2026-01%', '２０２６-０１',
                   '0000-01', '-001-01', '+026-01']
        for month in invalid:
            with self.subTest(method=method, month=repr(month)):
                self.db.reset_mock()
                self.query.reset_mock()
                response = self.client.request(method, path, params={'month': month})
                self.assertEqual(response.status_code, 422)
                self.assertTrue(any(error['loc'] == ['query', 'month'] for error in response.json()['detail']))
                self.assertEqual(self.db.mock_calls, [], 'Invalid month must not touch any session operation')
                self.assertEqual(self.query.mock_calls, [])

    def test_listing_rejects_invalid_months_before_database_operations(self):
        self.assert_invalid_months('GET', '/api/expenses')

    def test_bulk_delete_rejects_invalid_months_before_database_operations(self):
        self.assert_invalid_months('DELETE', '/api/expenses/bulk')

    def test_missing_month_remains_required_on_both_endpoints(self):
        for method, path in [('GET', '/api/expenses'), ('DELETE', '/api/expenses/bulk')]:
            with self.subTest(method=method):
                response = self.client.request(method, path)
                self.assertEqual(response.status_code, 422)
                self.assertEqual(self.db.mock_calls, [])

    def assert_filters(self, month, user_id):
        from sqlalchemy.sql import operators
        self.db.query.assert_called_once()
        filters = self.query.filter.call_args_list
        self.assertEqual(len(filters), 2 if user_id else 1)
        month_filter = filters[0].args[0]
        self.assertEqual(month_filter.left.name, 'date')
        self.assertIs(month_filter.operator, operators.like_op)
        self.assertEqual(month_filter.right.value, month + '%')
        if user_id:
            user_filter = filters[1].args[0]
            self.assertEqual(user_filter.left.name, 'userId')
            self.assertIs(user_filter.operator, operators.eq)
            self.assertEqual(user_filter.right.value, user_id)

    def test_valid_months_preserve_listing_filters_rows_and_totals(self):
        for month in ['2026-01', '2026-12', '0001-01', '9999-12']:
            for user_id in [None, 'mother']:
                with self.subTest(month=month, user_id=user_id):
                    self.db.reset_mock()
                    self.query.reset_mock()
                    self.query.all.return_value = [SimpleNamespace(id='synthetic-expense',
                        userId='mother', amount=1.0, category='other', description='Synthetic',
                        date=month + '-01', isRecurring=False, created_at=None, updated_at=None)]
                    params = {'month': month, **({'userId': user_id} if user_id else {})}
                    response = self.client.get('/api/expenses', params=params)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()['expenses'][0]['date'], month + '-01')
                    self.assertEqual(response.json()['category_totals']['other'], 1.0)
                    self.assert_filters(month, user_id)
                    self.query.all.assert_called_once_with()
                    self.query.delete.assert_not_called()
                    self.db.commit.assert_not_called()

    def test_valid_months_preserve_bulk_delete_filters_count_and_commit(self):
        for month in ['2026-01', '2026-12', '0001-01', '9999-12']:
            for user_id in [None, 'mother']:
                with self.subTest(month=month, user_id=user_id):
                    self.db.reset_mock()
                    self.query.reset_mock()
                    params = {'month': month, **({'userId': user_id} if user_id else {})}
                    response = self.client.delete('/api/expenses/bulk', params=params)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json(), {'deleted': 2})
                    self.assert_filters(month, user_id)
                    self.query.delete.assert_called_once_with(synchronize_session=False)
                    self.db.commit.assert_called_once_with()
                    self.query.all.assert_not_called()

    def test_both_routes_still_require_authentication(self):
        del self.app.dependency_overrides[self.auth.require_family_member]
        for method, path in [('GET', '/api/expenses'), ('DELETE', '/api/expenses/bulk')]:
            with self.subTest(method=method):
                response = self.client.request(method, path, params={'month': '2026-01'})
                self.assertEqual(response.status_code, 401)
                self.assertEqual(self.db.mock_calls, [])


if __name__ == '__main__':
    unittest.main()
