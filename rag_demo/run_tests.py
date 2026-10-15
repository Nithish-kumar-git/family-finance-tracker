"""Offline test runner. Optional --dependencies points at an isolated install."""
import argparse
from pathlib import Path
import os
import socket
import sys
import unittest

parser = argparse.ArgumentParser()
parser.add_argument("--dependencies")
parser.add_argument("--evaluate-mock", action="store_true", help="Run aggregate-only synthetic evaluation with network blocked")
args = parser.parse_args()
if args.dependencies:
    sys.path.insert(0, str(Path(args.dependencies).resolve()))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Remove all inherited application settings before importing tested modules.
for name in list(os.environ):
    if name.startswith(("RAG_", "SUPABASE_", "GEMINI_", "GOOGLE_")):
        del os.environ[name]
socket.has_ipv6 = False
def guard(event, arguments):
    if event in {"socket.connect", "socket.getaddrinfo", "socket.bind", "socket.sendto"}:
        # Windows asyncio uses stdlib socketpair() for its internal wake-up pipe.
        # Permit only that stdlib frame and its loopback endpoint, not app I/O.
        frame = sys._getframe(1)
        while frame:
            if frame.f_code.co_name == "_fallback_socketpair" and frame.f_globals.get("__name__") == "socket":
                address = arguments[1] if len(arguments) > 1 else None
                if event in {"socket.bind", "socket.connect"} and isinstance(address, tuple) and address[0] in {"127.0.0.1", "::1"}:
                    return
            frame = frame.f_back
        raise AssertionError("External network and databases are blocked in RAG tests")
    if event == "open" and isinstance(arguments[0], (str, bytes)):
        name = os.path.basename(os.fsdecode(arguments[0])).lower()
        if name.startswith(".env"):
            raise AssertionError("Environment-file reads are blocked")
sys.addaudithook(guard)
if args.evaluate_mock:
    from rag_demo.evaluate import run_mock, print_report
    try:
        report = run_mock()
    except Exception:
        sys.exit("Mock evaluation failed; no raw diagnostic payload is printed")
    sys.exit(print_report(report))
suite = unittest.defaultTestLoader.discover(str(Path(__file__).parent / "tests"), pattern="test_*.py")
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(not result.wasSuccessful())
