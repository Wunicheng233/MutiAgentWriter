import openai
import time
from backend.utils.logger import logger
from backend.utils.file_utils import load_prompt
from backend.core.llm.model_registry import ModelRoute, resolve_model_route
from backend.core.llm.router import LLMRouter
from backend.core.llm.types import LLMRequest

# LLM API 调用超时设置（秒）
LLM_API_TIMEOUT = 180  # 3分钟，对于长文本生成应该足够

# 优先使用新的统一配置中心，如果不存在回退到旧配置
try:
    from backend.core.config import settings
    USE_NEW_CONFIG = True
except ImportError:
    from backend.config import API_KEYS, BASE_URL, MODELS, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, TEMPERATURES, WRITER_MAX_TOKENS
    USE_NEW_CONFIG = False

_client_cache: dict[str, openai.OpenAI] = {}
_runtime_router = LLMRouter()

def _get_client(agent_role: str) -> openai.OpenAI:
    """获取或创建OpenAI客户端"""
    if agent_role in _client_cache:
        return _client_cache[agent_role]

    if USE_NEW_CONFIG:
        from backend.core.config import settings
        api_key = settings.get_api_key_for_agent(agent_role)
        base_url = settings.base_url
    else:
        api_key = API_KEYS.get(agent_role, API_KEYS.get("default", ""))
        base_url = BASE_URL

    client = openai.OpenAI(api_key=api_key, base_url=base_url)
    _client_cache[agent_role] = client
    logger.debug(f"初始化{agent_role}Agent客户端")
    return client

def call_volc_api(
    agent_role: str,
    user_input: str,
    temperature: float = None,
    max_tokens: int = None,
    content_type: str = None,
    max_retries: int = 3,
    user_id: int = None,
    project_id: int = None,
    client: openai.OpenAI = None,
    context: dict = None,
    perspective: str = None,
    perspective_strength: float = None,
    project_config: dict = None,
    chapter_context: object = None,
) -> str:
    """
    调用火山引擎Coding Plan Pro API的通用函数
    :param agent_role: Agent角色名称
    :param user_input: 用户输入
    :param temperature: 温度参数
    :param max_tokens: 最大输出长度
    :param content_type: 内容类型，用于加载特定prompt
    :param max_retries: 最大重试次数
    :param user_id: 用户ID，用于记录token使用量
    :param project_id: 项目ID，用于记录token使用量
    :param client: 外部传入的OpenAI客户端（用于多租户隔离，每个用户使用自己的API Key）
    :param context: 占位符替换上下文，key 是占位符名称（不含 {{}}），value 是替换内容
    :param perspective: 视角类型，用于调整写作视角（如第一人称、第三人称等）
    :param perspective_strength: 视角强度，0-1之间的浮点数，控制视角转换的强度
    :param project_config: 项目配置字典，包含项目级别的全局配置参数
    :param chapter_context: ChapterContext 对象，用于动态技能检索（Hermes-style）
    :return: API返回的文本内容
    """
    # 不同Agent差异化温度配置（从配置读取）
    # - planner: 创造性策划，温度稍高 (0.8)
    # - writer: 内容生成，温度适中 (0.7)
    # - editor: 润色不改变原意，温度偏低 (0.5)
    # - quality: 质量优化，稳定控制 (0.4)
    # - guardian/compliance: 校验检查，低温保证确定性 (0.1-0.2)
    if USE_NEW_CONFIG:
        if temperature is None:
            temperature = settings.get_temperature_for_agent(agent_role)
        if max_tokens is None:
            if agent_role == "writer":
                max_tokens = settings.writer_max_tokens
            else:
                max_tokens = settings.default_max_tokens
    else:
        if temperature is None:
            temperature = TEMPERATURES.get(agent_role, DEFAULT_TEMPERATURE)
        if max_tokens is None:
            max_tokens = WRITER_MAX_TOKENS if agent_role == "writer" else DEFAULT_MAX_TOKENS

    logger.info(f"开始调用 {agent_role} Agent...")
    logger.debug(f"{agent_role} Agent输入：{user_input[:200]}...")

    route = _resolve_model_route(agent_role, project_config)
    remaining_retries = max_retries
    while remaining_retries > 0:
        # 每次重试都重新加载 prompt，确保 context 等参数正确
        system_prompt = load_prompt(
            agent_role,
            content_type,
            context,
            perspective=perspective,
            perspective_strength=perspective_strength,
            project_config=project_config,
            chapter_context=chapter_context,
        )
        try:
            response = _runtime_router.complete(
                LLMRequest(
                    agent_role=agent_role,
                    system_prompt=system_prompt,
                    user_input=user_input,
                    model=route.model,
                    provider=route.provider,
                    api_key=route.api_key,
                    base_url=route.base_url,
                    client=client,
                    max_retries=1,
                    retry_delay_seconds=0,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=LLM_API_TIMEOUT,
                ),
                sleep=lambda _: None,
            )
            result = response.content
            logger.info(f"{agent_role} Agent调用成功")
            logger.debug(f"{agent_role} Agent输出：{result[:200]}...")

            # 记录 token 使用量（如果提供了 user_id 和 project_id）
            if user_id is not None and project_id is not None and USE_NEW_CONFIG:
                try:
                    from backend.database import SessionLocal
                    from backend.models import TokenUsage
                    usage = response.usage
                    if usage is None:
                        logger.debug("Token usage omitted by provider for %s; skip usage recording", agent_role)
                        return result

                    prompt_tokens = usage.prompt_tokens
                    completion_tokens = usage.completion_tokens
                    total_tokens = usage.total_tokens

                    db = SessionLocal()
                    try:
                        usage_record = TokenUsage(
                            user_id=user_id,
                            project_id=project_id,
                            agent_name=agent_role,
                            model=route.model,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            total_tokens=total_tokens,
                        )
                        db.add(usage_record)
                        db.commit()
                        logger.debug(f"Token usage recorded: {total_tokens} tokens for {agent_role}")
                    except Exception:
                        db.rollback()
                        raise
                    finally:
                        db.close()
                except Exception as e:
                    logger.warning(f"Failed to record token usage: {e}")

            return result
        except Exception as e:
            remaining_retries -= 1
            logger.error(f"{agent_role} Agent调用失败：{type(e).__name__}: {e}，剩余重试次数：{remaining_retries}", exc_info=True)
            # 连接出错时清除缓存，下次重新创建
            if agent_role in _client_cache:
                del _client_cache[agent_role]
            _runtime_router.reset_provider_cache(route.provider, route.api_key, route.base_url)
            if remaining_retries <= 0:
                logger.error(f"{agent_role} Agent已重试{max_retries}次仍失败，放弃重试")
                raise RuntimeError(f"{agent_role} Agent调用失败，已达到最大重试次数: {e}") from e
            time.sleep(2)


def _resolve_model_route(agent_role: str, project_config: dict | None) -> ModelRoute:
    if USE_NEW_CONFIG:
        return resolve_model_route(agent_role, project_config=project_config)
    return ModelRoute(
        provider="openai_compatible",
        model=MODELS.get(agent_role, MODELS.get("default", "")),
        api_key=API_KEYS.get(agent_role, API_KEYS.get("default", "")),
        base_url=BASE_URL,
        prompt_price=0.0,
        completion_price=0.0,
    )
