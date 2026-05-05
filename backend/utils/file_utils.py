import os
import tempfile
from pathlib import Path
from backend.core.config import settings
from backend.utils.logger import logger
from backend.utils.runtime_context import get_current_output_dir, set_current_output_dir

PROMPTS_DIR = settings.prompts_dir
OUTPUTS_ROOT = settings.outputs_root


def write_file_atomic(path: Path, content: str, encoding: str = "utf-8") -> None:
    """
    原子写入文件，使用临时文件+重命名模式，防止进程中途退出导致文件损坏
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    # 创建临时文件在同一目录下，确保重命名是原子操作
    fd, temp_path = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding=encoding) as f:
            f.write(content)
        # 原子重命名
        os.replace(temp_path, path)
    except Exception:
        # 出错时清理临时文件
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise


def set_output_dir(novel_name: str) -> Path:
    """
    为当前小说创建输出文件夹 outputs/{novel_name}/
    返回创建后的路径
    """
    # 安全处理书名，替换不合法字符
    safe_name = "".join(c for c in novel_name if c.isalnum() or c in (' ', '_', '-')).strip()
    safe_name = safe_name.replace(' ', '_')
    output_dir = OUTPUTS_ROOT / safe_name
    output_dir.mkdir(exist_ok=True, parents=True)
    set_current_output_dir(output_dir)
    return output_dir


LEGACY_PERSPECTIVE_SKILL_MAPPING = {
    "liu-cixin": "liu-cixin-perspective",
    "jin-yong": "jin-yong-perspective",
    "haruki-murakami": "haruki-murakami-perspective",
    "jk-rowling": "jk-rowling-perspective",
    "ernest-hemingway": "ernest-hemingway-perspective",
    "yu-hua": "yu-hua-perspective",
    "lu-xun": "lu-xun-perspective",
    "ai-qianshui-de-wuzei": "ai-qianshui-de-wuzei-perspective",
    "chunjie-di-xiaolong": "chunjie-di-xiaolong-perspective",
    "fenghuo": "fenghuo-perspective",
    "huwei-debi": "huwei-debi-perspective",
    "liudanpashui": "liudanpashui-perspective",
    "tangjiashao": "tangjiashao-perspective",
    "yuyuzhu": "yuyuzhu-perspective",
}


def load_prompt(
    agent_name: str,
    content_type: str = None,
    context: dict = None,
    perspective: str = None,
    perspective_strength: float = None,
    project_config: dict = None,
    chapter_context: object = None,
) -> str:
    """
    从prompts文件夹加载对应Agent的提示词
    :param agent_name: Agent名称（planner/guardian/writer/editor/compliance）
    :param content_type: 内容类型（full_novel/short_story/script），如果有则加载特定prompt
    :param context: 占位符替换上下文，key 是占位符名称（不含 {{}}），value 是替换内容
    :param perspective: 旧版作家视角ID，若指定会映射到内置 Skill（兼容旧项目）
    :param perspective_strength: 旧版视角注入强度 (0.0-1.0)
    :param project_config: 项目配置，支持 config.skills.enabled
    :param chapter_context: ChapterContext 对象，用于动态技能检索（Hermes-style）
    :return: 提示词内容
    """
    # 第一步：加载基础提示词文件
    content = None

    # 如果指定了内容类型且对应prompt存在，使用特定prompt
    if content_type:
        specific_prompt = PROMPTS_DIR / f"{agent_name}_{content_type}.md"
        if specific_prompt.exists():
            with open(specific_prompt, "r", encoding="utf-8") as f:
                content = f.read().strip()
        # 对于planner和writer，我们有专门的short_story和script版本（向后兼容）
        if content is None and agent_name == 'planner' and content_type == 'short_story':
            specific_prompt = PROMPTS_DIR / "planner_short_story.md"
            if specific_prompt.exists():
                with open(specific_prompt, "r", encoding="utf-8") as f:
                    content = f.read().strip()
        if content is None and agent_name == 'planner' and content_type == 'script':
            specific_prompt = PROMPTS_DIR / "planner_script.md"
            if specific_prompt.exists():
                with open(specific_prompt, "r", encoding="utf-8") as f:
                    content = f.read().strip()
        if content is None and agent_name == 'writer' and content_type == 'script':
            specific_prompt = PROMPTS_DIR / "writer_script.md"
            if specific_prompt.exists():
                with open(specific_prompt, "r", encoding="utf-8") as f:
                    content = f.read().strip()

    # 如果还没加载到内容，使用默认通用prompt
    if content is None:
        prompt_file = PROMPTS_DIR / f"{agent_name}.md"
        if not prompt_file.exists():
            raise FileNotFoundError(f"提示词文件不存在：{prompt_file}")
        with open(prompt_file, "r", encoding="utf-8") as f:
            content = f.read().strip()

    # 第二步：装配并注入 Skill Layer。旧 perspective 会优先映射为内置 Skill。
    skill_project_config = _project_config_with_legacy_perspective(
        project_config=project_config,
        perspective=perspective,
        perspective_strength=perspective_strength,
    )
    try:
        from backend.core.skill_runtime import SkillAssembler, inject_skill_layer

        assembled_skills = SkillAssembler().assemble(
            agent_name,
            project_config=skill_project_config,
            chapter_context=chapter_context,
        )
        content = inject_skill_layer(content, assembled_skills)
    except Exception as e:
        logger.warning(f"Skill 注入失败，使用原始prompt继续: {e}")
        if "{{skill_layer}}" in content:
            content = content.replace("{{skill_layer}}", "")

    # Note: PerspectiveEngine 已完全迁移到 SkillRuntime 系统
    # 旧 perspective 参数通过 _project_config_with_legacy_perspective 自动映射

    # 第四步：替换占位符
    if context:
        # 替换所有 {{key}} 占位符
        for key, value in context.items():
            content = content.replace(f"{{{{{key}}}}}", str(value))

    # 返回最终内容
    return content


def _project_config_with_legacy_perspective(
    project_config: dict = None,
    perspective: str = None,
    perspective_strength: float = None,
) -> dict:
    project_config = dict(project_config or {})
    configured_skills = ((project_config.get("skills") or {}).get("enabled") or [])
    if configured_skills or not perspective:
        return project_config

    skill_id = LEGACY_PERSPECTIVE_SKILL_MAPPING.get(perspective)
    if not skill_id:
        return project_config

    project_config["skills"] = {
        "enabled": [
            {
                "skill_id": skill_id,
                "applies_to": ["planner", "writer", "revise"],
                "config": {
                    "strength": perspective_strength if perspective_strength is not None else 0.7,
                    "mode": "style_only",
                },
            }
        ]
    }
    return project_config


def save_output(content: str, filename: str, output_dir: Path = None) -> Path:
    """
    保存内容到当前小说的输出文件夹
    :param content: 要保存的内容
    :param filename: 文件名（例如：chapter_1.txt、setting_bible.md）
    :param output_dir: 可选，指定输出目录，不指定则使用全局CURRENT_OUTPUT_DIR
    :return: 保存后的文件路径
    """
    if output_dir is None:
        output_dir = get_current_output_dir()
    output_path = output_dir / filename
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    logger.info(f"文件已保存：{output_path}")
    return output_path


def load_chapter_content(chapter_num: int, output_dir: Path = None) -> str:
    """
    从当前小说输出文件夹加载已生成的章节内容
    :param chapter_num: 章节号
    :param output_dir: 可选，指定输出目录，不指定则使用全局CURRENT_OUTPUT_DIR
    :return: 章节内容
    """
    if output_dir is None:
        output_dir = get_current_output_dir()
    chapter_file = output_dir / f"chapter_{chapter_num}.txt"
    if not chapter_file.exists():
        raise FileNotFoundError(
            f"第{chapter_num}章文件不存在：{chapter_file}，请确保之前的章节已生成"
        )
    with open(chapter_file, "r", encoding="utf-8") as f:
        content = f.read().strip()
        logger.info(f"已加载第{chapter_num}章内容，用于续写衔接")
        return content
