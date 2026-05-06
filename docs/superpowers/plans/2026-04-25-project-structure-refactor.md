# StoryForge AI 项目结构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前分散的后端模块重构为统一的 `backend/` 目录结构，同时清理临时文件和过时文档，使项目符合工程规范。

**Architecture:** 分阶段逐步迁移，每完成一组相关文件的移动就立即更新 import 路径并运行测试，确保系统始终可运行。采用"先清理、后迁移、再验证"的三段式流程。

**Tech Stack:** Python 3.10+, FastAPI, Celery, Git

---

##  重要前置说明

1. **必须在独立 worktree 中执行** — 这是大规模重构，建议新建分支或 worktree
2. **每步提交** — 每个任务完成后立即 commit，便于回滚
3. **先测试再提交** — 提交前必须运行相关测试验证
4. **不要混合改动** — 只动文件位置和 import 路径，不修改任何业务逻辑

---

## 阶段一：清理（先删除不需要的文件，降低干扰）

### Task 1: 删除过时规划文档和临时文件

**Files:**
- Delete: `plan/*` (全部9个文件)
- Delete: `design-comparison.html`
- Delete: `.DS_Store`

- [ ] **Step 1: 删除 plan 目录所有内容**
```bash
rm -rf plan/
```

- [ ] **Step 2: 删除临时 HTML 文件**
```bash
rm design-comparison.html
```

- [ ] **Step 3: 删除 .DS_Store**
```bash
rm .DS_Store
```

- [ ] **Step 4: 验证删除成功**
```bash
ls -la | grep -E "plan|design-comparison|DS_Store"
```
Expected: 无输出

- [ ] **Step 5: Commit**
```bash
git add -u
git commit -m "cleanup: remove outdated plan docs and temp files"
```

---

### Task 2: 删除空目录和缓存文件

**Files:**
- Delete: `assets/` (空目录)
- Delete: `outputs/` (空目录)
- Delete: `src/` (空目录)
- Delete: `.cursor/` (空目录)
- Delete: `__pycache__/` (Python 缓存)
- Delete: `.pycache/` (Python 缓存)
- Delete: `.pytest_cache/` (pytest 缓存)

- [ ] **Step 1: 删除所有空目录**
```bash
rmdir assets/ outputs/ src/test/ src/ .cursor/ 2>/dev/null || true
```

- [ ] **Step 2: 删除 Python 缓存目录**
```bash
rm -rf __pycache__/ .pycache/ .pytest_cache/
```

- [ ] **Step 3: 验证删除成功**
```bash
ls -la | grep -E "assets|outputs|src|cursor|__pycache__|pycache"
```
Expected: 无输出

- [ ] **Step 4: Commit**
```bash
git add -u
git commit -m "cleanup: remove empty dirs and cache files"
```

---

### Task 3: 清理旧日志（保留最近2天）

**Files:**
- Delete: `logs/*.log` (早于2天的日志)

- [ ] **Step 1: 列出所有日志文件**
```bash
ls -la logs/
```

- [ ] **Step 2: 删除2天以前的日志**
```bash
find logs/ -name "*.log" -type f -mtime +2 -delete
```
注意：如果当前所有日志都是最近2天的，这条命令不会删除任何文件。

- [ ] **Step 3: 验证清理结果**
```bash
ls -la logs/
```
Expected: 只保留最近2天的日志文件

- [ ] **Step 4: Commit**
```bash
git add -u
git commit -m "cleanup: remove old log files"
```

---

## 阶段二：脚本和数据目录整理

### Task 4: 创建 scripts/ 目录并移动脚本

**Files:**
- Create: `scripts/` (目录)
- Move: `update_skills.py` → `scripts/update_skills.py`
- Move: `debug/reset_project.py` → `scripts/reset_project.py`
- Move: `debug/cleanup_stuck_tasks.py` → `scripts/cleanup_stuck_tasks.py`
- Delete: `debug/` (目录)

- [ ] **Step 1: 创建 scripts 目录**
```bash
mkdir -p scripts
```

- [ ] **Step 2: 移动 update_skills.py**
```bash
git mv update_skills.py scripts/update_skills.py
```

- [ ] **Step 3: 移动 debug 下的脚本**
```bash
git mv debug/reset_project.py scripts/reset_project.py
git mv debug/cleanup_stuck_tasks.py scripts/cleanup_stuck_tasks.py
```

- [ ] **Step 4: 删除空的 debug 目录**
```bash
rmdir debug/
```

- [ ] **Step 5: 验证移动结果**
```bash
ls -la scripts/
```
Expected: 能看到 3 个脚本文件

- [ ] **Step 6: 验证 debug 目录已删除**
```bash
ls -la | grep debug
```
Expected: 无输出

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "refactor: move scripts to scripts/ directory"
```

---

### Task 5: 整理 references 目录到 data/

**Files:**
- Create: `data/references/`
- Move: `references/*` → `data/references/*`
- Delete: `references/` (目录)

- [ ] **Step 1: 创建 data/references 目录**
```bash
mkdir -p data/references
```

- [ ] **Step 2: 移动所有参考文件**
```bash
git mv references/* data/references/
```

- [ ] **Step 3: 删除空的 references 目录**
```bash
rmdir references/
```

- [ ] **Step 4: 验证移动结果**
```bash
ls -la data/references/
```
Expected: 能看到所有参考小说文本文件

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "refactor: move references to data/references/"
```

---

## 阶段三：后端模块重构（核心部分）

### Task 6: 移动 core/ 目录到 backend/core/

**Files:**
- Move: `core/*` → `backend/core/*`
- Delete: `core/` (目录)

- [ ] **Step 1: 确保 backend 目录存在**
```bash
ls -la backend/
```
Expected: 能看到 backend 目录已存在

- [ ] **Step 2: 移动 core 目录下的所有文件**
```bash
mkdir -p backend/core
git mv core/* backend/core/
```

- [ ] **Step 3: 移动 skill_runtime 子目录（如果在 core/ 下）**
```bash
# 如果 core/skill_runtime/ 存在，它已经被上一步移动了
ls -la backend/core/
```

- [ ] **Step 4: 删除空的 core 目录**
```bash
rmdir core/ 2>/dev/null || true
```

- [ ] **Step 5: 验证移动结果**
```bash
ls -la backend/core/
```
Expected: 能看到 `__init__.py`, `config.py`, `orchestrator.py` 等文件

- [ ] **Step 6: 先不 commit！先做 Task 7 更新 import 路径**

---

### Task 7: 更新所有文件中对 `core.*` 的 import 路径

**Files:**
- Modify: `main.py`
- Modify: `celery_app.py`
- Modify: `backend/main.py`
- Modify: `backend/auth.py`
- Modify: `backend/deps.py`
- Modify: `backend/workflow_service.py`
- Modify: `backend/api/*.py` (所有路由文件)
- Modify: `tests/*.py` (所有测试文件)

- [ ] **Step 1: 更新根目录 main.py**
```python
# 修改前
from core.orchestrator import NovelOrchestrator

# 修改后
from backend.core.orchestrator import NovelOrchestrator
```

- [ ] **Step 2: 更新 backend/main.py**
```python
# 修改前
from core.config import settings

# 修改后
from backend.core.config import settings
```

- [ ] **Step 3: 更新 backend/auth.py**
```python
# 修改前
from core.config import settings

# 修改后
from backend.core.config import settings
```

- [ ] **Step 4: 更新 backend/deps.py**
```python
# 检查 deps.py 中的 import，如有 core 相关引用更新为 backend.core
```

- [ ] **Step 5: 更新 backend/workflow_service.py**
```python
# 修改前
from core.agent_contract import get_agent_contract

# 修改后
from backend.core.agent_contract import get_agent_contract
```

- [ ] **Step 6: 更新 backend/api/*.py 中的所有路由文件**
```bash
# 查找所有需要更新的文件
grep -l "from core" backend/api/*.py
```
对每个找到的文件，将 `from core.xxx` 替换为 `from backend.core.xxx`

- [ ] **Step 7: 更新 tests/*.py 中的所有测试文件**
```bash
# 查找所有需要更新的文件
grep -l "from core" tests/*.py
```
对每个找到的文件，将 `from core.xxx` 替换为 `from backend.core.xxx`

- [ ] **Step 8: 更新 backend/core 内部的跨模块引用**
```bash
# 检查 core 内部是否有使用绝对路径 import 的情况
grep -l "from core" backend/core/*.py
```
如有，替换为 `from backend.core`

- [ ] **Step 9: 运行基本验证测试**
```bash
python -c "from backend.core.config import settings; print('OK')"
```
Expected: 输出 OK

- [ ] **Step 10: 运行 orchestrator 导入测试**
```bash
python -c "from backend.core.orchestrator import NovelOrchestrator; print('OK')"
```
Expected: 输出 OK

- [ ] **Step 11: 运行相关单元测试**
```bash
python -m unittest tests/test_config.py -v 2>/dev/null || true
python -m unittest tests/test_orchestrator.py -v 2>/dev/null || true
```

- [ ] **Step 12: Commit core 模块迁移**
```bash
git add -A
git commit -m "refactor: move core/ to backend/core/ and update imports"
```

---

### Task 8: 移动 agents/ 目录到 backend/agents/

**Files:**
- Move: `agents/*` → `backend/agents/*`
- Delete: `agents/` (目录)

- [ ] **Step 1: 移动 agents 目录**
```bash
mkdir -p backend/agents
git mv agents/* backend/agents/
rmdir agents/ 2>/dev/null || true
```

- [ ] **Step 2: 验证移动结果**
```bash
ls -la backend/agents/
```
Expected: 能看到 `__init__.py`, `writer_agent.py`, `critic_agent.py`, `revise_agent.py`, `planner_agent.py`

- [ ] **Step 3: 更新所有引用 agents 的 import 路径**
```bash
# 查找所有需要更新的文件
grep -rl "from agents" backend/ tests/
```
对每个找到的文件，将 `from agents.xxx` 替换为 `from backend.agents.xxx`

- [ ] **Step 4: 特殊处理 backend/core/agent_pool.py**
```python
# agent_pool.py 中有对 agents 的引用，需要更新
# 修改前
from agents import ...
from agents.critic_agent import critic_chapter

# 修改后
from backend.agents import ...
from backend.agents.critic_agent import critic_chapter
```

- [ ] **Step 5: 验证导入**
```bash
python -c "from backend.agents.writer_agent import WriterAgent; print('OK')" 2>/dev/null || python -c "from backend.agents.critic_agent import critic_chapter; print('OK')"
```

- [ ] **Step 6: 运行相关单元测试**
```bash
python -m unittest tests/test_agent_contract.py -v
```

- [ ] **Step 7: Commit agents 模块迁移**
```bash
git add -A
git commit -m "refactor: move agents/ to backend/agents/ and update imports"
```

---

### Task 9: 移动 tasks/ 目录到 backend/tasks/

**Files:**
- Move: `tasks/*` → `backend/tasks/*`
- Delete: `tasks/` (目录)

- [ ] **Step 1: 移动 tasks 目录**
```bash
mkdir -p backend/tasks
git mv tasks/* backend/tasks/
rmdir tasks/ 2>/dev/null || true
```

- [ ] **Step 2: 验证移动结果**
```bash
ls -la backend/tasks/
```
Expected: 能看到 `__init__.py`, `writing_tasks.py`, `export_tasks.py`

- [ ] **Step 3: 更新所有引用 tasks 的 import 路径**
```bash
# 查找所有需要更新的文件
grep -rl "from tasks" backend/ tests/
```
对每个找到的文件，将 `from tasks.xxx` 替换为 `from backend.tasks.xxx`

- [ ] **Step 4: 更新 celery_app.py 中的 import**
```bash
grep "from tasks" celery_app.py
```
如有，更新为 `from backend.tasks.xxx`

- [ ] **Step 5: 验证导入**
```bash
python -c "from backend.tasks.writing_tasks import generate_novel_task; print('OK')"
```

- [ ] **Step 6: Commit tasks 模块迁移**
```bash
git add -A
git commit -m "refactor: move tasks/ to backend/tasks/ and update imports"
```

---

### Task 10: 移动 utils/ 目录到 backend/utils/

**Files:**
- Move: `utils/*` → `backend/utils/*`
- Delete: `utils/` (目录)

- [ ] **Step 1: 移动 utils 目录**
```bash
mkdir -p backend/utils
git mv utils/* backend/utils/
rmdir utils/ 2>/dev/null || true
```

- [ ] **Step 2: 验证移动结果**
```bash
ls -la backend/utils/
```
Expected: 能看到 `__init__.py`, `logger.py`, `file_utils.py`, `yaml_utils.py`, `runtime_context.py`, `vector_db.py`

- [ ] **Step 3: 更新所有引用 utils 的 import 路径**
```bash
# 查找所有需要更新的文件
grep -rl "from utils" backend/ tests/
```
对每个找到的文件，将 `from utils.xxx` 替换为 `from backend.utils.xxx`

- [ ] **Step 4: 特殊处理 backend/core 内部对 utils 的引用**
```bash
grep -l "from utils" backend/core/*.py
```
更新这些文件中的 import 路径

- [ ] **Step 5: 验证导入**
```bash
python -c "from backend.utils.logger import logger; print('OK')"
python -c "from backend.utils.file_utils import save_output; print('OK')"
```

- [ ] **Step 6: 运行相关单元测试**
```bash
python -m unittest tests/test_runtime_context.py -v
```

- [ ] **Step 7: Commit utils 模块迁移**
```bash
git add -A
git commit -m "refactor: move utils/ to backend/utils/ and update imports"
```

---

### Task 11: 移动 services/ 目录到 backend/services/

**Files:**
- Move: `services/*` → `backend/services/*`
- Delete: `services/` (目录)

- [ ] **Step 1: 移动 services 目录**
```bash
mkdir -p backend/services
git mv services/* backend/services/
rmdir services/ 2>/dev/null || true
```

- [ ] **Step 2: 验证移动结果**
```bash
ls -la backend/services/
```
Expected: 能看到 `__init__.py`, `export_service.py`

- [ ] **Step 3: 更新所有引用 services 的 import 路径**
```bash
# 查找所有需要更新的文件
grep -rl "from services" backend/ tests/
```
对每个找到的文件，将 `from services.xxx` 替换为 `from backend.services.xxx`

- [ ] **Step 4: 验证导入**
```bash
python -c "from backend.services.export_service import ExportService; print('OK')"
```

- [ ] **Step 5: 运行相关单元测试**
```bash
python -m unittest tests/test_export_service_security.py -v
```

- [ ] **Step 6: Commit services 模块迁移**
```bash
git add -A
git commit -m "refactor: move services/ to backend/services/ and update imports"
```

---

### Task 12: 移动 skills/ 目录到 backend/skills/

**Files:**
- Move: `skills/*` → `backend/skills/*`
- Delete: `skills/` (目录)

- [ ] **Step 1: 移动 skills 目录**
```bash
mkdir -p backend/skills
git mv skills/* backend/skills/
rmdir skills/ 2>/dev/null || true
```

- [ ] **Step 2: 验证移动结果**
```bash
ls -la backend/skills/
```
Expected: 能看到所有技能包目录

- [ ] **Step 3: 更新 skill_runtime 中加载 skills 的路径（如果有硬编码）**
```bash
grep -r "skills" backend/core/skill_runtime/*.py
```
检查是否有硬编码的路径需要更新

- [ ] **Step 4: 验证技能系统导入**
```bash
python -c "from backend.core.skill_runtime.skill_registry import SkillRegistry; print('OK')"
```

- [ ] **Step 5: 运行相关单元测试**
```bash
python -m unittest tests/test_skill_runtime_system.py -v
```

- [ ] **Step 6: Commit skills 目录迁移**
```bash
git add -A
git commit -m "refactor: move skills/ to backend/skills/"
```

---

### Task 13: 移动 perspectives/ 目录到 backend/perspectives/

**Files:**
- Move: `perspectives/*` → `backend/perspectives/*`
- Delete: `perspectives/` (目录)

- [ ] **Step 1: 移动 perspectives 目录**
```bash
mkdir -p backend/perspectives
git mv perspectives/* backend/perspectives/
rmdir perspectives/ 2>/dev/null || true
```

- [ ] **Step 2: 验证移动结果**
```bash
ls -la backend/perspectives/
```
Expected: 能看到 `_template.yaml`, `liu-cixin.yaml`

- [ ] **Step 3: 检查是否有代码硬编码了 perspectives 路径**
```bash
grep -r "perspectives" backend/ --include="*.py"
```
如有硬编码路径，更新为 `backend/perspectives/`

- [ ] **Step 4: Commit perspectives 目录迁移**
```bash
git add -A
git commit -m "refactor: move perspectives/ to backend/perspectives/"
```

---

### Task 14: 移动配置文件

**Files:**
- Move: `config.py` → `backend/config.py`
- Move: `guardrails_config.yaml` → `backend/guardrails_config.yaml`

- [ ] **Step 1: 移动 config.py**
```bash
git mv config.py backend/config.py
```

- [ ] **Step 2: 移动 guardrails_config.yaml**
```bash
git mv guardrails_config.yaml backend/guardrails_config.yaml
```

- [ ] **Step 3: 更新所有引用根目录 config 的 import 路径**
```bash
# 注意：现在有两个 config.py
# backend/config.py 是根目录移动过来的
# backend/core/config.py 是 core 目录下的

# 检查哪个 config.py 是真正被使用的
grep -rl "from config\|from backend.config" backend/ tests/ *.py
```

- [ ] **Step 4: 验证 config 导入**
```bash
python -c "
# 尝试导入配置
try:
    from backend.core.config import settings
    print('Using backend.core.config: OK')
except ImportError as e:
    print(f'Error: {e}')
"
```

- [ ] **Step 5: 检查是否有配置文件合并的需要**
如果 `backend/config.py` 和 `backend/core/config.py` 功能重复，需要在后续重构中合并。当前阶段先保持原样，确保路径正确即可。

- [ ] **Step 6: Commit 配置文件移动**
```bash
git add -A
git commit -m "refactor: move config files to backend/"
```

---

## 阶段四：完整测试验证

### Task 15: 运行完整的后端测试套件

**Files:**
- Test: `tests/*.py` (所有测试文件)

- [ ] **Step 1: 激活 conda 环境**
```bash
conda activate novel_agent
```

- [ ] **Step 2: 运行所有单元测试**
```bash
cd /Users/nobody1/Desktop/project/writer
python -m unittest discover tests -v
```
Expected: 所有测试通过（允许 1 个已知失败的测试跳过）

- [ ] **Step 3: 验证 FastAPI 可启动**
```bash
python -c "
from backend.main import app
print('FastAPI app loaded successfully')
print(f'Routes: {len(app.routes)}')
"
```
Expected: 输出成功信息

- [ ] **Step 4: 验证 Celery 可导入**
```bash
python -c "
import sys
sys.path.insert(0, '.')
# 尝试导入 celery_app 的内容
from backend.tasks.writing_tasks import generate_novel_task
print('Celery tasks OK')
"
```
Expected: 输出 OK

- [ ] **Step 5: 记录测试结果**
如果有测试失败，记录失败的测试名称和错误信息，先回滚到上一个 commit，再逐步排查。

---

### Task 16: 验证前端构建

**Files:**
- Test: `frontend/*`

- [ ] **Step 1: 运行前端构建**
```bash
cd frontend
npm run build
```
Expected: 构建成功，无错误

- [ ] **Step 2: 验证前端 API 调用路径**
前端调用的是 `/api/*` 路径，不受后端内部重构影响，理论上应该没问题。

- [ ] **Step 3: 回到项目根目录**
```bash
cd ..
```

---

## 阶段五：最终检查

### Task 17: 确认最终目录结构

- [ ] **Step 1: 列出根目录文件**
```bash
ls -la
```
Expected: 根目录文件数量 ≤ 20

- [ ] **Step 2: 列出 backend 目录结构**
```bash
find backend -type f -name "*.py" | sort
```
Expected: 所有后端 Python 文件都在 backend/ 下

- [ ] **Step 3: 验证没有遗漏的旧目录**
```bash
ls -la | grep -E "core|agents|tasks|utils|services|skills|perspectives|debug|assets|outputs|src"
```
Expected: 无输出（所有旧目录都已移动或删除）

- [ ] **Step 4: Commit 所有剩余改动（如果有）**
```bash
git status
# 如果还有未提交的变更
git add -A
git commit -m "refactor: final cleanup and structure confirmation"
```

---

##  回滚策略

如果在任何步骤遇到不可解决的问题：

1. **单步回滚**：使用 `git reset --hard HEAD~1` 回滚到上一个 commit
2. **完全回滚**：使用 `git reset --hard main` 回到原始状态
3. **分支保护**：建议在执行前先创建一个备份分支：
   ```bash
   git checkout -b refactor/structure-backup
   git checkout main
   # 然后在 main 分支上执行重构
   ```

---

##  验收标准

重构完成后必须满足：

1. [ ] 所有单元测试通过
2. [ ] FastAPI 可正常启动 (`uvicorn backend.main:app`)
3. [ ] Celery worker 可正常启动
4. [ ] 前端构建成功
5. [ ] 根目录无旧的 Python 模块目录（core/, agents/, tasks/, utils/, services/ 等）
6. [ ] scripts/ 目录存在并包含所有脚本
7. [ ] data/references/ 目录存在并包含参考文件
8. [ ] plan/ 目录已删除
