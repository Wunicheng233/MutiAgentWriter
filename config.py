"""
兼容旧配置 - 新代码请从 core.config 导入 settings
此文件保持向后兼容，让现有代码无需全部重写
"""

import os
from pathlib import Path
from datetime import datetime

# 尝试导入新配置中心，如果可用就使用它
try:
    from core.config import settings
    USING_NEW_CONFIG = True
except ImportError:
    USING_NEW_CONFIG = False

# 自动加载 .env 文件（如果存在）
# 这样你只需要把 API Keys 写到 .env 文件，程序自动读取
ENV_FILE = Path(__file__).parent / '.env'
if ENV_FILE.exists():
    with open(ENV_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().strip('"\'')
                if key not in os.environ:
                    os.environ[key] = value

if USING_NEW_CONFIG:
    # 使用新配置中心，从settings导出兼容性常量
    # ====================== 核心配置 ======================
    API_KEYS = {
        "planner": settings.planner_api_key or settings.unified_api_key,
        "guardian": settings.guardian_api_key or settings.unified_api_key,
        "writer": settings.writer_api_key or settings.unified_api_key,
        "editor": settings.editor_api_key or settings.unified_api_key,
        "compliance": settings.compliance_api_key or settings.unified_api_key,
        "quality": settings.quality_api_key or settings.unified_api_key,
        "critic": settings.critic_api_key or settings.unified_api_key,
        "fix": settings.fix_api_key or settings.unified_api_key
    }
    UNIFIED_API_KEY = settings.unified_api_key
    BASE_URL = settings.base_url
    MODELS = {
        "planner": settings.planner_model,
        "guardian": settings.guardian_model,
        "writer": settings.writer_model,
        "editor": settings.editor_model,
        "compliance": settings.compliance_model,
        "quality": settings.quality_model,
        "critic": settings.critic_model,
        "fix": settings.fix_model
    }
    TEMPERATURES = {
        "planner": settings.planner_temperature,
        "guardian": settings.guardian_temperature,
        "writer": settings.writer_temperature,
        "editor": settings.editor_temperature,
        "compliance": settings.compliance_temperature,
        "quality": settings.quality_temperature,
        "critic": settings.critic_temperature,
        "fix": settings.fix_temperature
    }
    CRITIC_PASS_SCORE = settings.critic_pass_threshold
    DEFAULT_TEMPERATURE = settings.default_max_tokens  # 保持兼容性
    DEFAULT_MAX_TOKENS = settings.default_max_tokens
    WRITER_MAX_TOKENS = settings.writer_max_tokens
    MAX_FIX_RETRIES = settings.max_fix_retries
    MAX_PARALLEL_CHECKS = settings.max_parallel_checks
    WORD_COUNT_DEVIATION_ALLOWED = settings.word_count_deviation_allowed
    WORD_COUNT_DEVIATION_HARD = settings.word_count_deviation_hard
    LONG_PARAGRAPH_THRESHOLD = settings.long_paragraph_threshold
    AI_CLICHE_REPEAT_THRESHOLD = settings.ai_cliche_repeat_threshold
    VECTOR_CHUNK_SIZE = settings.vector_chunk_size
    VECTOR_SEARCH_TOP_K_CHAPTERS = settings.vector_search_top_k_chapters
    VECTOR_SEARCH_TOP_K_SETTINGS = settings.vector_search_top_k_settings
    STYLE_REFERENCE_TOP_K = settings.style_reference_top_k
    ROOT_DIR = settings.root_dir
    PROMPTS_DIR = settings.prompts_dir
    USER_REQUIREMENTS_FILE = settings.user_requirements_file
    OUTPUTS_ROOT = settings.outputs_root
    LOGS_DIR = settings.logs_dir
else:
    # ====================== 原始配置（向后兼容）======================
    # 多Agent API Key配置
    API_KEYS = {
        "planner": os.getenv("WRITER_API_KEY_PLANNER", ""),
        "guardian": os.getenv("WRITER_API_KEY_GUARDIAN", ""),
        "writer": os.getenv("WRITER_API_KEY_WRITER", ""),
        "editor": os.getenv("WRITER_API_KEY_EDITOR", ""),
        "compliance": os.getenv("WRITER_API_KEY_COMPLIANCE", ""),
        "quality": os.getenv("WRITER_API_KEY_QUALITY", ""),
        "critic": os.getenv("WRITER_API_KEY_CRITIC", ""),
        "fix": os.getenv("WRITER_API_KEY_FIX", "")
    }
    UNIFIED_API_KEY = os.getenv("WRITER_API_KEY", "")
    if UNIFIED_API_KEY:
        for agent in API_KEYS:
            if not API_KEYS[agent]:
                API_KEYS[agent] = UNIFIED_API_KEY
    BASE_URL = "https://ark.cn-beijing.volces.com/api/coding/v3"
    MODELS = {
        "planner": "ark-code-latest",
        "guardian": "ark-code-latest",
        "writer": "doubao-seed-code-preview-latest",
        "editor": "doubao-seed-code-preview-latest",
        "compliance": "ark-code-latest",
        "quality": "ark-code-latest",
        "critic": "ark-code-latest",
        "fix": "ark-code-latest"
    }
    TEMPERATURES = {
        "planner": 0.8,
        "writer": 0.7,
        "editor": 0.5,
        "guardian": 0.2,
        "compliance": 0.1,
        "quality": 0.4,
        "critic": 0.2,
        "fix": 0.4
    }
    CRITIC_PASS_SCORE = 8
    DEFAULT_TEMPERATURE = 0.7
    DEFAULT_MAX_TOKENS = 8192
    WRITER_MAX_TOKENS = 8192
    MAX_FIX_RETRIES = 4
    MAX_PARALLEL_CHECKS = 3
    WORD_COUNT_DEVIATION_ALLOWED = 0.15
    WORD_COUNT_DEVIATION_HARD = 0.25
    LONG_PARAGRAPH_THRESHOLD = 300
    AI_CLICHE_REPEAT_THRESHOLD = 2
    VECTOR_CHUNK_SIZE = 500
    VECTOR_SEARCH_TOP_K_CHAPTERS = 2
    VECTOR_SEARCH_TOP_K_SETTINGS = 1
    STYLE_REFERENCE_TOP_K = 2
    ROOT_DIR = Path(__file__).parent
    PROMPTS_DIR = ROOT_DIR / "prompts"
    PROMPTS_DIR.mkdir(exist_ok=True)
    USER_REQUIREMENTS_FILE = ROOT_DIR / "user_requirements.yaml"
    OUTPUTS_ROOT = ROOT_DIR / "outputs"
    OUTPUTS_ROOT.mkdir(exist_ok=True)
    LOGS_DIR = ROOT_DIR / "logs"
    LOGS_DIR.mkdir(exist_ok=True)

# 日志文件路径（按日期命名）
LOG_FILE = LOGS_DIR / f"novel_system_{datetime.now().strftime('%Y%m%d')}.log"

# 当前输出目录（运行时动态设置，基于书名）
CURRENT_OUTPUT_DIR = None
