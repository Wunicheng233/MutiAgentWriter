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

Status: provider-neutral runtime is in place; account-level provider settings are exposed in the Settings page; provider failures are now normalized before they reach workflow/task code.

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

Current implementation:
- `LLMRouter` routes requests through OpenAI-compatible providers and returns normalized response/usage objects.
- Account-level provider, model, base URL, and API key settings are available in Settings and feed the runtime route.
- Provider failures are classified into auth, quota, rate limit, timeout, content filter, provider unavailable, bad request, or unknown.

Remaining steps:
- Add provider-level fallback lists.
- Store provider and model on every token usage row.
- Add per-agent advanced overrides after the simple account-level provider setting proves stable.

### 2. Quota And Cost Governance

Status: started with a public-beta daily generation quota preflight.

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

Current implementation:
- Backend exposes `/auth/me/generation-quota`.
- Project generation is blocked before Celery dispatch when the daily generation quota is exhausted.
- Project overview shows today's remaining generation count and disables the generate button when exhausted.
- Monthly platform token budget is checked only when the user is using the system default API.
- Users with their own model API key are not blocked by the platform token budget; the overview page states that their key does not consume platform token budget.
- Project overview now calls a generation preflight endpoint and shows estimated chapters, words, token usage, and platform-budget warnings before task dispatch.
- Token usage rows now persist provider and API source, so platform API cost and user-owned-key usage can be reported separately.
- Project token stats and overview metadata split actual usage into platform API tokens and user-owned-key tokens.

Remaining steps:
- Add plan tiers and admin overrides.
- Convert the rough token estimate into provider-specific cost estimates once model price metadata is reliable.
- Extend the same API-source split to account-level monthly stats and future admin dashboards.

### 3. Reliable Failure Recovery

Status: started with safer stuck-task cleanup and project overview recovery actions.

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

Current implementation:
- Project overview displays a recovery card for failed projects/tasks, including the user-facing error reason and a retry action.
- Manual stuck-task cleanup no longer clears `waiting_confirm`, so chapter/plan confirmation cannot be skipped by accident.
- Cleaning a genuinely stuck running task marks the project failed, making it recoverable instead of leaving it visually stuck in `generating`.
- LLM provider errors are categorized as auth, quota, rate limit, timeout, content filter, provider unavailable, bad request, or unknown. Non-retryable errors stop immediately; retryable failures keep bounded retry behavior.
- A user can only run one active generation task at a time across projects.
- Project overview exposes a cancel action for active generation tasks; cancellation marks the task/workflow run as cancelled and releases the project state.
- Failed or cancelled projects can continue from the first unfinished chapter in the configured range without deleting completed chapters. The destructive path is now explicitly labeled as regeneration.

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
- Public reader polish for shared projects.

Current implementation:
- Public share links are owner-only to create/revoke.
- Share links have selectable public-beta expiry windows and can be refreshed without rotating the token.
- Public project page views are counted, and owners can see view count plus last-viewed/expiry metadata from the export/share page.

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
2. Extend quota preflight from daily generation count to monthly token budget.
3. Add user-facing failure recovery UI and resume-from-unfinished-chapter behavior.
4. Move rate limiting to Redis when deployment topology is clear.
5. Add policy/legal pages and report flow.
6. Add onboarding.
7. Add admin analytics.

This order keeps the product usable during the transition: each step reduces operational risk without blocking ongoing creative workflow improvements.
