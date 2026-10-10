"""Offline startup regression tests: unittest, synthetic URLs, no live services.

Run from the repository root with the backend dependencies installed:
python -I -B -m unittest discover -s backend/tests -v
"""

import os
from pathlib import Path
import re
import subprocess
import sys
import textwrap
import unittest


BACKEND = Path(__file__).resolve().parents[1]

# Each check uses a fresh interpreter with no inherited application credentials.
# Dotenv and the AI constructor are stubbed; DB connections and network are
# blocked and counted, not merely avoided by convention. No endpoint is called.
GUARDS = """
import os
import sys
import socket
from unittest.mock import patch

attempts = []
guarded_sites = []
def guard(event, args):
    if event in {'socket.connect', 'socket.getaddrinfo', 'socket.sendto', 'socket.bind'}:
        attempts.append('network')
        frame = sys._getframe(1)
        guarded_sites.append(os.path.basename(frame.f_code.co_filename) + ':' + str(frame.f_lineno))
        raise AssertionError('Network is forbidden in startup tests')
    if event == 'open' and isinstance(args[0], (str, bytes)):
        filename = os.fsdecode(args[0]).replace('\\\\', '/').rsplit('/', 1)[-1].lower()
        if filename.startswith('.env'):
            attempts.append('dotenv-read')
            raise AssertionError('Environment files are forbidden in startup tests')

sys.addaudithook(guard)
# urllib3 otherwise probes IPv6 using a loopback bind during import. Skip that
# platform probe rather than relaxing the network guard or starting a socket.
patch.object(socket, 'has_ipv6', False).start()
import dotenv
import sqlalchemy
from sqlalchemy.engine import Engine
import psycopg2
from google import genai

def forbidden_connection(*args, **kwargs):
    attempts.append('database')
    raise AssertionError('Database connections are forbidden in startup tests')

patch('dotenv.load_dotenv', return_value=False).start()
patch.object(Engine, 'connect', side_effect=forbidden_connection).start()
patch.object(Engine, 'raw_connection', side_effect=forbidden_connection).start()
patch.object(psycopg2, 'connect', side_effect=forbidden_connection).start()
ai_constructor = patch.object(genai, 'Client').start()
"""


class StartupTests(unittest.TestCase):
    def run_isolated(self, body, driver='psycopg'):
        # Synthetic destination is deliberately unreachable; guards forbid even
        # attempting a connection. Neither values nor child logs are printed.
        scheme = 'postgresql' if driver is None else f'postgresql+{driver}'
        environment = {
            'SUPABASE_DATABASE_URL': f'{scheme}://synthetic:synthetic@127.0.0.1:1/synthetic',
            'GEMINI_API_KEY': 'synthetic-not-a-real-key',
        }
        if os.name == 'nt':
            environment['SystemRoot'] = os.environ.get('SystemRoot', r'C:\Windows')
        script = (
            f'import sys\nsys.path.insert(0, {str(BACKEND)!r})\n'
            + GUARDS + '\n' + textwrap.dedent(body)
            + "\nassert attempts == [], 'Forbidden startup side effects: ' + ','.join(attempts) + ' sites=' + ','.join(guarded_sites)\nprint('PASS')\n"
        )
        result = subprocess.run(
            [sys.executable, '-I', '-B', '-c', script],
            env=environment, capture_output=True, text=True, timeout=60,
        )
        # Sanitized failure classification only: never echo arbitrary exception
        # messages, database URL representations, or application logs.
        classification = result.stderr.strip().splitlines()[-1].split(':', 1)[0] if result.stderr.strip() else 'unknown'
        frames = re.findall(r'File "([^"]+)", line (\d+)', result.stderr)
        locations = ', '.join(f'{Path(filename).name}:{line}' for filename, line in frames)
        forbidden = re.findall(r'Forbidden startup side effects: ([a-z,-]+)', result.stderr)
        sites = re.findall(r'sites=([\w.,:<>-]+)', result.stderr)
        self.assertEqual(result.returncode, 0, f'Isolated startup failed ({classification}; {locations}; guarded={forbidden}; sites={sites})')
        self.assertEqual(result.stdout.strip(), 'PASS')

    def test_required_psycopg_binary_distribution_is_declared(self):
        dependencies = (BACKEND / 'requirements.txt').read_text(encoding='utf-8').splitlines()
        self.assertIn('psycopg[binary]', dependencies)
        self.assertIn('psycopg2-binary', dependencies, 'Existing driver compatibility must remain')

    def test_exact_reported_failure_when_psycopg_module_is_missing(self):
        self.run_isolated("""
            import builtins
            import traceback
            original_import = builtins.__import__
            def missing_driver(name, *args, **kwargs):
                if name == 'psycopg':
                    raise ModuleNotFoundError("No module named 'psycopg'", name='psycopg')
                return original_import(name, *args, **kwargs)
            with patch.object(builtins, '__import__', side_effect=missing_driver):
                try:
                    import main
                except ModuleNotFoundError as error:
                    assert error.name == 'psycopg'
                    frames = traceback.extract_tb(error.__traceback__)
                    assert any(frame.filename.endswith('database.py') and frame.lineno == 13 for frame in frames)
                else:
                    raise AssertionError('Missing driver must reproduce the startup failure')
            ai_constructor.assert_not_called()
        """)

    def test_psycopg_engine_initializes_without_connecting(self):
        self.run_isolated("""
            import psycopg
            patch.object(psycopg, 'connect', side_effect=forbidden_connection).start()
            import database
            assert database.engine.dialect.driver == 'psycopg'
            assert str(database.engine.url) != ''
            assert database.engine.url == sqlalchemy.engine.make_url(os.environ['SUPABASE_DATABASE_URL'])
            assert database.SessionLocal.kw['bind'] is database.engine
            ai_constructor.assert_not_called()
        """)

    def test_full_entrypoint_import_with_psycopg_and_no_service_calls(self):
        self.run_isolated("""
            import psycopg
            patch.object(psycopg, 'connect', side_effect=forbidden_connection).start()
            import main
            import database
            assert database.engine.dialect.driver == 'psycopg'
            paths = set(main.app.openapi()['paths'])
            assert {'/health', '/api/expenses', '/api/ai/chat'} <= paths
            ai_constructor.assert_called_once_with(api_key='synthetic-not-a-real-key')
        """)

    def test_existing_psycopg2_entrypoint_still_imports_without_service_calls(self):
        self.run_isolated("""
            import main
            import database
            assert database.engine.dialect.driver == 'psycopg2'
            assert database.engine.url == sqlalchemy.engine.make_url(os.environ['SUPABASE_DATABASE_URL'])
            ai_constructor.assert_called_once_with(api_key='synthetic-not-a-real-key')
        """, driver='psycopg2')

    def test_default_postgresql_driver_also_imports_without_service_calls(self):
        self.run_isolated("""
            import psycopg
            patch.object(psycopg, 'connect', side_effect=forbidden_connection).start()
            import main
            import database
            assert database.engine.dialect.driver in {'psycopg', 'psycopg2'}
            assert database.engine.url == sqlalchemy.engine.make_url(os.environ['SUPABASE_DATABASE_URL'])
            ai_constructor.assert_called_once_with(api_key='synthetic-not-a-real-key')
        """, driver=None)


if __name__ == '__main__':
    unittest.main()
