import unittest
from backend.core.config import settings


class TestAIAssistantConfig(unittest.TestCase):

    def test_assistant_agent_config_exists(self):
        """Verify assistant agent is properly configured"""
        agent_config = settings.get_agent_config("assistant")
        self.assertIsNotNone(agent_config)
        self.assertIn("model", agent_config)
        self.assertIn("temperature", agent_config)
        self.assertIn("max_tokens", agent_config)

    def test_assistant_temperature_setting(self):
        """Verify assistant has appropriate temperature (creative but consistent)"""
        agent_config = settings.get_agent_config("assistant")
        temperature = agent_config.get("temperature")
        # Should be between 0.5 (balanced) and 0.9 (creative)
        self.assertGreaterEqual(temperature, 0.5)
        self.assertLessEqual(temperature, 0.9)


if __name__ == "__main__":
    unittest.main()
