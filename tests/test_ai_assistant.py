import unittest
from unittest.mock import patch, MagicMock
from backend.core.config import settings
from backend.services.ai_assistant_service import AIAssistantService


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


class TestAIAssistantService(unittest.TestCase):

    @patch('backend.services.ai_assistant_service.call_volc_api')
    def test_chat_basic(self, mock_call_volc):
        """Test basic chat functionality"""
        mock_call_volc.return_value = "你好！有什么我可以帮助你的吗？"

        result = AIAssistantService.chat("你好")

        self.assertEqual(result, "你好！有什么我可以帮助你的吗？")
        mock_call_volc.assert_called_once_with(
            agent_role="assistant",
            user_input="你好",
            context={},
        )

    @patch('backend.services.ai_assistant_service.call_volc_api')
    def test_chat_with_context(self, mock_call_volc):
        """Test chat with context parameter (extensibility verification)"""
        mock_call_volc.return_value = "好的，我了解你的项目情况。"

        context = {"project_id": 1, "current_chapter": 3}
        result = AIAssistantService.chat("帮我看看这个项目", context=context)

        mock_call_volc.assert_called_once_with(
            agent_role="assistant",
            user_input="帮我看看这个项目",
            context=context,
        )


import json
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


class TestAIAssistantAPI(unittest.TestCase):

    @patch('backend.api.ai.AIAssistantService')
    def test_chat_endpoint_basic(self, mock_service):
        """Test POST /ai/chat endpoint with basic input"""
        mock_service.chat.return_value = "Hello from AI!"

        response = client.post(
            "/api/v1/ai/chat",  # Note: Full path including /api/v1 prefix
            json={"user_input": "Hello"}
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("content", data)
        self.assertEqual(data["content"], "Hello from AI!")
        mock_service.chat.assert_called_once_with(
            user_input="Hello",
            context=None,
        )

    @patch('backend.api.ai.AIAssistantService')
    def test_chat_endpoint_with_context(self, mock_service):
        """Test POST /ai/chat endpoint with context parameter"""
        mock_service.chat.return_value = "Got context"

        response = client.post(
            "/api/v1/ai/chat",  # Note: Full path including /api/v1 prefix
            json={
                "user_input": "Check project",
                "context": {"project_id": 1}
            }
        )

        self.assertEqual(response.status_code, 200)
        mock_service.chat.assert_called_once_with(
            user_input="Check project",
            context={"project_id": 1},
        )


if __name__ == "__main__":
    unittest.main()
