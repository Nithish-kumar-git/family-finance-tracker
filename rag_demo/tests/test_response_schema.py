import json
import unittest
from unittest.mock import MagicMock

from rag_demo.config import Settings
from rag_demo.pipeline import GeminiProvider, grounded_answer


class ResponseSchemaTests(unittest.TestCase):
    passage = {"document_id": "synthetic", "filename": "cedar_travel.pdf", "page": 1,
               "text": "Obtain manager approval before booking a trip. Keep the written approval with the itinerary."}

    def provider(self, citation):
        result = {"answer": "A manager approves travel; keep written approval with the itinerary.",
                  "insufficient_evidence": False, "citations": [citation]}
        transport = MagicMock(return_value={"candidates": [{"content": {"parts": [{"text": json.dumps(result)}]}}]})
        return GeminiProvider(Settings(), transport), transport

    def test_generation_requires_quote_field_for_each_citation(self):
        provider, transport = self.provider({"source": 1, "quote": self.passage["text"]})
        result = grounded_answer("Who approves travel and what must be kept?", [self.passage], provider)
        self.assertFalse(result["abstained"])
        config = transport.call_args.args[2]["generationConfig"]
        self.assertEqual(config["maxOutputTokens"], 1500)
        self.assertEqual(config["temperature"], 0)
        schema = config["responseSchema"]
        self.assertEqual(set(schema["required"]), {"answer", "insufficient_evidence", "citations"})
        citation = schema["properties"]["citations"]["items"]
        self.assertEqual(set(citation["required"]), {"source", "quote"})
        self.assertEqual(citation["properties"]["source"]["type"], "INTEGER")
        self.assertEqual(citation["properties"]["quote"]["type"], "STRING")

    def test_live_field_drift_still_fails_closed_without_alias_repair(self):
        provider, _ = self.provider({"source": 1, "text": self.passage["text"]})
        result = grounded_answer("Who approves travel?", [self.passage], provider)
        self.assertTrue(result["abstained"])
        self.assertEqual(result["citations"], [])

    def test_schema_does_not_replace_exact_quote_validation(self):
        provider, _ = self.provider({"source": 1, "quote": "An administrator approves every booking."})
        self.assertTrue(grounded_answer("Who approves travel?", [self.passage], provider)["abstained"])
