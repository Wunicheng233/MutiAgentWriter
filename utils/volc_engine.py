import openai
import time
from utils.logger import logger

# 优先使用新的统一配置中心，如果不存在回退到旧配置
try:
    from core.config import settings
    USE_NEW_CONFIG = True
except ImportError:
    from config import API_KEYS, BASE_URL, MODELS, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, TEMPERATURES
    USE_NEW_CONFIG = False

# ========== 优化：全局客户端缓存，每个Agent角色复用连接 ==========
# key: agent_role, value: openai.OpenAI client
_client_cache: dict[str, openai.OpenAI] = {}

def _get_client(agent_role: str) -> openai.OpenAI:
    """获取或创建缓存的OpenAI客户端，复用连接"""
    if agent_role not in _client_cache:
        if USE_NEW_CONFIG:
            from core.config import settings
            api_key = settings.get_api_key_for_agent(agent_role)
            base_url = settings.base_url
        else:
            from config import API_KEYS, BASE_URL
            api_key = API_KEYS[agent_role]
            base_url = BASE_URL

        _client_cache[agent_role] = openai.OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        logger.debug(f"初始化{agent_role}Agent客户端并缓存")
    return _client_cache[agent_role]

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
) -> str:
    # 不同Agent差异化温度配置（从配置读取）
    # - planner: 创造性策划，温度稍高 (0.8)
    # - writer: 内容生成，温度适中 (0.7)
    # - editor: 润色不改变原意，温度偏低 (0.5)
    # - quality: 质量优化，稳定控制 (0.4)
    # - guardian/compliance: 校验检查，低温保证确定性 (0.1-0.2)
    if USE_NEW_CONFIG:
        from core.config import settings
        if temperature is None:
            temperature = settings.get_temperature_for_agent(agent_role)
        if max_tokens is None:
            if agent_role == "writer":
                max_tokens = settings.writer_max_tokens
            else:
                max_tokens = settings.default_max_tokens
        default_max_tokens = settings.default_max_tokens
    else:
        from config import DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, TEMPERATURES, WRITER_MAX_TOKENS
        if temperature is None:
            temperature = TEMPERATURES.get(agent_role, DEFAULT_TEMPERATURE)
        if max_tokens is None:
            max_tokens = WRITER_MAX_TOKENS if agent_role == "writer" else DEFAULT_MAX_TOKENS
        default_max_tokens = DEFAULT_MAX_TOKENS

    """
    调用火山引擎Coding Plan Pro API的通用函数
    :param agent_role: Agent角色名称
    :param user_input: 用户输入
    :param temperature: 温度参数
    :param max_tokens: 最大输出长度
    :param content_type: 内容类型，用于加载特定prompt
    :param client: 外部传入的OpenAI客户端（用于多租户隔离，每个用户使用自己的API Key）
    :return: API返回的文本内容
    """
    from utils.file_utils import load_prompt
    system_prompt = load_prompt(agent_role, content_type)

    logger.info(f"开始调用 {agent_role} Agent...")
    logger.debug(f"{agent_role} Agent输入：{user_input[:200]}...")

    if client is None:
        client = _get_client(agent_role)

    try:
        if USE_NEW_CONFIG:
            model = settings.get_model_for_agent(agent_role)
        else:
            from config import MODELS
            model = MODELS[agent_role]

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input}
            ],
            temperature=temperature,
            max_tokens=max_tokens
        )
        result = response.choices[0].message.content.strip()
        logger.info(f"{agent_role} Agent调用成功")
        logger.debug(f"{agent_role} Agent输出：{result[:200]}...")

        # 记录 token 使用量（如果提供了 user_id 和 project_id）
        if user_id is not None and project_id is not None and USE_NEW_CONFIG:
            try:
                from backend.database import SessionLocal
                from backend.models import TokenUsage
                prompt_tokens = response.usage.prompt_tokens
                completion_tokens = response.usage.completion_tokens
                total_tokens = response.usage.total_tokens

                db = SessionLocal()
                usage = TokenUsage(
                    user_id=user_id,
                    project_id=project_id,
                    agent_name=agent_role,
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                )
                db.add(usage)
                db.commit()
                db.close()
                logger.debug(f"Token usage recorded: {total_tokens} tokens for {agent_role}")
            except Exception as e:
                logger.warning(f"Failed to record token usage: {e}")

        return result
    except Exception as e:
        logger.error(f"{agent_role} Agent调用失败：{e}，2秒后重试...")
        # 连接出错时清除缓存，下次重新创建
        if agent_role in _client_cache:
            del _client_cache[agent_role]
        if max_retries <= 1:
            logger.error(f"{agent_role} Agent已重试{max_retries}次仍失败，放弃重试")
            raise RuntimeError(f"{agent_role} Agent调用失败，已达到最大重试次数: {e}") from e
        time.sleep(2)
        return call_volc_api(agent_role, user_input, temperature, max_tokens, content_type, max_retries - 1)