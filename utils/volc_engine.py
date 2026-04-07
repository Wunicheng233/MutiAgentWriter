import openai
import time
from config import API_KEYS, BASE_URL, MODELS, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, TEMPERATURES
from utils.logger import logger

# ========== 优化：全局客户端缓存，每个Agent角色复用连接 ==========
# key: agent_role, value: openai.OpenAI client
_client_cache: dict[str, openai.OpenAI] = {}

def _get_client(agent_role: str) -> openai.OpenAI:
    """获取或创建缓存的OpenAI客户端，复用连接"""
    if agent_role not in _client_cache:
        _client_cache[agent_role] = openai.OpenAI(
            api_key=API_KEYS[agent_role],
            base_url=BASE_URL
        )
        logger.debug(f"初始化{agent_role}Agent客户端并缓存")
    return _client_cache[agent_role]

def call_volc_api(
    agent_role: str,
    user_input: str,
    temperature: float = None,
    max_tokens: int = DEFAULT_MAX_TOKENS
) -> str:
    # 不同Agent差异化温度配置（从config读取）
    # - planner: 创造性策划，温度稍高 (0.8)
    # - writer: 内容生成，温度适中 (0.7)
    # - editor: 润色不改变原意，温度偏低 (0.5)
    # - quality: 质量优化，稳定控制 (0.4)
    # - guardian/compliance: 校验检查，低温保证确定性 (0.1-0.2)
    if temperature is None:
        temperature = TEMPERATURES.get(agent_role, DEFAULT_TEMPERATURE)
    """
    调用火山引擎Coding Plan Pro API的通用函数
    :param agent_role: Agent角色名称
    :param user_input: 用户输入
    :param temperature: 温度参数
    :param max_tokens: 最大输出长度
    :return: API返回的文本内容
    """
    from utils.file_utils import load_prompt
    system_prompt = load_prompt(agent_role)

    logger.info(f"开始调用 {agent_role} Agent...")
    logger.debug(f"{agent_role} Agent输入：{user_input[:200]}...")

    client = _get_client(agent_role)

    try:
        response = client.chat.completions.create(
            model=MODELS[agent_role],
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
        return result
    except Exception as e:
        logger.error(f"{agent_role} Agent调用失败：{e}，2秒后重试...")
        # 连接出错时清除缓存，下次重新创建
        if agent_role in _client_cache:
            del _client_cache[agent_role]
        time.sleep(2)
        return call_volc_api(agent_role, user_input, temperature, max_tokens)