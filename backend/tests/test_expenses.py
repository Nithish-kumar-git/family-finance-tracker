"""Expense commit acknowledgement and idempotent retry tests on synthetic SQLite."""
from pathlib import Path
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class ExpenseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.dict(os.environ, {'SUPABASE_DATABASE_URL': 'sqlite://'}), patch('dotenv.load_dotenv'):
            from database import Base
            from models import Expense
            from routers.expenses import create_expense, delete_expense
            from schemas import ExpenseCreate
            from sqlalchemy import create_engine
            from sqlalchemy.orm import sessionmaker
        cls.Expense = Expense
        cls.ExpenseCreate = ExpenseCreate
        cls.create = staticmethod(create_expense)
        cls.delete = staticmethod(delete_expense)
        cls.engine = create_engine('sqlite://')
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)
        cls.addClassCleanup(cls.engine.dispose)

    def setUp(self):
        self.db = self.Session()
        self.addCleanup(self.db.close)
        self.db.query(self.Expense).delete()
        self.db.commit()
        self.body = self.ExpenseCreate(id='synthetic-submission', userId='synthetic-user',
            amount=1, category='other', date='2026-10-16', description='Synthetic')

    def test_retry_after_commit_returns_existing_record_without_duplicate(self):
        first = self.create(self.body, self.db)
        retry = self.create(self.body, self.db)
        self.assertEqual(first.id, retry.id)
        self.assertEqual(self.db.query(self.Expense).count(), 1)

    def test_reused_id_with_changed_content_is_rejected_without_overwrite(self):
        from fastapi import HTTPException
        self.create(self.body, self.db)
        changed = self.body.model_copy(update={'amount': 2})
        with self.assertRaises(HTTPException) as caught:
            self.create(changed, self.db)
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(self.db.query(self.Expense).one().amount, 1)

    def test_failed_commit_does_not_return_save_acknowledgement(self):
        with patch.object(self.db, 'commit', side_effect=RuntimeError('Synthetic commit failure')):
            with self.assertRaises(RuntimeError):
                self.create(self.body, self.db)
        self.db.rollback()
        self.assertEqual(self.db.query(self.Expense).count(), 0)

    def test_overlapping_retry_is_resolved_by_primary_key_without_duplicate(self):
        from sqlalchemy import event
        def competing_commit(session):
            other = self.Session()
            try:
                other.add(self.Expense(**self.body.model_dump()))
                other.commit()
            finally:
                other.close()
        event.listen(self.db, 'before_commit', competing_commit, once=True)
        saved = self.create(self.body, self.db)
        self.assertEqual(saved.id, self.body.id)
        self.assertEqual(self.db.query(self.Expense).count(), 1)

    def test_delete_commits_before_acknowledgement_and_missing_row_is_error(self):
        from fastapi import HTTPException
        self.create(self.body, self.db)
        self.assertEqual(self.delete(self.body.id, self.db), {'deleted': True})
        self.assertEqual(self.db.query(self.Expense).count(), 0)
        with self.assertRaises(HTTPException) as caught:
            self.delete(self.body.id, self.db)
        self.assertEqual(caught.exception.status_code, 404)

    def test_delete_commit_failure_leaves_record_after_rollback(self):
        self.create(self.body, self.db)
        with patch.object(self.db, 'commit', side_effect=RuntimeError('Synthetic commit failure')):
            with self.assertRaises(RuntimeError):
                self.delete(self.body.id, self.db)
        self.db.rollback()
        self.assertEqual(self.db.query(self.Expense).count(), 1)


if __name__ == '__main__':
    unittest.main()
