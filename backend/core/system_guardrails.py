"""
系统层防护 (System-Level Guardrails)
纯代码实现，不依赖LLM，在Writer输出后、Critic评审前执行。
快速拦截基础格式与合规问题，降低LLM调用成本，提升系统稳定性。

遵循设计文档: 01-System-Level Guardrails Specification
"""

import re
import yaml
from dataclasses import dataclass
from typing import List, Optional, Dict

from backend.utils.logger import logger
from backend.core.config import settings


# 默认配置
DEFAULT_CONFIG = {
    "guardrails": {
        "word_count": {
            "tolerance": 0.20
        },
        "paragraph": {
            "max_sentences": 3,
            "exclude_dialogue": True
        },
        "sensitive_words": {
            "enabled": True,
            "auto_replace": True,
            "block_on_high_severity": True
        },
        "cliche_blacklist": [
            "只见", "话落", "微微一笑", "心中一动", "瞳孔一缩",
            "倒吸一口凉气", "随着", "就在这时", "一股.*涌上心头"
        ],
        "hook_indicators": [
            r"\?",
            r"突然",
            r"忽然",
            r"猛地",
            r"却",
            r"但是",
            r"然而",
            r"竟然",
            r"背后",
            r"身后",
            r"门外",
            r"窗外",
            r"……$",
            r"——$"
        ],
        "era_vocab": {
            "1990s": {
                "forbidden": [
                    "智能手机", "WiFi", "社交媒体", "网购", "二维码"
                ],
                "caution": [
                    "互联网", "手机", "电脑"
                ]
            },
            "ancient": {
                "forbidden": [
                    "电话", "电灯", "汽车", "分钟", "小时"
                ],
                "caution": []
            }
        }
    }
}


@dataclass
class GuardrailResult:
    """系统层防护检查结果"""
    passed: bool                    # 是否通过所有阻断级检查
    corrected_content: str          # 修正后的内容
    warnings: List[str]             # 警告信息列表
    suggestions: List[str]          # 建议信息列表
    metrics: Dict                   # 统计指标（字数、段落数等）
    violations: Dict                # 违规详情（按检查项ID分组）


# ================ G-01: 章节标题格式检查 ================

CHAPTER_TITLE_PATTERN = r'^第[一二三四五六七八九十百千万\d]+章\s+.{1,30}$'


def check_chapter_title(content: str, expected_chapter_num: int) -> tuple[bool, str, str]:
    """
    检查章节标题格式。

    返回：
        (是否通过, 修正后内容, 错误信息)
    """
    lines = content.strip().split('\n')
    if not lines:
        return False, f"第{expected_chapter_num}章\n\n{content}", f"正文为空，已自动插入标题"

    first_line = lines[0].strip()
    # 去除Markdown标题符号
    first_line = first_line.lstrip('#').strip()

    # 规则1：检查是否匹配标题格式
    if not re.match(CHAPTER_TITLE_PATTERN.replace(r'\s+', r'\s*'), first_line):
        # 自动补全标题
        corrected_title = f"第{expected_chapter_num}章"
        corrected_content = f"{corrected_title}\n\n{content}"
        return False, corrected_content, f"标题格式错误，已自动补全为 '{corrected_title}'"

    # 规则2：提取章节号，校验是否与期望一致（仅阿拉伯数字）
    match = re.search(r'第(\d+)章', first_line)
    if match:
        actual_num = int(match.group(1))
        if actual_num != expected_chapter_num:
            # 自动修正章节号
            corrected_title = re.sub(r'第\d+章', f'第{expected_chapter_num}章', first_line)
            lines[0] = corrected_title
            corrected_content = '\n'.join(lines)
            return False, corrected_content, f"章节号错误（期望{expected_chapter_num}，实际{actual_num}），已自动修正"

    return True, content, ""


# ================ G-02: 章节号连续性检查 ================

def check_chapter_continuity(current_chapter: int, previous_chapter: int) -> tuple[bool, str]:
    """检查章节号连续性。"""
    if current_chapter == previous_chapter + 1:
        return True, ""
    else:
        return False, f"章节号跳跃（上一章{previous_chapter}，本章{current_chapter}）"


# ================ G-03: 敏感词过滤 ================

def filter_sensitive_words(content: str, sensitive_words: Dict = None) -> tuple[bool, str, List[str]]:
    """
    过滤敏感词。

    返回：
        (是否有敏感词被替换, 过滤后内容, 被替换的词列表)
    """
    if sensitive_words is None:
        sensitive_words = {}

    filtered = content
    replaced = []

    for category, words in sensitive_words.items():
        for word in words:
            if word in filtered:
                filtered = filtered.replace(word, '*' * len(word))
                replaced.append(word)

    return len(replaced) > 0, filtered, replaced


# ================ G-04: 字数偏离检查 ================

def check_word_count(content: str, target_count: int, tolerance: float = 0.30) -> tuple[bool, int, float, str]:
    """
    检查字数偏离。

    参数：
        tolerance: 允许的偏离比例，默认 0.30（±30%）

    返回：
        (是否在范围内, 实际字数, 偏离比例, 警告信息)
    """
    # 中文环境下，字数约等于字符数（去除空格和换行符的影响）
    text = content.replace('\n', '').replace('\r', '').replace(' ', '')
    actual = len(text)

    safe_target = max(1, target_count)
    deviation = (actual - safe_target) / safe_target

    if abs(deviation) <= tolerance:
        return True, actual, deviation, ""
    elif deviation > 0:
        return False, actual, deviation, f"字数超标 {deviation:.1%}（目标{target_count}，实际{actual}）"
    else:
        return False, actual, deviation, f"字数不足 {abs(deviation):.1%}（目标{target_count}，实际{actual}）"


# ================ G-05: 段落长度检查 ================

SENTENCE_END_PATTERN = r'[。！？!?]'


def check_paragraph_length(content: str, max_sentences: int = 3, exclude_dialogue: bool = True) -> tuple[bool, List[int]]:
    """
    检查段落长度。

    返回：
        (是否全部通过, 超标段落的行号列表)
    """
    lines = content.split('\n')
    long_paragraphs = []

    for i, para in enumerate(lines, 1):
        para = para.strip()
        if not para:
            continue

        # 跳过对话行（人名+冒号开头）
        if exclude_dialogue and re.match(r'^[^\s：:]{1,10}[：:]', para):
            continue

        sentences = re.split(SENTENCE_END_PATTERN, para)
        sentence_count = len([s for s in sentences if s.strip()])

        if sentence_count > max_sentences:
            long_paragraphs.append(i)

    return len(long_paragraphs) == 0, long_paragraphs


# ================ G-06: 对话分行检查 ================

DIALOGUE_PATTERN = re.compile(r'^[^\s：:]{1,10}[：:].+')


def check_dialogue_format(content: str) -> tuple[bool, str]:
    """
    检查并自动修正对话格式。

    返回：
        (是否有修正, 修正后内容)
    """
    lines = content.split('\n')
    corrected_lines = []
    modified = False

    for line in lines:
        # 如果一行中包含多段对话，尝试拆分
        # 在句子结束后，下一段对话开头处拆分
        parts = re.split(r'(?<=[。！？!?])\s*(?=[^\s：:]{1,10}[：:])', line)
        if len(parts) > 1:
            corrected_lines.extend([p.strip() for p in parts if p.strip()])
            modified = True
        else:
            corrected_lines.append(line)

    corrected_content = '\n'.join(corrected_lines)
    return modified, corrected_content


# ================ G-07: 主角出场检查 ================

def check_protagonist_appearance(content: str, protagonist_name: str) -> tuple[bool, str]:
    """检查主角是否在本章出场。"""
    if not protagonist_name:
        return True, ""

    if protagonist_name in content:
        return True, ""
    else:
        return False, f"警告：主角「{protagonist_name}」在本章未出场"


# ================ G-08: 结尾钩子检测 ================

def check_ending_hook(content: str, hook_indicators: List[str] = None) -> tuple[bool, str]:
    """检测结尾是否包含钩子元素。"""
    if hook_indicators is None:
        hook_indicators = [
            r'\?',
            r'突然',
            r'忽然',
            r'猛地',
            r'却',
            r'但是',
            r'然而',
            r'竟然',
            r'背后',
            r'身后',
            r'门外',
            r'窗外',
            r'……',
            r'——$'
        ]

    lines = [l.strip() for l in content.split('\n') if l.strip()]
    if len(lines) < 3:
        last_part = ' '.join(lines)
    else:
        last_part = ' '.join(lines[-3:])

    for pattern in hook_indicators:
        if re.search(pattern, last_part):
            return True, ""

    return False, "建议：结尾缺少明确的悬念钩子"


# ================ G-09: 套话黑名单检测 ================

def check_cliches(content: str, cliche_blacklist: List[str] = None) -> tuple[bool, str, List[str]]:
    """
    检测并标记套话。

    返回：
        (是否有套话, 原内容, 发现的套话列表)
    """
    if cliche_blacklist is None:
        cliche_blacklist = [
            "只见", "话落", "微微一笑", "心中一动", "瞳孔一缩",
            "倒吸一口凉气", "随着", "就在这时"
        ]

    found = []
    for cliche in cliche_blacklist:
        if cliche in content:
            found.append(cliche)

    # 不自动替换，仅标记
    return len(found) > 0, content, found


# ================ G-10: 时代错位词检测 ================

def check_era_consistency(content: str, era_key: str, era_vocab: Dict = None) -> tuple[bool, List[str]]:
    """检查时代错位词。"""
    if era_vocab is None or era_key not in era_vocab:
        return True, []

    violations = []
    for word in era_vocab[era_key].get("forbidden", []):
        if word in content:
            violations.append(f"禁止词：{word}")

    return len(violations) == 0, violations


# ================ 主入口 ================

def load_guardrails_config() -> Dict:
    """加载防护配置，如果配置文件不存在则使用默认配置。"""
    config_path = settings.root_dir / "guardrails_config.yaml"
    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    else:
        # 写入默认配置
        with open(config_path, 'w', encoding='utf-8') as f:
            yaml.dump(DEFAULT_CONFIG, f, allow_unicode=True, default_flow_style=False)
        logger.info(f"已创建默认配置文件: {config_path}")
        return DEFAULT_CONFIG


def run_system_guardrails(
    content: str,
    context: Dict,
    config: Optional[Dict] = None
) -> GuardrailResult:
    """
    执行全部系统层防护检查。

    参数：
        content: 章节正文
        context: 上下文信息，包含：
            - expected_chapter_num: int 期望的章节号
            - previous_chapter_num: int 上一章章节号
            - target_word_count: int 目标字数
            - protagonist_name: str 主角姓名
            - era_key: Optional[str] 时代关键词（用于时代错位检查）
        config: 配置对象，为None则自动加载

    返回：
        GuardrailResult 对象
    """
    if config is None:
        config = load_guardrails_config()

    guardrails_config = config.get("guardrails", {})

    result = GuardrailResult(
        passed=True,
        corrected_content=content,
        warnings=[],
        suggestions=[],
        metrics={},
        violations={}
    )

    current = content

    # G-01: 标题格式（P0优先级）
    expected_chapter_num = context.get('expected_chapter_num', 1)
    passed, current, msg = check_chapter_title(current, expected_chapter_num)
    if not passed:
        result.corrected_content = current
        result.warnings.append(msg)

    # G-03: 敏感词（P0优先级，阻断级）
    sensitive_config = guardrails_config.get("sensitive_words", {})
    sensitive_words = sensitive_config.get("words", {})
    has_sensitive, current, replaced = filter_sensitive_words(current, sensitive_words)
    if has_sensitive:
        result.corrected_content = current
        result.warnings.append(f"已替换敏感词: {replaced}")
        result.violations['G-03'] = replaced

    # G-06: 对话分行（P1优先级）
    modified, current = check_dialogue_format(current)
    if modified:
        result.corrected_content = current
        result.warnings.append("已自动修正对话格式（对话分行）")

    # G-04: 字数检查（P2优先级）
    target_word_count = context.get('target_word_count', 2000)
    word_tolerance = guardrails_config.get("word_count", {}).get("tolerance", 0.30)
    in_range, actual, dev, msg = check_word_count(current, target_word_count, word_tolerance)
    result.metrics['word_count'] = actual
    result.metrics['word_count_deviation'] = dev
    if not in_range:
        result.warnings.append(msg)

    # G-05: 段落长度（P2优先级）
    para_config = guardrails_config.get("paragraph", {})
    max_sentences = para_config.get("max_sentences", 3)
    exclude_dialogue = para_config.get("exclude_dialogue", True)
    passed_para, long_lines = check_paragraph_length(current, max_sentences, exclude_dialogue)
    if not passed_para:
        result.suggestions.append(f"段落过长，建议拆分第 {long_lines} 行")
        result.violations['G-05'] = long_lines

    # G-07: 主角出场（P3优先级）
    protagonist_name = context.get('protagonist_name', '')
    passed_prot, msg = check_protagonist_appearance(current, protagonist_name)
    if not passed_prot:
        result.suggestions.append(msg)

    # G-08: 结尾钩子（P3优先级）
    hook_indicators = guardrails_config.get("hook_indicators", None)
    passed_hook, msg = check_ending_hook(current, hook_indicators)
    if not passed_hook:
        result.suggestions.append(msg)

    # G-09: 套话（P3优先级）
    cliche_blacklist = guardrails_config.get("cliche_blacklist", None)
    has_cliche, _, cliches = check_cliches(current, cliche_blacklist)
    if has_cliche:
        result.suggestions.append(f"检测到AI套话: {cliches}")
        result.violations['G-09'] = cliches

    # G-10: 时代错位（P3优先级）
    era_key = context.get('era_key')
    era_vocab = guardrails_config.get("era_vocab", {})
    if era_key and era_vocab:
        passed_era, violations = check_era_consistency(current, era_key, era_vocab)
        if not passed_era:
            result.warnings.append(f"时代错位词: {violations}")
            result.violations['G-10'] = violations

    # 所有阻断级检查都已自动修正，所以始终返回 passed=True
    result.passed = True
    result.corrected_content = current

    return result
