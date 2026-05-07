from __future__ import annotations

import unittest
from types import SimpleNamespace

from backend.core.llm.model_registry import resolve_model_route
from backend.core.llm.providers.openai_compat import OpenAICompatibleProvider
from backend.core.llm.router import LLMRouter
from backend.core.llm.types import LLMError, LLMRequest


class FakeMessage:
    def __init__(self, content: str | None):
        self.content = content


class FakeChoice:
    def __init__(self, content: str | None):
        self.message = FakeMessage(content)


class FakeUsage:
    def __init__(
        self,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        total_tokens: int | None = None,
    ):
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        if total_tokens is not None:
            self.total_tokens = total_tokens


class FakeResponse:
    def __init__(
        self,
        content: str | None = "ok",
        usage: FakeUsage | None = None,
        choices: list[FakeChoice] | None = None,
    ):
        self.choices = choices if choices is not None else [FakeChoice(content)]
        self.usage = usage


class FakeCompletions:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return response


class FakeClient:
    def __init__(self, responses):
        self.chat = SimpleNamespace(completions=FakeCompletions(responses))


class FakeProviderError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class LLMRuntimeTests(unittest.TestCase):
    def make_request(self, **overrides) -> LLMRequest:
        payload = {
            "agent_role": "writer",
            "system_prompt": "system",
            "user_input": "user",
            "model": "demo-model",
            "temperature": 0.7,
            "max_tokens": 1024,
            "timeout": 180,
            "provider": "openai_compatible",
        }
        payload.update(overrides)
        return LLMRequest(**payload)

    def test_openai_compatible_provider_sends_standard_chat_completion_payload(self):
        client = FakeClient([FakeResponse("生成成功", FakeUsage(10, 7, 17))])
        provider = OpenAICompatibleProvider(client=client)

        response = provider.complete(self.make_request())

        self.assertEqual(response.content, "生成成功")
        self.assertEqual(response.usage.prompt_tokens, 10)
        self.assertEqual(response.usage.completion_tokens, 7)
        self.assertEqual(response.usage.total_tokens, 17)
        self.assertEqual(client.chat.completions.calls, [
            {
                "model": "demo-model",
                "messages": [
                    {"role": "system", "content": "system"},
                    {"role": "user", "content": "user"},
                ],
                "temperature": 0.7,
                "max_tokens": 1024,
                "timeout": 180,
            }
        ])

    def test_openai_compatible_provider_normalizes_empty_content_to_safe_space(self):
        client = FakeClient([FakeResponse(choices=[])])
        provider = OpenAICompatibleProvider(client=client)

        response = provider.complete(self.make_request())

        self.assertEqual(response.content, " ")
        self.assertIsNone(response.usage)

    def test_openai_compatible_provider_computes_total_tokens_when_provider_omits_it(self):
        client = FakeClient([FakeResponse("ok", FakeUsage(prompt_tokens=3, completion_tokens=4))])
        provider = OpenAICompatibleProvider(client=client)

        response = provider.complete(self.make_request())

        self.assertEqual(response.usage.prompt_tokens, 3)
        self.assertEqual(response.usage.completion_tokens, 4)
        self.assertEqual(response.usage.total_tokens, 7)

    def test_model_route_uses_existing_settings_by_default(self):
        class Settings:
            base_url = "https://example.test/v1"
            default_prompt_price = 0.1
            default_completion_price = 0.2

            def get_model_for_agent(self, agent_role):
                return f"{agent_role}-model"

            def get_api_key_for_agent(self, agent_role):
                return f"{agent_role}-key"

        route = resolve_model_route("critic", settings=Settings())

        self.assertEqual(route.provider, "openai_compatible")
        self.assertEqual(route.model, "critic-model")
        self.assertEqual(route.api_key, "critic-key")
        self.assertEqual(route.base_url, "https://example.test/v1")
        self.assertEqual(route.prompt_price, 0.1)
        self.assertEqual(route.completion_price, 0.2)

    def test_model_route_allows_project_config_agent_override(self):
        class Settings:
            base_url = "https://default.test/v1"
            default_prompt_price = 0.1
            default_completion_price = 0.2

            def get_model_for_agent(self, agent_role):
                return "default-model"

            def get_api_key_for_agent(self, agent_role):
                return "default-key"

        project_config = {
            "llm": {
                "providers": {
                    "deepseek": {
                        "base_url": "https://api.deepseek.com",
                        "api_key": "deepseek-key",
                        "prompt_price": 0.01,
                        "completion_price": 0.02,
                    }
                },
                "agents": {
                    "writer": {
                        "provider": "deepseek",
                        "model": "deepseek-chat",
                    }
                },
            }
        }

        route = resolve_model_route("writer", settings=Settings(), project_config=project_config)

        self.assertEqual(route.provider, "deepseek")
        self.assertEqual(route.model, "deepseek-chat")
        self.assertEqual(route.api_key, "deepseek-key")
        self.assertEqual(route.base_url, "https://api.deepseek.com")
        self.assertEqual(route.prompt_price, 0.01)
        self.assertEqual(route.completion_price, 0.02)

    def test_router_retries_transient_provider_failures(self):
        client = FakeClient([RuntimeError("temporary"), FakeResponse("恢复成功")])
        provider = OpenAICompatibleProvider(client=client)
        router = LLMRouter(providers={"openai_compatible": provider})

        response = router.complete(self.make_request(max_retries=2), sleep=lambda _: None)

        self.assertEqual(response.content, "恢复成功")
        self.assertEqual(len(client.chat.completions.calls), 2)

    def test_router_classifies_auth_errors_without_retrying(self):
        client = FakeClient([FakeProviderError("invalid api key", status_code=401), FakeResponse("不应调用")])
        provider = OpenAICompatibleProvider(client=client)
        router = LLMRouter(providers={"openai_compatible": provider})

        with self.assertRaises(LLMError) as ctx:
            router.complete(self.make_request(max_retries=3), sleep=lambda _: None)

        self.assertEqual(ctx.exception.category, "auth")
        self.assertFalse(ctx.exception.retryable)
        self.assertIn("API Key", str(ctx.exception))
        self.assertEqual(len(client.chat.completions.calls), 1)

    def test_router_retries_rate_limit_errors_before_succeeding(self):
        client = FakeClient([FakeProviderError("rate limit exceeded", status_code=429), FakeResponse("限流后恢复")])
        provider = OpenAICompatibleProvider(client=client)
        router = LLMRouter(providers={"openai_compatible": provider})

        response = router.complete(self.make_request(max_retries=2), sleep=lambda _: None)

        self.assertEqual(response.content, "限流后恢复")
        self.assertEqual(len(client.chat.completions.calls), 2)

    def test_openai_compatible_provider_can_reset_cached_client_after_transport_failure(self):
        created_clients: list[FakeClient] = []

        def factory(api_key, base_url):
            client = FakeClient([FakeResponse(f"client-{len(created_clients) + 1}")])
            created_clients.append(client)
            return client

        provider = OpenAICompatibleProvider(client_factory=factory)
        request = self.make_request(api_key="key-1", base_url="https://provider.test")

        first = provider.complete(request)
        provider.reset_client(api_key="key-1", base_url="https://provider.test")
        second = provider.complete(request)

        self.assertEqual(first.content, "client-1")
        self.assertEqual(second.content, "client-2")
        self.assertEqual(len(created_clients), 2)

    def test_router_resets_compatible_provider_cache_for_provider_alias(self):
        created_clients: list[FakeClient] = []

        def factory(api_key, base_url):
            client = FakeClient([FakeResponse(f"client-{len(created_clients) + 1}")])
            created_clients.append(client)
            return client

        provider = OpenAICompatibleProvider(client_factory=factory)
        router = LLMRouter(providers={"openai_compatible": provider})
        request = self.make_request(
            provider="deepseek",
            api_key="key-1",
            base_url="https://provider.test",
        )

        first = router.complete(request)
        router.reset_provider_cache("deepseek", "key-1", "https://provider.test")
        second = router.complete(request)

        self.assertEqual(first.content, "client-1")
        self.assertEqual(second.content, "client-2")
        self.assertEqual(len(created_clients), 2)


if __name__ == "__main__":
    unittest.main()
