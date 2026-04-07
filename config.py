import os
from pathlib import Path
from datetime import datetime

# ====================== 核心配置：火山引擎Coding Plan Pro专属 ======================
# 多Agent API Key配置
# 从环境变量读取，请勿在代码中硬编码API Key
# 在运行前请设置环境变量：
# export WRITER_API_KEY_PLANNER=your-key
# export WRITER_API_KEY_GUARDIAN=your-key
# ... 以此类推
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

# 火山引擎API Base URL（完全保留你的原始配置）
BASE_URL = "https://ark.cn-beijing.volces.com/api/coding/v3"

# 多Agent模型配置（完全保留你的原始配置）
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

# 差异化温度配置：不同职责用不同温度，创意→校验温度递减
TEMPERATURES = {
    "planner": 0.8,      # 策划需要创意
    "writer": 0.7,       # 创作需要一定创意
    "editor": 0.5,       # 润色需要稳定
    "guardian": 0.2,     # 校验需要低温度
    "compliance": 0.1,   # 合规校验最严格
    "quality": 0.4,      # 质量校验，稳定为主
    "critic": 0.2,       # 评论家挑刺需要低温度，客观严谨
    "fix": 0.4           # 统一修复，和quality相同温度
}

# Critic 全自动模式及格线（skip_chapter_confirmation: true 时生效）
# 得分 >= CRITIC_PASS_SCORE 就算通过
CRITIC_PASS_SCORE = 8

# API调用默认参数
DEFAULT_TEMPERATURE = 0.7
DEFAULT_MAX_TOKENS = 8192

# Writer Agent单独配置更大的输出空间，保证章节完整
WRITER_MAX_TOKENS = 8192

# ========== 并行校验配置 ==========
# 初稿后最多重试修复轮数
MAX_FIX_RETRIES = 4
# 并行检查最大线程数
MAX_PARALLEL_CHECKS = 3

# ========== 质量检查配置 ==========
# 字数偏差允许范围（占目标字数百分比）
WORD_COUNT_DEVIATION_ALLOWED = 0.15  # ±15%
WORD_COUNT_DEVIATION_HARD = 0.25     # >25% 强制打回
# 长段落判断阈值（字符数）
LONG_PARAGRAPH_THRESHOLD = 300
# AI套话多少次算重复过多
AI_CLICHE_REPEAT_THRESHOLD = 2

# ========== 向量数据库配置 ==========
# 章节分块大小（字符数）
VECTOR_CHUNK_SIZE = 500
# 检索相关章节返回条数
VECTOR_SEARCH_TOP_K_CHAPTERS = 2
# 检索核心设定返回条数
VECTOR_SEARCH_TOP_K_SETTINGS = 1

# ========== 默认超参数 ==========
# 预检索文风参考返回条数
STYLE_REFERENCE_TOP_K = 2

# ====================== 路径配置（自动处理，无需修改） ======================
# 项目根目录
ROOT_DIR = Path(__file__).parent

# 【新增/保留】提示词文件夹（每个Agent一个独立的prompt文件）
PROMPTS_DIR = ROOT_DIR / "prompts"
PROMPTS_DIR.mkdir(exist_ok=True)

# 用户需求配置文件
USER_REQUIREMENTS_FILE = ROOT_DIR / "user_requirements.yaml"

# 输出根文件夹（自动创建，每本小说一个子文件夹）
OUTPUTS_ROOT = ROOT_DIR / "outputs"
OUTPUTS_ROOT.mkdir(exist_ok=True)

# 日志文件夹（自动创建）
LOGS_DIR = ROOT_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# 日志文件路径（按日期命名）
LOG_FILE = LOGS_DIR / f"novel_system_{datetime.now().strftime('%Y%m%d')}.log"

# 当前输出目录（运行时动态设置，基于书名）
CURRENT_OUTPUT_DIR = None
