"""Synthetic provider/route regressions. No dotenv, production DB, or network."""
import importlib
import json
import os
from pathlib import Path
import socket
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Block outbound requests even if a mock is accidentally removed.
def forbidden(*args, **kwargs):
    raise AssertionError('External network is forbidden')


_connect = socket.socket.connect


def guarded_connect(sock, address):
    # Windows asyncio implements its local wake-up pipe with socketpair TCP.
    # Permit only that standard-library call site; all app/provider traffic fails.
    caller = sys._getframe(1)
    if (caller.f_code.co_name == '_fallback_socketpair'
            and caller.f_code.co_filename == socket.__file__
            and address[0] in {'127.0.0.1', '::1'}):
        return _connect(sock, address)
    forbidden()


class AIAndResetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guards = [patch.dict(os.environ, {'GEMINI_API_KEY': 'synthetic-key',
                      'SUPABASE_DATABASE_URL': 'sqlite://'}),
                      patch('dotenv.load_dotenv', return_value=False),
                      patch.object(socket.socket, 'connect', guarded_connect),
                      patch('socket.getaddrinfo', forbidden)]
        for guard in cls.guards:
            guard.start()
            cls.addClassCleanup(guard.stop)
        cls.service = importlib.import_module('services.ai_service')
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from routers import ai, reset
        cls.app = FastAPI()
        cls.app.include_router(ai.router, prefix='/api')
        cls.app.include_router(reset.router, prefix='/api')
        cls.client = TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()


    def setUp(self):
        if hasattr(self.service, '_get_client'):
            self.service._get_client.cache_clear()
            self.addCleanup(self.service._get_client.cache_clear)
        self.client_stub = Mock()
        self.client_stub.models.generate_content.return_value = SimpleNamespace(text='Synthetic answer')
        self.constructor = patch.object(self.service.genai, 'Client', return_value=self.client_stub)
        self.factory = self.constructor.start()
        # The old implementation has an eager client; mock it to reproduce its failure behavior.
        self.old_client = patch.object(self.service, '_client', self.client_stub, create=True)
        self.old_client.start()
        self.addCleanup(self.constructor.stop)
        self.addCleanup(self.old_client.stop)
        self.payloads = {
            '/api/ai/chat': {'question': 'Synthetic question', 'context': {}, 'history': []},
            '/api/ai/parse-transaction': {'raw_text': 'Synthetic transaction'},
            '/api/ai/monthly-insights': {'report': {'synthetic': True}},
        }

    def test_provider_failures_are_explicit_and_consistent(self):
        for path, payload in self.payloads.items():
            for status, code, retryable in [(429, 'AI_RATE_LIMITED', True),
                    (503, 'AI_UNAVAILABLE', True), (403, 'AI_CONFIGURATION', False)]:
                with self.subTest(path=path, status=status):
                    error = RuntimeError('Synthetic internal secret MUST NOT appear')
                    error.code = status
                    self.client_stub.models.generate_content.side_effect = error
                    response = self.client.post(path, json=payload)
                    self.assertEqual(response.status_code, 429 if status == 429 else 503)
                    body = response.json()['error']
                    self.assertEqual(body['code'], code)
                    self.assertEqual(body['retryable'], retryable)
                    self.assertNotIn('secret', response.text)
                    self.assertNotIn('answer', response.json())

    def test_missing_or_placeholder_credentials_do_not_call_provider(self):
        for value in ['', '  ', 'your_gemini_api_key_here']:
            with self.subTest(value=value), patch.dict(os.environ, {'GEMINI_API_KEY': value}):
                response = self.client.post('/api/ai/chat', json=self.payloads['/api/ai/chat'])
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.json()['error']['code'], 'AI_NOT_CONFIGURED')
                self.assertFalse(response.json()['error']['retryable'])
        self.factory.assert_not_called()

    def test_empty_or_invalid_provider_output_is_not_success(self):
        for path, payload in self.payloads.items():
            for text in [None, '', ' ', '```\nnot-json\n```' if path != '/api/ai/chat' else '']:
                with self.subTest(path=path, text=text):
                    self.client_stub.models.generate_content.return_value = SimpleNamespace(text=text)
                    response = self.client.post(path, json=payload)
                    self.assertEqual(response.status_code, 503)
                    self.assertEqual(response.json()['error']['code'], 'AI_INVALID_RESPONSE')

    def test_unexpected_exception_is_sanitized(self):
        self.client_stub.models.generate_content.side_effect = RuntimeError('Synthetic sensitive key')
        response = self.client.post('/api/ai/chat', json=self.payloads['/api/ai/chat'])
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('sensitive', response.text)
        self.assertTrue(response.json()['error']['retryable'])

    def test_provider_timeout_is_retryable(self):
        import httpx
        self.client_stub.models.generate_content.side_effect = httpx.ReadTimeout('Synthetic private timeout detail')
        response = self.client.post('/api/ai/chat', json=self.payloads['/api/ai/chat'])
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['error']['code'], 'AI_TIMEOUT')
        self.assertTrue(response.json()['error']['retryable'])
        self.assertNotIn('private', response.text)

    def test_client_configuration_failure_is_not_retryable(self):
        self.factory.side_effect = ValueError('Synthetic private configuration')
        response = self.client.post('/api/ai/chat', json=self.payloads['/api/ai/chat'])
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['error']['code'], 'AI_CONFIGURATION')
        self.assertFalse(response.json()['error']['retryable'])

    def test_installed_sdk_accepts_configuration_without_network(self):
        self.constructor.stop()
        client = self.service._get_client('synthetic-key')
        self.assertIsNotNone(client.models)

    def test_success_contracts_remain_compatible(self):
        outputs = ['Synthetic answer', json.dumps({'amount': 1, 'category': 'other',
                   'description': 'Synthetic', 'confidence': 0.9}), json.dumps(['Synthetic'] * 5)]
        for (path, payload), text in zip(self.payloads.items(), outputs):
            self.client_stub.models.generate_content.return_value = SimpleNamespace(text=text)
            response = self.client.post(path, json=payload)
            self.assertEqual(response.status_code, 200)
        self.factory.assert_called_once()
        options = self.factory.call_args.kwargs['http_options']
        self.assertEqual(options.timeout, 20000)
        self.assertFalse(self.factory.call_args.kwargs['vertexai'])

    def test_reset_is_disabled_without_acquiring_database(self):
        from database import get_db
        calls = Mock(side_effect=AssertionError('Reset must never acquire a database'))
        self.app.dependency_overrides[get_db] = calls
        self.addCleanup(self.app.dependency_overrides.clear)
        for headers in [{}, {'X-Confirm-Reset': 'DELETE-ALL-DATA'},
                        {'Authorization': 'Bearer synthetic', 'X-Confirm-Reset': 'DELETE-ALL-DATA'}]:
            response = self.client.delete('/api/reset', headers=headers)
            self.assertEqual(response.status_code, 403)
        calls.assert_not_called()


if __name__ == '__main__':
    unittest.main()
