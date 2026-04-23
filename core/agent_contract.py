"""
Agent Contract v1

这不是新的 Agent 执行框架，而是给现有 4 个核心 Agent 建立稳定元数据。
后续 workflow runtime、harness、prompt 版本管理都会基于这里逐步扩展。
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AgentContract:
    agent_key: str
    display_name: str
    purpose: str
    layer: str
    supported_workflow_nodes: tuple[str, ...]
    input_schema_ref: str
    output_schema_ref: str
    prompt_template_key: str
    model_policy_key: str
    retry_policy_key: str
    fallback_policy_key: str


AGENT_CONTRACTS: dict[str, AgentContract] = {
    "planner": AgentContract(
        agent_key="planner",
        display_name="故事架构师",
        purpose="生成或修订设定圣经、故事大纲和章节规划。",
        layer="core_production",
        supported_workflow_nodes=("planning", "plan_revision"),
        input_schema_ref="PlannerInput.v1",
        output_schema_ref="PlanArtifact.v1",
        prompt_template_key="planner",
        model_policy_key="planner",
        retry_policy_key="default_llm_retry",
        fallback_policy_key="manual_review",
    ),
    "writer": AgentContract(
        agent_key="writer",
        display_name="叙事作家",
        purpose="基于设定、大纲、历史上下文和约束生成章节正文。",
        layer="core_production",
        supported_workflow_nodes=("chapter_draft", "chapter_rewrite"),
        input_schema_ref="WriterInput.v1",
        output_schema_ref="ChapterDraftArtifact.v1",
        prompt_template_key="writer",
        model_policy_key="writer",
        retry_policy_key="default_llm_retry",
        fallback_policy_key="save_placeholder_and_continue",
    ),
    "critic": AgentContract(
        agent_key="critic",
        display_name="章节评审员",
        purpose="评审章节质量，输出评分维度和可修复问题清单。",
        layer="quality_control",
        supported_workflow_nodes=("chapter_critique", "revision_review"),
        input_schema_ref="CriticInput.v1",
        output_schema_ref="CriticReport.v1",
        prompt_template_key="critic",
        model_policy_key="critic",
        retry_policy_key="strict_json_retry",
        fallback_policy_key="mark_for_human_review",
    ),
    "revise": AgentContract(
        agent_key="revise",
        display_name="内容修订师",
        purpose="根据评审问题和用户反馈修订章节正文。",
        layer="core_production",
        supported_workflow_nodes=("chapter_revision", "feedback_revision"),
        input_schema_ref="ReviseInput.v1",
        output_schema_ref="ChapterRevisionArtifact.v1",
        prompt_template_key="revise",
        model_policy_key="revise",
        retry_policy_key="default_llm_retry",
        fallback_policy_key="keep_previous_draft",
    ),
}


def get_agent_contract(agent_key: str) -> AgentContract:
    try:
        return AGENT_CONTRACTS[agent_key]
    except KeyError as exc:
        raise KeyError(f"未知 Agent Contract: {agent_key}") from exc


def list_agent_contracts() -> list[AgentContract]:
    return [AGENT_CONTRACTS[key] for key in sorted(AGENT_CONTRACTS)]
