"""
统一配置中心
基于 Pydantic Settings，支持：
- 环境变量 > .env 文件 > 默认值 的优先级
- 统一API密钥 或 各Agent独立密钥
- 单例模式，全局一处导入处处使用
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from pathlib import Path
from typing import Optional, Dict

# 项目根目录
ROOT_DIR = Path(__file__).parent.parent


class Settings(BaseSettings):
    """统一配置类"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ========== API 密钥配置 ==========
    # 统一API密钥（新手友好，一个密钥全Agent共用）
    # 兼容两种环境变量命名：UNIFIED_API_KEY 或 WRITER_API_KEY
    unified_api_key: str = Field("", description="统一API密钥，所有Agent共用", json_schema_extra={"env": ["UNIFIED_API_KEY", "WRITER_API_KEY"]})

    # 各Agent独立密钥（高级用户分账号计费）
    planner_api_key: str = Field("", description="Planner Agent API密钥", json_schema_extra={"env": ["PLANNER_API_KEY", "WRITER_API_KEY_PLANNER"]})
    guardian_api_key: str = Field("", description="Guardian Agent API密钥", json_schema_extra={"env": ["GUARDIAN_API_KEY", "WRITER_API_KEY_GUARDIAN"]})
    writer_api_key: str = Field("", description="Writer Agent API密钥", json_schema_extra={"env": ["WRITER_API_KEY", "WRITER_API_KEY_WRITER"]})
    editor_api_key: str = Field("", description="Editor Agent API密钥", json_schema_extra={"env": ["EDITOR_API_KEY", "WRITER_API_KEY_EDITOR"]})
    compliance_api_key: str = Field("", description="Compliance Agent API密钥", json_schema_extra={"env": ["COMPLIANCE_API_KEY", "WRITER_API_KEY_COMPLIANCE"]})
    quality_api_key: str = Field("", description="Quality Agent API密钥", json_schema_extra={"env": ["QUALITY_API_KEY", "WRITER_API_KEY_QUALITY"]})
    critic_api_key: str = Field("", description="Critic Agent API密钥", json_schema_extra={"env": ["CRITIC_API_KEY", "WRITER_API_KEY_CRITIC"]})
    fix_api_key: str = Field("", description="Fix Agent API密钥", json_schema_extra={"env": ["FIX_API_KEY", "WRITER_API_KEY_FIX"]})

    # ========== API 端点配置 ==========
    # Coding Plan Pro: https://ark.cn-beijing.volces.com/api/coding/v3
    # 火山方舟通用: https://ark.cn-beijing.volces.com/api/v3
    base_url: str = Field("https://ark.cn-beijing.volces.com/api/coding/v3", description="API Base URL")

    # ========== 模型配置 ==========
    # 统一模型（推荐：所有Agent使用同一个推理接入点，只需配置一次）
    # 火山方舟格式：ep-xxxxxxxxxxxxxxxxxxxx
    unified_model: str = Field("", description="统一模型/推理接入点ID，覆盖所有Agent", json_schema_extra={"env": ["UNIFIED_MODEL"]})

    # 各Agent独立模型（高级用法）
    planner_model: str = Field("ark-code-latest", description="Planner模型名称", json_schema_extra={"env": ["PLANNER_MODEL"]})
    guardian_model: str = Field("ark-code-latest", description="Guardian模型名称", json_schema_extra={"env": ["GUARDIAN_MODEL"]})
    writer_model: str = Field("doubao-seed-code-preview-latest", description="Writer模型名称", json_schema_extra={"env": ["WRITER_MODEL"]})
    editor_model: str = Field("doubao-seed-code-preview-latest", description="Editor模型名称", json_schema_extra={"env": ["EDITOR_MODEL"]})
    compliance_model: str = Field("ark-code-latest", description="Compliance模型名称", json_schema_extra={"env": ["COMPLIANCE_MODEL"]})
    quality_model: str = Field("ark-code-latest", description="Quality模型名称", json_schema_extra={"env": ["QUALITY_MODEL"]})
    critic_model: str = Field("ark-code-latest", description="Critic模型名称", json_schema_extra={"env": ["CRITIC_MODEL"]})
    fix_model: str = Field("ark-code-latest", description="Fix模型名称", json_schema_extra={"env": ["FIX_MODEL"]})

    # ========== 温度配置 ==========
    planner_temperature: float = Field(0.8, description="Planner温度（创意需要高温）")
    guardian_temperature: float = Field(0.2, description="Guardian温度（校验需要低温）")
    writer_temperature: float = Field(0.7, description="Writer温度（创作适中）")
    editor_temperature: float = Field(0.5, description="Editor温度（润色偏低）")
    compliance_temperature: float = Field(0.1, description="Compliance温度（合规最严格）")
    quality_temperature: float = Field(0.4, description="Quality温度（优化稳定）")
    critic_temperature: float = Field(0.2, description="Critic温度（评审低温客观）")
    fix_temperature: float = Field(0.4, description="Fix温度（修复同quality）")

    # ========== 系统参数 ==========
    default_max_tokens: int = Field(8192, description="默认最大输出tokens")
    writer_max_tokens: int = Field(8192, description="Writer单独配置更大输出空间")
    max_fix_retries: int = Field(4, description="初稿后最多重试修复轮数")
    max_parallel_checks: int = Field(3, description="并行检查最大线程数")
    critic_pass_threshold: float = Field(8.0, description="Critic全自动模式及格线")

    # ========== 质量检查配置 ==========
    word_count_deviation_allowed: float = Field(0.15, description="字数偏差允许范围（百分比）")
    word_count_deviation_hard: float = Field(0.25, description="字数偏差硬上限，超过强制打回")
    long_paragraph_threshold: int = Field(300, description="长段落判断阈值（字符数）")
    ai_cliche_repeat_threshold: int = Field(2, description="AI套话多少次算重复过多")

    # ========== 定价配置（美元 / 1K tokens） ==========
    # 默认价格适用于 OpenAI GPT-3.5/GPT-4 标准定价
    # 火山方舟等其他平台按实际计费调整
    default_prompt_price: float = Field(0.002, description="提示词价格，美元 per 1K tokens")
    default_completion_price: float = Field(0.006, description="完成词价格，美元 per 1K tokens")

    # ========== JWT 认证配置 ==========
    jwt_secret_key: str = Field(
        "your-secret-key-change-in-production-keep-it-safe",
        description="JWT签名密钥，从环境变量读取"
    )
    access_token_expire_minutes: int = Field(30, description="访问令牌过期时间（分钟）")

    # ========== 向量数据库配置 ==========
    vector_chunk_size: int = Field(500, description="章节分块大小（字符数）")
    vector_search_top_k_chapters: int = Field(2, description="检索相关章节返回条数")
    vector_search_top_k_settings: int = Field(1, description="检索核心设定返回条数")
    style_reference_top_k: int = Field(2, description="预检索文风参考返回条数")
    chroma_persist_directory: Path = Field(ROOT_DIR / "chroma_db", description="ChromaDB持久化目录")

    # ========== 路径配置（自动计算）==========
    root_dir: Path = Field(ROOT_DIR, description="项目根目录")
    prompts_dir: Path = Field(ROOT_DIR / "prompts", description="提示词文件夹")
    user_requirements_file: Path = Field(ROOT_DIR / "user_requirements.yaml", description="用户需求配置文件")
    outputs_root: Path = Field(ROOT_DIR / "outputs", description="输出根文件夹")
    logs_dir: Path = Field(ROOT_DIR / "logs", description="日志文件夹")

    def get_api_key_for_agent(self, agent_name: str) -> str:
        """
        获取Agent的API密钥
        优先级：独立密钥 > 统一密钥 > 空字符串
        兼容旧命名：WRITER_API_KEY 作为统一密钥
        """
        if agent_name == "default":
            # 默认返回统一 API Key
            if self.unified_api_key:
                return self.unified_api_key
            import os
            writer_api_key_env = os.getenv("WRITER_API_KEY")
            if writer_api_key_env:
                return writer_api_key_env
            return ""

        # 获取对应字段
        api_key_map: Dict[str, str] = {
            "planner": self.planner_api_key,
            "guardian": self.guardian_api_key,
            "writer": self.writer_api_key,
            "editor": self.editor_api_key,
            "compliance": self.compliance_api_key,
            "quality": self.quality_api_key,
            "critic": self.critic_api_key,
            "fix": self.fix_api_key,
        }

        independent_key = api_key_map.get(agent_name, "")
        if independent_key:
            return independent_key

        # 如果独立密钥为空，回退到统一密钥
        if self.unified_api_key:
            return self.unified_api_key

        # 兼容旧命名：如果统一密钥为空，但环境变量有 WRITER_API_KEY，使用它
        import os
        writer_api_key_env = os.getenv("WRITER_API_KEY")
        if writer_api_key_env:
            return writer_api_key_env

        return ""

    def get_model_for_agent(self, agent_name: str) -> str:
        """获取Agent对应的模型名称
        如果设置了统一模型unified_model，优先使用统一模型
        """
        # 如果设置了统一模型，优先使用
        if self.unified_model:
            return self.unified_model

        model_map: Dict[str, str] = {
            "planner": self.planner_model,
            "guardian": self.guardian_model,
            "writer": self.writer_model,
            "editor": self.editor_model,
            "compliance": self.compliance_model,
            "quality": self.quality_model,
            "critic": self.critic_model,
            "fix": self.fix_model,
        }
        return model_map.get(agent_name, self.planner_model)

    def get_temperature_for_agent(self, agent_name: str) -> float:
        """获取Agent对应的温度参数"""
        temp_map: Dict[str, float] = {
            "planner": self.planner_temperature,
            "guardian": self.guardian_temperature,
            "writer": self.writer_temperature,
            "editor": self.editor_temperature,
            "compliance": self.compliance_temperature,
            "quality": self.quality_temperature,
            "critic": self.critic_temperature,
            "fix": self.fix_temperature,
        }
        return temp_map.get(agent_name, 0.7)


# 全局单例，其他模块从此导入
settings = Settings()

# 确保必要的目录存在
try:
    settings.outputs_root.mkdir(exist_ok=True, parents=True)
    settings.logs_dir.mkdir(exist_ok=True, parents=True)
    settings.prompts_dir.mkdir(exist_ok=True, parents=True)
except OSError as e:
    import sys
    from utils.logger import logger
    logger.error(f"无法创建必要目录：{e}")
    logger.error(f"请检查目录权限：outputs_root={settings.outputs_root}, logs_dir={settings.logs_dir}, prompts_dir={settings.prompts_dir}")
    sys.exit(1)
