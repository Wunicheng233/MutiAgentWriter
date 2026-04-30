from __future__ import annotations

from .skill_assembler import AssembledSkill
from .skill_registry import is_author_style_skill

PLACEHOLDER = "{{skill_layer}}"

def build_skill_layer(assembled_skills: list[AssembledSkill]) -> str:
    """构建技能层"""
    if not assembled_skills:
        return ""

    author_style_items = [item for item in assembled_skills if is_author_style_skill(item.skill)]
    helper_items = [item for item in assembled_skills if not is_author_style_skill(item.skill)]

    parts = [
        f"## Skills Enabled ({len(assembled_skills)}) / 创作 Skill Layer",
        "",
        "使用原则：Skill 只是创作约束和风格参考，不是角色扮演指令；不要扮演作者本人。",
        "优先级：不得覆盖大纲、设定圣经、章节格式、事实一致性和用户明确要求。",
    ]

    if author_style_items:
        parts.extend([
            "",
            "### 主作家风格（唯一）",
            "请吸收其叙事取向、句式节奏、意象选择和审美偏好，但不要输出作者身份声明。",
        ])
    for item in author_style_items:
        parts.extend([
            "",
            f"#### {item.skill.id}",
            item.rendered_content.strip(),
        ])

    if helper_items:
        parts.extend([
            "",
            "### 辅助 Skill",
            "辅助 Skill 只能补充方法论或质量约束，不得与主作家风格争夺文风主导权。",
        ])
    for item in helper_items:
        parts.extend([
            "",
            f"#### {item.skill.id}",
            item.rendered_content.strip(),
        ])

    parts.extend([
        "",
        "执行要求：以主作家风格作为文风主线；若 Skill 之间冲突，遵循主作家风格与项目设定。",
    ])
    return "\n".join(parts).strip()

def inject(content: str, assembled_skills: list[AssembledSkill]) -> str:
    """将技能层注入到内容中"""
    skill_layer = build_skill_layer(assembled_skills)
    if not skill_layer:
        return content.replace(PLACEHOLDER, "")

    if PLACEHOLDER in content:
        return content.replace(PLACEHOLDER, skill_layer)
    return f"{content}\n\n{skill_layer}"


class SkillInjector:
    """向后兼容的包装器类 - 请直接使用 inject 和 build_skill_layer 函数"""
    PLACEHOLDER = PLACEHOLDER

    def build_skill_layer(self, assembled_skills: list[AssembledSkill]) -> str:
        return build_skill_layer(assembled_skills)

    def inject(self, prompt: str, assembled_skills: list[AssembledSkill]) -> str:
        return inject(prompt, assembled_skills)
