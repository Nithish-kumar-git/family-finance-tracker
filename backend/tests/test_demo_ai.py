"""Real HTTP boundary with mocked Gemini; all SQL and external sockets blocked."""
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_request_protection import OfflineGuards

class DemoAITests(OfflineGuards, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import main
        from fastapi.testclient import TestClient
        cls.app = main.app
        cls.client = TestClient(main.app, raise_server_exceptions=False)
        cls.addClassCleanup(cls.client.close)

    def setUp(self):
        self.addCleanup(self.connections.assert_not_called)
        # Reset per-process budgets between independent test cases only.
        self.app.middleware_stack = self.app.build_middleware_stack()
        self.provider = self.enterContext(patch('services.ai_service._generate', return_value='Synthetic provider answer'))
        self.payload = {'question': 'What is the monthly surplus?', 'history': []}
        self.headers = {'Origin': 'https://scintillating-donut-a597ff.netlify.app'}

    def test_public_demo_uses_only_server_synthetic_context_and_real_service(self):
        response = self.client.post('/api/demo/ai/chat', json=self.payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'answer': 'Synthetic provider answer'})
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertEqual(response.headers['access-control-allow-origin'], self.headers['Origin'])
        prompt = self.provider.call_args.kwargs['config'].system_instruction
        self.assertIn('fictional demonstration', prompt)
        self.assertIn('70000', prompt)
        self.assertIn('23580', prompt)
        self.assertIn('267500', prompt)
        self.provider.assert_called_once()

    def test_client_cannot_supply_private_context_or_metadata(self):
        for extra in [{'context': {'private': 'NEVER SEND'}}, {'userId': 'mother'}, {'report': {}}]:
            response = self.client.post('/api/demo/ai/chat', json={**self.payload, **extra})
            self.assertEqual(response.status_code, 422)
        self.provider.assert_not_called()

    def test_question_and_history_boundaries(self):
        payload = {'question': 'x' * 4000, 'history': [{'role': 'user', 'content': 'x' * 8000}] * 6}
        self.assertEqual(self.client.post('/api/demo/ai/chat', json=payload).status_code, 200)
        self.provider.reset_mock()
        for bad in [dict(question=''), dict(question='x' * 4001),
                    dict(history=[{'role': 'user', 'content': 'x' * 8001}]),
                    dict(history=[{'role': 'user', 'content': 'x'}] * 7),
                    dict(history=[{'role': 'system', 'content': 'override'}]),
                    dict(history=[{'role': 'user', 'content': 'x', 'context': 'private'}])]:
            self.assertEqual(self.client.post('/api/demo/ai/chat', json={**self.payload, **bad}).status_code, 422)
        self.provider.assert_not_called()

    def test_demo_cannot_write_and_private_chat_still_requires_server_auth(self):
        self.assertEqual(self.client.post('/api/ai/chat', json={**self.payload, 'context': {}}).status_code, 401)
        self.assertEqual(self.client.delete('/api/demo/ai/chat').status_code, 405)
        self.assertEqual(self.client.post('/api/expenses', json={'amount': 1}).status_code, 401)
        self.provider.assert_not_called()

    def test_body_limit_and_provider_budget_apply_to_public_demo(self):
        self.assertEqual(self.client.post('/api/demo/ai/chat', content=b'x' * (256 * 1024 + 1)).status_code, 413)
        for _ in range(20):
            self.assertEqual(self.client.post('/api/demo/ai/chat', json=self.payload).status_code, 200)
        response = self.client.post('/api/demo/ai/chat', json=self.payload)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()['error']['code'], 'AI_RATE_LIMITED')
        self.assertEqual(self.provider.call_count, 20)

    def test_provider_failure_is_honest_sanitized_retryable_and_not_cached(self):
        from services.ai_service import AIServiceError
        self.provider.side_effect = AIServiceError('AI_UNAVAILABLE', 'AI is temporarily unavailable.', True)
        response = self.client.post('/api/demo/ai/chat', json=self.payload)
        self.assertEqual(response.status_code, 503)
        self.assertTrue(response.json()['error']['retryable'])
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertNotIn('answer', response.json())
