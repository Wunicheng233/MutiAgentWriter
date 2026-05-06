# Productization LLM Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-provider model call path with a small, extensible LLM runtime while preserving the existing `call_volc_api()` compatibility surface.

**Architecture:** Add `backend/core/llm/` as the new provider/router layer. Keep current agents calling `backend.utils.volc_engine.call_volc_api()` for now, but make that function delegate the actual request to the runtime. This gives the product a stable path toward multi-provider routing, fallback, cost governance, and provider-specific retry behavior without rewriting the workflow.

**Tech Stack:** Python dataclasses, OpenAI-compatible chat completions API, existing Pydantic settings, existing SQLAlchemy `TokenUsage` model, unittest/pytest.

---

### Task 1: Add Runtime Types And OpenAI-Compatible Provider

**Files:**
- Create: `backend/core/llm/types.py`
- Create: `backend/core/llm/providers/base.py`
- Create: `backend/core/llm/providers/openai_compat.py`
- Create: `backend/core/llm/__init__.py`
- Create: `backend/core/llm/providers/__init__.py`
- Test: `tests/test_llm_runtime.py`

- [ ] **Step 1: Write failing tests**

Create tests that assert:
- an OpenAI-compatible provider passes `model`, `messages`, `temperature`, `max_tokens`, and `timeout` into `client.chat.completions.create`;
- empty API responses normalize to a safe single-space string;
- token usage is normalized even when the provider omits `total_tokens`.

- [ ] **Step 2: Run tests and confirm missing module failure**

Run: `python -m pytest tests/test_llm_runtime.py -q`
Expected: FAIL because `backend.core.llm` does not exist yet.

- [ ] **Step 3: Implement minimal runtime types and provider**

Add dataclasses for `LLMRequest`, `LLMResponse`, and `LLMTokenUsage`. Add `OpenAICompatibleProvider.complete()`.

- [ ] **Step 4: Run tests and confirm pass**

Run: `python -m pytest tests/test_llm_runtime.py -q`
Expected: PASS.

### Task 2: Add Model Registry And Router

**Files:**
- Create: `backend/core/llm/model_registry.py`
- Create: `backend/core/llm/router.py`
- Modify: `tests/test_llm_runtime.py`

- [ ] **Step 1: Write failing tests**

Add tests that assert:
- router resolves per-agent model from existing settings;
- project config can override provider/model/base_url per agent;
- retry reloads the request operation and succeeds after a transient failure.

- [ ] **Step 2: Run tests and confirm failure**

Run: `python -m pytest tests/test_llm_runtime.py -q`
Expected: FAIL because router modules do not exist.

- [ ] **Step 3: Implement registry and router**

`resolve_model_route()` should merge defaults from settings with optional `project_config["llm"]`. `LLMRouter.complete()` should call the selected provider and retry bounded transient failures.

- [ ] **Step 4: Run tests and confirm pass**

Run: `python -m pytest tests/test_llm_runtime.py -q`
Expected: PASS.

### Task 3: Delegate Existing `call_volc_api()` To Runtime

**Files:**
- Modify: `backend/utils/volc_engine.py`
- Modify: `tests/test_llm_timeout.py`
- Modify: `tests/test_review_fixes.py` only if existing tests expose incompatibility.

- [ ] **Step 1: Write compatibility test**

Add or reuse tests verifying that `call_volc_api()` still:
- reloads prompt context on each retry;
- passes timeout to the provider call;
- records token usage when `user_id` and `project_id` are provided;
- skips token recording cleanly when provider usage is omitted.

- [ ] **Step 2: Run compatibility tests**

Run: `python -m pytest tests/test_llm_runtime.py tests/test_llm_timeout.py tests/test_review_fixes.py::ReviewFixesTests::test_volc_reloads_prompt_context_on_each_retry tests/test_review_fixes.py::ReviewFixesTests::test_volc_token_usage_failure_rolls_back_and_closes_session tests/test_review_fixes.py::ReviewFixesTests::test_volc_skips_token_recording_when_provider_omits_usage -q`

- [ ] **Step 3: Refactor `call_volc_api()`**

Keep the public function signature. Build `LLMRequest` after loading the prompt each attempt. Delegate to `LLMRouter.complete()`. Keep DB token usage recording in this compatibility function for now.

- [ ] **Step 4: Run targeted tests**

Run: `python -m pytest tests/test_llm_runtime.py tests/test_llm_timeout.py -q`
Expected: PASS.

### Task 4: Document Next Productization Steps

**Files:**
- Create: `docs/productization-roadmap.md`

- [ ] **Step 1: Write a concise roadmap**

Cover P0/P1/P2 productization items: model runtime, quotas, Redis rate limiting, failure recovery, observability, onboarding, content safety, and admin metrics.

- [ ] **Step 2: Verify docs are internally consistent**

Run a keyword scan against the roadmap and this plan for unfinished draft markers.
Expected: no unfinished draft markers.
