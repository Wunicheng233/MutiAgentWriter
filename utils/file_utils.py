from pathlib import Path
from config import PROMPTS_DIR, OUTPUTS_ROOT
import config
from utils.logger import logger


def set_output_dir(novel_name: str) -> Path:
    """
    为当前小说创建输出文件夹 outputs/{novel_name}/
    返回创建后的路径
    """
    # 安全处理书名，替换不合法字符
    safe_name = "".join(c for c in novel_name if c.isalnum() or c in (' ', '_', '-')).strip()
    safe_name = safe_name.replace(' ', '_')
    output_dir = OUTPUTS_ROOT / safe_name
    output_dir.mkdir(exist_ok=True)
    config.CURRENT_OUTPUT_DIR = output_dir
    return output_dir


def get_current_output_dir() -> Path:
    """获取当前小说的输出目录"""
    if config.CURRENT_OUTPUT_DIR is None:
        raise RuntimeError("当前输出目录未设置，请先调用set_output_dir")
    return config.CURRENT_OUTPUT_DIR


def load_prompt(agent_name: str, content_type: str = None) -> str:
    """
    从prompts文件夹加载对应Agent的提示词
    :param agent_name: Agent名称（planner/guardian/writer/editor/compliance）
    :param content_type: 内容类型（full_novel/short_story/script），如果有则加载特定prompt
    :return: 提示词内容
    """
    # 如果指定了内容类型且对应prompt存在，使用特定prompt
    if content_type:
        specific_prompt = PROMPTS_DIR / f"{agent_name}_{content_type}.md"
        if specific_prompt.exists():
            with open(specific_prompt, "r", encoding="utf-8") as f:
                return f.read().strip()
        # 对于planner和writer，我们有专门的short_story和script版本
        if agent_name == 'planner' and content_type == 'short_story':
            specific_prompt = PROMPTS_DIR / "planner_short_story.md"
            if specific_prompt.exists():
                with open(specific_prompt, "r", encoding="utf-8") as f:
                    return f.read().strip()
        if agent_name == 'planner' and content_type == 'script':
            specific_prompt = PROMPTS_DIR / "planner_script.md"
            if specific_prompt.exists():
                with open(specific_prompt, "r", encoding="utf-8") as f:
                    return f.read().strip()
        if agent_name == 'writer' and content_type == 'script':
            specific_prompt = PROMPTS_DIR / "writer_script.md"
            if specific_prompt.exists():
                with open(specific_prompt, "r", encoding="utf-8") as f:
                    return f.read().strip()
    # 默认加载通用prompt
    prompt_file = PROMPTS_DIR / f"{agent_name}.md"
    if not prompt_file.exists():
        raise FileNotFoundError(f"提示词文件不存在：{prompt_file}")
    with open(prompt_file, "r", encoding="utf-8") as f:
        return f.read().strip()


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
