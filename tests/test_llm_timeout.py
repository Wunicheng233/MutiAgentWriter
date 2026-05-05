"""测试 LLM API 调用是否有超时保护"""
import unittest
from unittest.mock import MagicMock, patch

from backend.utils.volc_engine import call_volc_api


class LLMTimeoutTests(unittest.TestCase):
    def setUp(self):
        self.load_prompt_patch = patch(
            "backend.utils.file_utils.load_prompt",
            return_value="You are a test assistant",
        )
        self.load_prompt_patch.start()
        self.mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Test response"
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 10
        self.mock_client.chat.completions.create.return_value = mock_response

    def tearDown(self):
        self.load_prompt_patch.stop()

    def test_llm_api_call_has_timeout(self):
        """测试：LLM API 调用应该包含 timeout 参数"""
        # 注意：不能用 max_retries=0，否则 while 循环不会执行
        call_volc_api("planner", "test prompt", max_retries=1, client=self.mock_client)

        # 验证：create 方法被调用时包含 timeout 参数
        self.mock_client.chat.completions.create.assert_called_once()
        call_kwargs = self.mock_client.chat.completions.create.call_args[1]
        self.assertIn("timeout", call_kwargs, "LLM 调用必须包含 timeout 参数")
        self.assertGreater(call_kwargs["timeout"], 0, "timeout 必须大于 0")

    def test_llm_api_timeout_value(self):
        """测试：LLM API 的 timeout 值应该合理（建议 120-300 秒）"""
        call_volc_api("planner", "test prompt", max_retries=1, client=self.mock_client)

        call_kwargs = self.mock_client.chat.completions.create.call_args[1]
        timeout = call_kwargs.get("timeout")

        # timeout 应该在合理范围内：120秒（2分钟）到 600秒（10分钟）
        self.assertGreaterEqual(timeout, 120)
        self.assertLessEqual(timeout, 600)


if __name__ == "__main__":
    unittest.main()
