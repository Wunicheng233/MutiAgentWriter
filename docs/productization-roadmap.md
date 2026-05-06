# StoryForge AI Productization Roadmap

This roadmap focuses on making the project better as a real product, not on short-term demo polish.

## Current Product Baseline

The project already has a solid creative workflow foundation:

- Authenticated users and encrypted user model API keys.
- Project creation, generation, chapter confirmation, feedback rewriting, version history, reader/editor, quality dashboard, export, sharing, and collaborator roles.
- Workflow run records, artifacts, feedback items, token usage records, rate limiting, and regression tests for many previously fragile paths.

The main gap is not the creative workflow itself. The gap is product-grade operation: model portability, quota governance, failure recovery, observability, compliance, and onboarding.

## P0: Public Beta Foundation

### 1. LLM Runtime And Provider Governance

Status: started in `backend/core/llm/`; account-level provider settings are now exposed in the Settings page.

Goal:
- Route all model calls through a provider-neutral runtime.
- Keep `call_volc_api()` as a compatibility wrapper until all agents migrate.
- Support OpenAI-compatible providers first: Volcano Engine, OpenAI, DeepSeek, Moonshot, Qwen-compatible gateways.
- Add dedicated providers only when protocol differences require it.

Acceptance criteria:
- Each agent can use a different model route.
- Project config can override provider/model/base URL.
- Runtime returns normalized content, usage, provider id, model id, and raw response.
- Provider failures are classified into retryable, quota, auth, content-filter, and permanent errors.

Remaining steps:
- Extend `LLMRouter` with error classification.
- Add provider-level fallback lists.
- Store provider and model on every token usage row.
- Add per-agent advanced overrides after the simple account-level provider setting proves stable.

### 2. Quota And Cost Governance

Goal:
- Prevent public beta users from accidentally burning unlimited tokens.
- Make cost visible before and after generation.

Recommended model:
- Free beta user: limited daily chapter generations and monthly token budget.
- Trusted tester: higher monthly budget.
- Admin: unrestricted.

Data model:
- `UserQuota`: user id, plan key, daily generation limit, monthly token limit, reset timestamps.
- `UsageLedger`: normalized usage events for generation, assistant chat, export, and future paid features.

Acceptance criteria:
- Starting a generation checks quota before submitting Celery task.
- If quota is low, UI shows an understandable message and suggests reducing chapter range or word count.
- Token usage includes provider, model, agent, workflow run, and project.

### 3. Reliable Failure Recovery

Goal:
- Users should not be stuck after a failed generation.

Required behaviors:
- Every failed task has a clear recovery action: retry same step, continue from chapter, reset stuck task, or contact support.
- Model errors are translated into user-facing categories.
- Waiting confirmation states must be recoverable after refresh.
- Stuck tasks can be cleaned safely without deleting completed chapters.

Acceptance criteria:
- Project overview displays a failure card with reason, last successful chapter, and recovery actions.
- Retrying a task does not create duplicate active tasks.
- Failed model calls preserve enough metadata for diagnosis without leaking API keys.

### 4. Production-Grade Rate Limiting And Concurrency Control

Current state:
- In-memory rate limiter works for local/demo usage.

Public beta target:
- Redis-backed rate limiting.
- Per-user concurrent generation limit.
- Queue position or "waiting to start" state for long jobs.

Acceptance criteria:
- Limits work across multiple backend workers.
- One user cannot starve the generation queue.
- Admin can inspect active tasks and cancel unsafe jobs.

### 5. Security And Compliance Minimum

Required before broad public beta:
- Privacy policy.
- Terms of use.
- AI-generated content disclaimer.
- Data deletion path for users and projects.
- Report/abuse entry point for shared content.

Technical hardening:
- Move auth token from `localStorage` to HttpOnly cookie when deployment target is known.
- Add CSP headers.
- Keep current HTML sanitization tests and expand them for shared pages and version diff output.
- Add audit logging for API key changes, share link creation, export, collaborator changes, and admin actions.

## P1: Product Experience

### 1. Onboarding

Goal:
- First-time users should generate a satisfying first chapter without understanding the system internals.

Flow:
- Choose content type.
- Enter one-sentence premise.
- Choose one author style.
- Generate a short first chapter.
- Land in editor with AI selection rewrite hint.

Acceptance criteria:
- New user reaches a generated first chapter in one guided flow.
- Advanced options are available but not required.

### 2. Model Configuration UX

Goal:
- Make multi-model power understandable.

Suggested UI:
- Simple mode: "balanced", "high quality", "low cost".
- Advanced mode: provider, base URL, model id, API key, fallback model.
- Per-agent override hidden behind an advanced section.

### 3. Export And Sharing

Next improvements:
- PDF export.
- Share link view counts.
- Share link expiry controls.
- Public reader polish for shared projects.

### 4. Admin And Analytics

Minimum dashboard:
- Registered users.
- Projects created.
- Generation success rate.
- Average generation time.
- Failure reason distribution.
- Token cost by provider/model/agent.
- Top selected skills.
- Funnel: register → create project → generate first chapter → edit/export/share.

## P2: Collaboration And Long-Term Growth

Recommended after public beta feedback:
- Paragraph-level comments and collaborator review.
- Offline draft cache and reconnect sync.
- Prompt/model A/B testing.
- Quality score trend by model and skill.
- Hermes effectiveness dashboard separated from core generation.
- Team workspace billing and permissions.

## Execution Order

1. Finish LLM Runtime compatibility and tests.
2. Add quota preflight for generation.
3. Add user-facing failure recovery UI.
4. Move rate limiting to Redis when deployment topology is clear.
5. Add policy/legal pages and report flow.
6. Add onboarding.
7. Add admin analytics.

This order keeps the product usable during the transition: each step reduces operational risk without blocking ongoing creative workflow improvements.
