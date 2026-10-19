"""Synthetic HTTP input limits: no database connections or external providers."""
import importlib
import json
import os
from pathlib import Path
import socket
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_ai_reset import guarded_connect, forbidden


class AIInputTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from sqlalchemy.engine import Engine
        cls.connections = Mock(side_effect=AssertionError('Database access forbidden'))
        for guard in [
            patch.object(Engine, 'connect', cls.connections),
            patch.object(Engine, 'raw_connection', cls.connections),
            patch.dict(os.environ, {'SUPABASE_DATABASE_URL': 'sqlite://',
                                    'GEMINI_API_KEY': 'synthetic-key'}),
            patch('dotenv.load_dotenv', return_value=False),
            patch.object(socket.socket, 'connect', guarded_connect),
            patch('socket.getaddrinfo', forbidden),
        ]:
            guard.start()
            cls.addClassCleanup(guard.stop)
        cls.service = importlib.import_module('services.ai_service')
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from routers import ai
        app = FastAPI()
        app.include_router(ai.router, prefix='/api')
        cls.client = TestClient(app)
        cls.addClassCleanup(cls.client.close)

    def setUp(self):
        self.payload = {'question': 'Synthetic question', 'context': {}, 'history': []}
        provider = patch.object(self.service, '_generate', return_value='Synthetic answer')
        self.provider = provider.start()
        self.addCleanup(provider.stop)
        factory = patch.object(self.service.genai, 'Client', side_effect=AssertionError('Provider forbidden'))
        self.factory = factory.start()
        self.addCleanup(factory.stop)
        self.addCleanup(self.factory.assert_not_called)
        self.addCleanup(self.connections.assert_not_called)

    def reject(self, payload, path='/api/ai/chat'):
        self.provider.reset_mock()
        response = self.client.post(path, json=payload)
        self.assertEqual(response.status_code, 422)
        self.provider.assert_not_called()

    def accept_chat(self, payload):
        self.provider.reset_mock()
        response = self.client.post('/api/ai/chat', json=payload)
        self.assertEqual(response.status_code, 200, response.text[:300])
        self.assertEqual(response.json(), {'answer': 'Synthetic answer'})
        self.provider.assert_called_once()
        return self.provider.call_args.kwargs

    @staticmethod
    def sized_object(size):
        overhead = len(json.dumps({'note': ''}).encode('utf-8'))
        return {'note': 'x' * (size - overhead)}

    def test_question_boundaries_preserve_content(self):
        for question in ['x', 'x' * 3999, 'x' * 4000, '₹' * 4000, '  Synthetic question ₹  ']:
            with self.subTest(length=len(question)):
                sent = self.accept_chat({**self.payload, 'question': question})
                self.assertEqual(sent['contents'][-1].parts[0].text, question)

    def test_oversized_question_regression_and_invalid_values(self):
        for question in ['x' * 4001, 'x' * 100001, '', '   ', '\n\t', None, ['x']]:
            with self.subTest(type=type(question).__name__, length=len(question) if question is not None else 0):
                self.reject({**self.payload, 'question': question})

    def test_history_count_boundary_forwards_all_six_messages(self):
        history = [{'role': 'user' if n % 2 == 0 else 'model',
                    'content': f'  Synthetic message {n} ₹  '} for n in range(6)]
        sent = self.accept_chat({**self.payload, 'history': history})
        self.assertEqual([item.parts[0].text for item in sent['contents']],
                         [item['content'] for item in history] + [self.payload['question']])
        self.assertEqual([item.role for item in sent['contents'][:-1]],
                         [item['role'] for item in history])
        self.reject({**self.payload, 'history': history + [history[0]]})
        # Reject rather than silently discard an oversized oldest message.
        self.reject({**self.payload, 'history': [{'content': 'x' * 100001}] + history})

    def test_history_message_size_boundary(self):
        for length in [7999, 8000]:
            sent = self.accept_chat({**self.payload, 'history': [{'role': 'user', 'content': 'x' * length}]})
            self.assertEqual(sent['contents'][0].parts[0].text, 'x' * length)
        for content in ['x' * 8001, 'x' * 100001, None, ['x'], {'text': 'x'}]:
            self.reject({**self.payload, 'history': [{'role': 'user', 'content': content}]})

    def test_history_serialized_size_boundary_includes_extra_fields(self):
        history = [{'role': 'user', 'content': 'Synthetic', 'metadata': ''}]
        overhead = len(json.dumps(history).encode('utf-8'))
        history[0]['metadata'] = 'x' * (48 * 1024 - overhead)
        self.accept_chat({**self.payload, 'history': history})
        history[0]['metadata'] += 'x'
        self.reject({**self.payload, 'history': history})

    def test_history_serialized_budget_counts_unicode_and_roles(self):
        self.reject({**self.payload, 'history': [
            {'role': 'model', 'content': '₹' * 8000} for _ in range(6)]})
        self.reject({**self.payload, 'history': [{'role': 'x' * (48 * 1024), 'content': ''}]})

    def test_invalid_container_types_do_not_reach_provider(self):
        for replacement in [{'context': []}, {'context': None}, {'history': {}},
                            {'history': ['Synthetic']}, {'history': None}]:
            self.reject({**self.payload, **replacement})

    def test_combined_history_budget_and_context_budget(self):
        history = [{'role': 'model', 'content': 'x' * 8000} for _ in range(6)]
        sent = self.accept_chat({**self.payload, 'history': history,
                                 'question': 'x' * 4000,
                                 'context': self.sized_object(32 * 1024)})
        self.assertEqual(len(sent['contents']), 7)
        for limit in [32 * 1024 - 1, 32 * 1024]:
            context = self.sized_object(limit)
            sent = self.accept_chat({**self.payload, 'context': context})
            self.assertTrue(sent['config'].system_instruction.endswith(json.dumps(context)))
        self.reject({**self.payload, 'context': self.sized_object(32 * 1024 + 1)})

    def test_context_counts_nested_values_keys_unicode_and_escaping(self):
        for context in [{'nested': [{'note': 'x' * (32 * 1024)}]},
                        {'x' * (32 * 1024): ''}, {'note': '₹' * 6000},
                        {'note': '"' * 17000}]:
            self.reject({**self.payload, 'context': context})
        context = {'nested': [{'note': '  ₹ தமிழ் "synthetic"  ', 'amount': 123.45}]}
        sent = self.accept_chat({**self.payload, 'context': context})
        self.assertTrue(sent['config'].system_instruction.endswith(json.dumps(context)))

    def test_other_ai_routes_bound_provider_inputs_without_changing_responses(self):
        self.provider.return_value = json.dumps({'amount': 12, 'category': 'other',
                                                'description': 'Synthetic', 'confidence': 0.9})
        response = self.client.post('/api/ai/parse-transaction', json={'raw_text': 'x' * 8000})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(self.provider.call_args.kwargs['contents'].endswith('x' * 8000))
        self.reject({'raw_text': 'x' * 8001}, '/api/ai/parse-transaction')
        self.provider.return_value = json.dumps(['Synthetic insight'] * 5)
        report = self.sized_object(64 * 1024)
        response = self.client.post('/api/ai/monthly-insights', json={'report': report})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {'insights': ['Synthetic insight'] * 5})
        self.assertIn(json.dumps(report), self.provider.call_args.kwargs['contents'])
        self.reject({'report': self.sized_object(64 * 1024 + 1)}, '/api/ai/monthly-insights')
        self.reject({'report': {'nested': [{'note': '₹' * 12000}]}}, '/api/ai/monthly-insights')


if __name__ == '__main__':
    unittest.main()
