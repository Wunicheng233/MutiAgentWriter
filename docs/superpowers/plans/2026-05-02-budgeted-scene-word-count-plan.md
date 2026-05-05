# Budgeted Scene Word Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chapter word count control explicit, budgeted, and enforced without adding a default extra LLM agent.

**Architecture:** Add a pure-code `WordCountPolicy` and `Budgeted Scene Plan` helper inside the existing Orchestrator/Context Assembler path. Writer still generates a complete chapter in one pass; Revise receives targeted expansion/compression issues only when deterministic gates fail.

**Tech Stack:** Python FastAPI backend, existing Orchestrator/AgentPool agents, React/TypeScript project creation UI, pytest and Vitest.

---

### Task 1: Unified Word Count Policy

**Files:**
- Create: `backend/core/word_count_policy.py`
- Modify: `backend/core/system_guardrails.py`
- Test: `tests/test_word_count_policy.py`

- [ ] Add tests proving the default policy uses `85%-120%`, counts Chinese story body text consistently, and emits actionable expansion/compression issues.
- [ ] Implement `WordCountPolicy.from_config()`, `evaluate()`, and `build_issue()`.
- [ ] Route `system_guardrails.check_word_count()` through the policy while keeping its old tuple API.

### Task 2: Budget Existing Scene Anchors

**Files:**
- Create: `backend/core/budgeted_scene_plan.py`
- Modify: `backend/core/orchestrator.py`
- Test: `tests/test_budgeted_scene_plan.py`

- [ ] Add tests showing scene anchors become budgeted beats whose budgets sum to the target word count.
- [ ] Add fallback tests for thin table outlines so the helper creates opening/progression/conflict/hook beats.
- [ ] Store budgeted plans in `info.json` beside existing workflow artifacts.

### Task 3: Connect Writer, Revise, and Final Gate

**Files:**
- Modify: `backend/agents/writer_agent.py`
- Modify: `backend/core/agent_pool.py`
- Modify: `backend/core/orchestrator.py`
- Modify: `prompts/writer.md`
- Modify: `prompts/revise.md`
- Test: `tests/test_workflow_optimization.py`

- [ ] Pass budgeted scene guidance and min/max word range to Writer.
- [ ] Replace hard-coded `30%` word-count handling with `WordCountPolicy`.
- [ ] Add a final word-count gate before chapter confirmation/save.
- [ ] Let Revise expand around existing beats only for `expansion_repair`, while keeping normal repair conservative.

### Task 4: Project Defaults and UI Copy

**Files:**
- Modify: `backend/api/projects.py`
- Modify: `backend/tasks/writing_tasks.py`
- Modify: `frontend/src/pages/CreateProject.tsx`
- Modify: `frontend/src/pages/ProjectOverview.tsx`
- Test: `frontend/src/pages/CreateProject.test.tsx`

- [ ] Persist default hidden `word_count_policy` in project config.
- [ ] Write `word_count_policy` into `user_requirements.yaml`.
- [ ] Rename UI copy to “每章目标字数” and show the `85%-120%` target range.

### Verification

- [ ] Run `conda run -n novel_agent pytest tests/test_word_count_policy.py tests/test_budgeted_scene_plan.py tests/test_workflow_optimization.py`.
- [ ] Run `conda run -n novel_agent pytest tests/test_workflow_foundation.py tests/test_review_fixes.py`.
- [ ] Run `npm run test:run -- CreateProject`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
