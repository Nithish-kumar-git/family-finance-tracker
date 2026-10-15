"""Offline regression checks for both supported RAG configuration paths."""
from contextlib import redirect_stdout
from io import StringIO
import unittest
from unittest.mock import patch

from rag_demo.config import Settings, from_environment
from rag_demo.run_local import main


class ModelConfigurationTests(unittest.TestCase):
    def test_default_matches_verified_local_generation_model(self):
        self.assertEqual(Settings().answer_model, "gemini-3.5-flash-lite")
        environment = {"RAG_DEMO_ENABLED": "1",
                       "RAG_DATABASE_URL": "postgresql://rag_app:synthetic@127.0.0.1:5544/fft_rag_demo"}
        with patch.dict("os.environ", environment, clear=True):
            self.assertEqual(from_environment().answer_model, Settings().answer_model)

    def test_environment_launcher_preserves_explicit_model_override(self):
        environment = {"RAG_DEMO_ENABLED": "1", "RAG_ANSWER_MODEL": "synthetic-model-override",
                       "RAG_DATABASE_URL": "postgresql://rag_app:synthetic@127.0.0.1:5544/fft_rag_demo"}
        with patch.dict("os.environ", environment, clear=True):
            self.assertEqual(from_environment().answer_model, "synthetic-model-override")

    def test_normal_launcher_uses_verified_default_and_private_prompts(self):
        self.check_launcher({}, "gemini-3.5-flash-lite")

    def test_normal_launcher_preserves_process_model_override(self):
        self.check_launcher({"RAG_ANSWER_MODEL": "synthetic-model-override"}, "synthetic-model-override")

    def check_launcher(self, environment, expected):
        with patch.dict("os.environ", environment, clear=True), \
                patch("rag_demo.run_local.getpass", side_effect=["synthetic-db-password", "synthetic-provider-key"]), \
                patch("rag_demo.app.create_app") as create, patch("uvicorn.run") as run, \
                redirect_stdout(StringIO()) as output:
            main()
        settings = create.call_args.args[0]
        self.assertEqual(settings.answer_model, expected)
        self.assertEqual(settings.dimensions, 768)
        self.assertEqual(settings.api_key, "synthetic-provider-key")
        self.assertNotIn("synthetic-db-password", output.getvalue())
        self.assertNotIn("synthetic-provider-key", output.getvalue())
        self.assertEqual(run.call_args.kwargs["host"], "127.0.0.1")
        self.assertEqual(run.call_args.kwargs["port"], 8001)
        self.assertFalse(run.call_args.kwargs["access_log"])
