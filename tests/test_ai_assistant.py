import unittest
from backend.core.config import settings


class TestAIAssistantConfig(unittest.TestCase):

    def test_assistant_agent_model_configured(self):
        """Verify assistant agent model is properly configured via Settings pattern"""
        model = settings.get_model_for_agent("assistant")
        self.assertIsInstance(model, str)
        self.assertGreater(len(model), 0)  # Should have a non-empty model name

    def test_assistant_temperature_setting(self):
        """Verify assistant has appropriate temperature (creative but consistent)"""
        temperature = settings.get_temperature_for_agent("assistant")
        # Should be between 0.5 (balanced) and 0.9 (creative)
        self.assertGreaterEqual(temperature, 0.5)
        self.assertLessEqual(temperature, 0.9)


if __name__ == "__main__":
    unittest.main()
