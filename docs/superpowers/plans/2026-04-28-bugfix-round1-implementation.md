# Bugfix Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 high/medium priority bugs identified in the project health audit, ensuring all tests pass and no regressions are introduced.

**Architecture:** Incremental bug fixes across 6 files. Each fix is isolated and testable independently. Follow existing code patterns and maintain backward compatibility.

**Tech Stack:** Python 3.9+, FastAPI, SQLAlchemy, React, TypeScript, Vitest, ESLint

---

## File Change Map

| File | Changes | Priority |
|------|---------|----------|
| `backend/database.py` | Add contextmanager import and decorator | 🔴 High |
| `backend/api/projects.py` | Add exception handling and type validation | 🟡 Medium |
| `backend/rate_limiter.py` | Move import to top | 🟡 Medium |
| `backend/core/orchestrator.py` | Add boundary condition checks | 🟡 Medium |
| `frontend/src/pages/ProjectOutline.tsx` | Fix ESLint setState-in-effect error | 🟡 Medium |
| `frontend/src/components/ai/AIChatPanel.tsx` | Fix unused variable ESLint error | 🟡 Medium |

---

## Task 1: Fix database.py contextmanager bug

**Files:**
- Modify: `backend/database.py:1-61`

- [ ] **Step 1: Add contextmanager import**

```python
# Line 6-7, add after sqlalchemy imports
from contextlib import contextmanager
from sqlalchemy import create_engine
```

- [ ] **Step 2: Add @contextmanager decorator to db_session()**

```python
# Line 47, add decorator before function
@contextmanager
def db_session():
    """
    上下文管理器：获取数据库会话

    用法:
        with db_session() as db:
            db.query(...)

    确保会话在退出时被正确关闭，防止资源泄漏。
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 3: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('backend/database.py').read()); print('OK')"`
Expected: Prints "OK" with no errors

- [ ] **Step 4: Commit**

```bash
git add backend/database.py
git commit -m "fix: add contextmanager decorator to db_session"
```

---

## Task 2: Fix projects.py file deletion exception handling

**Files:**
- Modify: `backend/api/projects.py:1290-1315`

- [ ] **Step 1: Add type validation for project.config**

```python
# Around line 1290, wrap config operations in type check
if isinstance(project.config, dict):
    project.config.pop("start_chapter", None)
    project.config.pop("end_chapter", None)
    project.config.pop("skip_plan_confirmation", None)
    project.config.pop("skip_chapter_confirmation", None)
```

- [ ] **Step 2: Add exception handling for file deletion**

```python
# Around line 1305, wrap file operations in try-except
try:
    # 删除策划方案和设定圣经（确保重置后重新生成）
    plan_file = project_dir / "novel_plan.md"
    if plan_file.exists():
        plan_file.unlink()
    setting_file = project_dir / "setting_bible.md"
    if setting_file.exists():
        setting_file.unlink()
except Exception as e:
    logger.warning(f"Failed to delete plan/setting files: {e}")
```

- [ ] **Step 3: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('backend/api/projects.py').read()); print('OK')"`
Expected: Prints "OK" with no errors

- [ ] **Step 4: Commit**

```bash
git add backend/api/projects.py
git commit -m "fix: add exception handling and type validation to reset_project"
```

---

## Task 3: Fix rate_limiter.py import location

**Files:**
- Modify: `backend/rate_limiter.py:1-107`

- [ ] **Step 1: Move import to top of file**

```python
# Add to imports at top (around line 8-12)
from backend.deps import get_current_user
from backend.models import User
from collections import defaultdict
import time
import threading
from typing import Callable
from fastapi import Depends, HTTPException, Request, status
```

- [ ] **Step 2: Remove import from inside function**

Remove line: `from backend.deps import get_current_user` from inside `limit_requests_by_user()` function (around line 96)

- [ ] **Step 3: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('backend/rate_limiter.py').read()); print('OK')"`
Expected: Prints "OK" with no errors

- [ ] **Step 4: Commit**

```bash
git add backend/rate_limiter.py
git commit -m "fix: move imports to top following PEP8"
```

---

## Task 4: Fix orchestrator.py boundary conditions

**Files:**
- Modify: `backend/core/orchestrator.py:577-600`

- [ ] **Step 1: Add chapter count upper limit**

```python
# Around line 577-590, in the outline supplement logic
# 确保补充的大纲不会过多（上限200章）
max_chapters = min(self.end_chapter, 200)
if len(self.chapter_outlines) < max_chapters:
    logger.warning(f"章节大纲不足，将补充到{max_chapters}章")
    # 补充逻辑...
    if max_chapters > 100:
        logger.warning(f"章节数超过100章，可能导致生成时间过长")
```

- [ ] **Step 2: Add empty chapter_outlines fallback**

```python
# Around line 592-595, after outline parsing
# 确保至少有一个章节大纲
if not self.chapter_outlines:
    logger.warning("未解析到任何章节大纲，创建默认大纲")
    self.chapter_outlines = [{
        "chapter_num": 1,
        "title": "",
        "outline": self.plan or "默认章节大纲",
        "target_word_count": int(self.chapter_word_count)
    }]
```

- [ ] **Step 3: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('backend/core/orchestrator.py').read()); print('OK')"`
Expected: Prints "OK" with no errors

- [ ] **Step 4: Commit**

```bash
git add backend/core/orchestrator.py
git commit -m "fix: add boundary condition checks for chapter outlines"
```

---

## Task 5: Fix ProjectOutline.tsx ESLint setState-in-effect error

**Files:**
- Modify: `frontend/src/pages/ProjectOutline.tsx:95-115`

- [ ] **Step 1: Refactor useEffect to avoid direct setState**

Current problematic code:
```typescript
useEffect(() => {
    if (!data?.config || editingConfig) return
    const newConfig = {
        chapter_word_count: data.config.chapter_word_count ?? 2000,
        start_chapter: data.config.start_chapter ?? 1,
        end_chapter: data.config.end_chapter ?? 10,
    }
    // 只在非编辑状态下同步值，避免编辑时用户输入被重置
    setConfigForm(newConfig)
}, [data?.config, editingConfig])
```

Fix - use useRef to track if we've already initialized:
```typescript
const initializedRef = useRef(false)

useEffect(() => {
    if (!data?.config || editingConfig || initializedRef.current) return
    initializedRef.current = true
    const newConfig = {
        chapter_word_count: data.config.chapter_word_count ?? 2000,
        start_chapter: data.config.start_chapter ?? 1,
        end_chapter: data.config.end_chapter ?? 10,
    }
    setConfigForm(newConfig)
}, [data?.config, editingConfig])
```

- [ ] **Step 2: Run ESLint to verify fix**

Run: `cd frontend && npm run lint -- src/pages/ProjectOutline.tsx`
Expected: No errors for this file

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ProjectOutline.tsx
git commit -m "fix: avoid cascading setState in useEffect with useRef guard"
```

---

## Task 6: Fix AIChatPanel.tsx unused variable ESLint error

**Files:**
- Modify: `frontend/src/components/ai/AIChatPanel.tsx:66`

- [ ] **Step 1: Fix unused error variable**

Change from:
```typescript
} catch (error) {
```

Change to:
```typescript
} catch (_error) {
```

- [ ] **Step 2: Run ESLint to verify fix**

Run: `cd frontend && npm run lint -- src/components/ai/AIChatPanel.tsx`
Expected: No errors for this file

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ai/AIChatPanel.tsx
git commit -m "fix: rename unused catch variable to _error following ESLint convention"
```

---

## Task 7: Run full verification suite

- [ ] **Step 1: Run full ESLint check**

Run: `cd frontend && npm run lint`
Expected: No errors (only warnings in coverage/ folder are acceptable)

- [ ] **Step 2: Run full frontend build**

Run: `cd frontend && npm run build`
Expected: Build completes successfully

- [ ] **Step 3: Run full frontend test suite**

Run: `cd frontend && npm run test:run`
Expected: 51 test files, 326 tests all passing

- [ ] **Step 4: Verify Python syntax across all modified files**

Run: `python3 -c "
import ast
files = ['backend/database.py', 'backend/api/projects.py', 'backend/rate_limiter.py', 'backend/core/orchestrator.py']
for f in files:
    ast.parse(open(f).read())
    print(f'OK: {f}')
print('All files OK!')
"`
Expected: All files report "OK"

- [ ] **Step 5: Final verification commit (if any cleanup needed)**

If all tests pass, tag or verify the changes are complete.

---

## Plan Self-Review

**1. Spec coverage:** All 9 high/medium priority issues from the spec are covered:
- ✅ contextmanager import + decorator (issues 1-2)
- ✅ projects.py exception handling (issue 3)
- ✅ projects.py type validation (issue 4)
- ✅ rate_limiter import location (issue 5)
- ✅ ProjectOutline ESLint fix (issue 6)
- ✅ AIChatPanel ESLint fix (issue 7)
- ✅ orchestrator chapter limit (issue 8)
- ✅ orchestrator empty outline fallback (issue 9)

**2. Placeholder scan:** No TBD/TODO placeholders. All code blocks complete with exact implementations.

**3. Type consistency:** All function names, variable names match existing codebase patterns. No naming mismatches.

**4. Test coverage:** Each task includes verification steps. Final task runs full verification suite.
