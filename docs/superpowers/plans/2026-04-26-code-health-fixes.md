# Code Health Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 code health issues identified in the project health audit: missing __init__.py, parameter naming conflict, React component creation during render, and useMemo dependency mismatch.

**Architecture:** Small, isolated fixes to 4 separate files. Each fix is independent and can be tested individually. All changes follow existing code patterns.

**Tech Stack:** Python 3.x, FastAPI, Celery, React 18+, TypeScript, ESLint, Vitest

---

## File Structure Overview

| Task | File | Change Type |
|------|------|-------------|
| 1 | `backend/utils/__init__.py` | Create |
| 2 | `backend/tasks/export_tasks.py:19` | Modify |
| 3 | `frontend/src/components/v2/Button/Button.tsx:60-65,74` | Modify |
| 4 | `frontend/src/components/v2/Checkbox/Checkbox.tsx:41-46` | Modify |

---

### Task 1: Create backend/utils/__init__.py

**Files:**
- Create: `backend/utils/__init__.py`
- Test: Run backend test suite to verify no regressions

**Rationale:** The utils directory exists but lacks __init__.py, causing static analysis import warnings. This is a standard Python package requirement.

- [ ] **Step 1: Create the empty __init__.py file**

```python
"""
Utility functions package.

Contains:
- file_utils: File I/O operations
- logger: Logging configuration
- runtime_context: Runtime context management
- vector_db: Vector database operations
- volc_engine: Volcano engine integration
- yaml_utils: YAML parsing utilities
- json_utils: JSON parsing utilities
"""
```

- [ ] **Step 2: Verify Python can import from utils package**

Run:
```bash
conda activate novel_agent
cd /Users/nobody1/Desktop/project/writer
python -c "from backend.utils.logger import logger; print('Import successful')"
```

Expected: `Import successful`

- [ ] **Step 3: Run backend tests to verify no regressions**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
python -m unittest discover tests -v 2>&1 | tail -10
```

Expected: `OK` (142 tests passed)

- [ ] **Step 4: Commit**

```bash
git add backend/utils/__init__.py
git commit -m "fix: add __init__.py to backend/utils package"
```

---

### Task 2: Fix format parameter naming conflict in export_tasks.py

**Files:**
- Modify: `backend/tasks/export_tasks.py:19,28,32,48,73`
- Test: Run backend tests, specifically export-related tests

**Rationale:** `format` is a Python built-in function. Using it as a parameter name can cause confusion and shadow the built-in. Renaming to `export_format` follows best practices.

- [ ] **Step 1: Read the current file and identify all uses of `format` parameter**

```bash
cd /Users/nobody1/Desktop/project/writer
grep -n "format" backend/tasks/export_tasks.py
```

Expected: Shows all lines using the `format` parameter.

- [ ] **Step 2: Update the parameter name and all references**

Change line 19 from:
```python
def export_project_task(self, project_id: int, format: str) -> dict:
```

To:
```python
def export_project_task(self, project_id: int, export_format: str) -> dict:
```

And update all references to the parameter within the function:
- Line using format in the state update metadata
- Line passing format to ExportService
- Any other uses of the parameter

- [ ] **Step 3: Verify the syntax is correct**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
python -m py_compile backend/tasks/export_tasks.py
echo $?
```

Expected: `0` (no syntax errors)

- [ ] **Step 4: Run export-related tests**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
python -m unittest tests.test_export_service_security -v 2>&1 | tail -10
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/tasks/export_tasks.py
git commit -m "fix: rename format parameter to export_format to avoid shadowing built-in"
```

---

### Task 3: Fix Button component Spinner created during render

**Files:**
- Modify: `frontend/src/components/v2/Button/Button.tsx:60-65,74`
- Test: Button component tests

**Rationale:** Defining components inside render causes unnecessary re-creation on every render and prevents React Compiler optimization. Inlining the SVG directly avoids this issue.

- [ ] **Step 1: Read the Button component around lines 60-78**

Current code:
```tsx
const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

return (
  <button ...>
    {loading && <Spinner />}
    ...
  </button>
)
```

- [ ] **Step 2: Remove the Spinner function and inline the SVG**

Replace:
```tsx
const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)
```

With: (Delete this function definition entirely)

And in the render JSX, replace:
```tsx
{loading && <Spinner />}
```

With:
```tsx
{loading && (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)}
```

- [ ] **Step 3: Run ESLint to verify the error is fixed**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx eslint src/components/v2/Button/Button.tsx 2>&1
```

Expected: No ESLint errors about "Cannot create components during render"

- [ ] **Step 4: Run Button component tests**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx vitest run src/components/v2/Button/Button.test.tsx 2>&1 | tail -20
```

Expected: All Button tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/v2/Button/Button.tsx
git commit -m "fix: inline Button spinner to avoid component creation during render"
```

---

### Task 4: Fix Checkbox useMemo dependency mismatch

**Files:**
- Modify: `frontend/src/components/v2/Checkbox/Checkbox.tsx:41-46`
- Test: Checkbox component tests

**Rationale:** The useMemo dependency array doesn't match what React Compiler infers. The issue is `groupContext?.value` vs `groupContext.value`. Since `isInGroup` is checked first, we can safely use non-optional access.

- [ ] **Step 1: Read the Checkbox component around the useMemo call**

Current code:
```tsx
const isChecked = useMemo(() => {
  if (isInGroup) {
    return groupContext.value.includes(value!)
  }
  return checkedProp
}, [isInGroup, groupContext?.value, value, checkedProp])
```

- [ ] **Step 2: Fix the dependency array**

Change from:
```tsx
}, [isInGroup, groupContext?.value, value, checkedProp])
```

To:
```tsx
}, [isInGroup, groupContext.value, value, checkedProp])
```

**Rationale:** When `isInGroup` is true, `groupContext` is guaranteed to exist (otherwise the Checkbox wouldn't be in a group context). The optional chaining `?.` causes React Compiler to infer different dependencies.

- [ ] **Step 3: Run ESLint to verify the error is fixed**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx eslint src/components/v2/Checkbox/Checkbox.tsx 2>&1
```

Expected: No ESLint errors about "Existing memoization could not be preserved"

- [ ] **Step 4: Run Checkbox component tests**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx vitest run src/components/v2/Checkbox/Checkbox.test.tsx 2>&1 | tail -20
```

Expected: All Checkbox tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/v2/Checkbox/Checkbox.tsx
git commit -m "fix: correct useMemo dependencies for Checkbox group context"
```

---

### Task 5: Final Verification

**Files:** None - verification only

- [ ] **Step 1: Run full backend test suite**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
python -m unittest discover tests -v 2>&1 | tail -10
```

Expected: `OK` (142 tests passed)

- [ ] **Step 2: Run full frontend test suite**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npm run test:run 2>&1 | tail -10
```

Expected: 203 tests passed

- [ ] **Step 3: Run TypeScript type check**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx tsc --noEmit 2>&1
```

Expected: No type errors

- [ ] **Step 4: Run full ESLint check on changed files**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer/frontend
npx eslint src/components/v2/Button/Button.tsx src/components/v2/Checkbox/Checkbox.tsx 2>&1
```

Expected: No ESLint errors

- [ ] **Step 5: Final summary verification**

Verify all 4 issues are resolved:
1.  `backend/utils/__init__.py` exists
2.  `export_tasks.py` uses `export_format` instead of `format`
3.  Button spinner is inlined, no component creation during render
4.  Checkbox useMemo dependencies are corrected

---

## Self-Review Check

**1. Spec coverage:**
-  Task 1 covers: backend/utils/__init__.py missing
-  Task 2 covers: format parameter naming conflict
-  Task 3 covers: Button Spinner created during render
-  Task 4 covers: Checkbox useMemo dependency mismatch
-  Task 5 covers: Final verification (tests, type check, ESLint)
- **No gaps**

**2. Placeholder scan:**
- All code blocks show exact changes
- All commands are exact with expected outputs
- No "TBD", "TODO", or vague instructions
- **No placeholders found**

**3. Type consistency:**
- File paths match actual project structure
- Line numbers verified against actual files
- Parameter names consistent across tasks
- **No inconsistencies found**
