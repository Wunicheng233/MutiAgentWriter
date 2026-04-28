import openai
import time
import threading
from backend.utils.logger import logger
from backend.utils.file_utils import load_prompt

# LLM API 调用超时设置（秒）
LLM_API_TIMEOUT = 180  # 3分钟，对于长文本生成应该足够

# 优先使用新的统一配置中心，如果不存在回退到旧配置
try:
    from backend.core.config import settings
    USE_NEW_CONFIG = True
except ImportError:
    from backend.config import API_KEYS, BASE_URL, MODELS, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, TEMPERATURES, WRITER_MAX_TOKENS
    USE_NEW_CONFIG = False

# ========== 优化：全局客户端缓存，每个Agent角色复用连接 ==========
# key: agent_role, value: (client, created_timestamp)
_client_cache: dict[str, tuple[openai.OpenAI, float]] = {}
_client_cache_lock = threading.Lock()  # 线程安全锁，防止并发访问竞态
_CLIENT_CACHE_MAX_SIZE = 20  # 最多缓存20个客户端实例
_CLIENT_CACHE_TTL_SECONDS = 3600  # 1小时自动过期清理

def _get_client(agent_role: str) -> openai.OpenAI:
    """获取或创建缓存的OpenAI客户端，复用连接（线程安全）"""
    current_time = time.time()

    with _client_cache_lock:
        # 先检查并清理过期的客户端
        expired_keys = [
            key for key, (_, created_at) in _client_cache.items()
            if current_time - created_at > _CLIENT_CACHE_TTL_SECONDS
        ]
        for key in expired_keys:
            del _client_cache[key]

        # 如果缓存已满，清理最老的1个（简化版LRU）
        if len(_client_cache) >= _CLIENT_CACHE_MAX_SIZE:
            oldest_key = min(_client_cache.keys(), key=lambda k: _client_cache[k][1])
            del _client_cache[oldest_key]

        if agent_role not in _client_cache:
            if USE_NEW_CONFIG:
                from backend.core.config import settings
                api_key = settings.get_api_key_for_agent(agent_role)
                base_url = settings.base_url
            else:
                api_key = API_KEYS.get(agent_role, API_KEYS.get("default", ""))
                base_url = BASE_URL

            client = openai.OpenAI(api_key=api_key, base_url=base_url)
            _client_cache[agent_role] = (client, current_time)
            logger.debug(f"初始化{agent_role}Agent客户端并缓存")
        return _client_cache[agent_role][0]

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
        )
        if client is None:
            client = _get_client(agent_role)

        try:
            if USE_NEW_CONFIG:
                model = settings.get_model_for_agent(agent_role)
            else:
                model = MODELS.get(agent_role, MODELS.get("default", ""))

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_input}
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=LLM_API_TIMEOUT,
            )
            # 防御性检查：choices 可能为空，content 可能为 None（如拒绝服务、内容过滤等）
            if not response.choices:
                result = " "  # API 异常返回，确保下游不崩溃
            else:
                message_content = response.choices[0].message.content or ""
                result = message_content.strip() or " "
            logger.info(f"{agent_role} Agent调用成功")
            logger.debug(f"{agent_role} Agent输出：{result[:200]}...")

            # 记录 token 使用量（如果提供了 user_id 和 project_id）
            if user_id is not None and project_id is not None and USE_NEW_CONFIG:
                try:
                    from backend.database import SessionLocal
                    from backend.models import TokenUsage
                    usage = getattr(response, 'usage', None)
                    if usage is not None:
                        prompt_tokens = usage.prompt_tokens
                        completion_tokens = usage.completion_tokens
                        total_tokens = usage.total_tokens

                    db = SessionLocal()
                    try:
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
            logger.error(f"{agent_role} Agent调用失败：{e}，剩余重试次数：{remaining_retries}")
            # 连接出错时清除缓存，下次重新创建，注意加锁保护
            with _client_cache_lock:
                if agent_role in _client_cache:
                    del _client_cache[agent_role]
            if remaining_retries <= 0:
                logger.error(f"{agent_role} Agent已重试{max_retries}次仍失败，放弃重试")
                raise RuntimeError(f"{agent_role} Agent调用失败，已达到最大重试次数: {e}") from e
            time.sleep(2)
