# StoryForge AI 项目结构重构设计文档

> **目标：** 将当前偏 demo 化的目录结构重构为符合工程规范的、可维护的后端统一结构。

## 1. 重构背景

当前项目的根目录存在大量 Python 模块，结构混乱，不符合工程最佳实践。主要问题：

| 问题 | 影响 |
|------|------|
| **根目录拥挤** | 46 个文件/目录，核心业务模块、配置、临时文件混杂 |
| **import 路径不统一** | `backend/main.py` 需要 `from core.config import ...` 而不是 `from backend.core.config import ...` |
| **模块分散** | `core/`, `agents/`, `tasks/`, `utils/`, `services/` 散落在根目录，缺乏清晰的组织边界 |
| **脚本无人管理** | `update_skills.py`, `debug/*.py` 等一次性脚本没有统一位置 |

## 2. 重构原则

1. **向后兼容优先** —— 关键功能（FastAPI, Celery, CLI）重构后必须能正常运行
2. **最小改动原则** —— 只动文件位置和 import 路径，不修改业务逻辑
3. **测试先行验证** —— 重构后必须通过所有现有测试
4. **逐步提交** —— 按模块分步骤提交，便于回滚

## 3. 目标目录结构

```
StoryForge AI/
├── backend/                          #  整个后端代码统一目录
│   ├── __init__.py
│   ├── main.py                       # FastAPI 入口
│   ├── config.py                     # 配置（从根目录 config.py 合并）
│   ├── models.py
│   ├── schemas.py
│   ├── database.py
│   ├── auth.py
│   ├── deps.py
│   ├── rate_limiter.py
│   ├── task_dispatch.py
│   ├── task_status.py
│   ├── workflow_service.py
│   ├── chapter_sync.py
│   ├── evaluation_sync.py
│   ├── guardrails_config.yaml        # 防护规则配置
│   │
│   ├── api/                          #  FastAPI 路由
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── projects.py
│   │   ├── chapters.py
│   │   ├── tasks.py
│   │   ├── share.py
│   │   ├── perspectives.py
│   │   └── skills.py
│   │
│   ├── core/                         #  核心业务逻辑（从根目录移入）
│   │   ├── __init__.py
│   │   ├── config.py                 # 配置模块
│   │   ├── orchestrator.py
│   │   ├── agent_pool.py
│   │   ├── agent_contract.py
│   │   ├── chapter_saver.py
│   │   ├── chapter_context.py
│   │   ├── evaluation_harness.py
│   │   ├── novel_state_service.py
│   │   ├── outline_parser.py
│   │   ├── progress_reporter.py
│   │   ├── repair_manager.py
│   │   ├── repair_strategy_router.py
│   │   ├── system_guardrails.py
│   │   ├── worldview_manager.py
│   │   └── workflow_optimization.py
│   │
│   ├── skill_runtime/                #  技能运行时系统（从 core/skill_runtime/ 移入）
│   │   ├── __init__.py
│   │   ├── skill_registry.py
│   │   ├── skill_assembler.py
│   │   ├── skill_injector.py
│   │   └── safety_filter.py
│   │
│   ├── agents/                       #  Agent 实现（从根目录移入）
│   │   ├── __init__.py
│   │   ├── writer_agent.py
│   │   ├── critic_agent.py
│   │   ├── revise_agent.py
│   │   └── planner_agent.py
│   │
│   ├── tasks/                        #  Celery 任务（从根目录移入）
│   │   ├── __init__.py
│   │   ├── writing_tasks.py
│   │   └── export_tasks.py
│   │
│   ├── utils/                        #  工具函数（从根目录移入）
│   │   ├── __init__.py
│   │   ├── logger.py
│   │   ├── file_utils.py
│   │   ├── yaml_utils.py
│   │   ├── runtime_context.py
│   │   └── vector_db.py
│   │
│   ├── services/                     #  服务层（从根目录移入）
│   │   ├── __init__.py
│   │   └── export_service.py
│   │
│   ├── skills/                       #  技能包（从根目录移入）
│   │   ├── lu-xun-perspective/
│   │   ├── liu-cixin-perspective/
│   │   ├── haruki-murakami-perspective/
│   │   └── ...
│   │
│   └── perspectives/                 #  视角配置（从根目录移入）
│       ├── _template.yaml
│       └── liu-cixin.yaml
│
├── frontend/                         #  保持不动
│   ├── src/
│   ├── package.json
│   └── ...
│
├── tests/                            #  保持不动，import 路径更新为 backend.*
│   ├── __init__.py
│   ├── base.py
│   ├── test_skill_runtime_system.py
│   ├── test_workflow_optimization.py
│   └── ...
│
├── docs/                             #  文档目录
│   ├── superpowers/
│   │   ├── specs/
│   │   └── plans/
│   ├── ui-architecture-spec.md
│   ├── system-overview.md
│   ├── detailed-workflow.md
│   └── ...
│
├── scripts/                          #  脚本目录（新建）
│   ├── update_skills.py              # 从根目录移入
│   ├── reset_project.py              # 从 debug/ 移入
│   └── cleanup_stuck_tasks.py        # 从 debug/ 移入
│
├── data/                             #  数据目录
│   ├── projects/                     # 用户项目数据
│   └── references/                   # 参考小说文本（从 references/ 移入）
│       ├── 十日终焉-开头.txt
│       ├── 死去的新娘-开头.txt
│       └── ...
│
├── logs/                             #  日志目录（保留最近2天）
├── vector_db/                        #  向量数据库
├── alembic/                          #  数据库迁移
├── docker/                           #  Docker 配置
├── prompts/                          #  Prompt 模板
│
├── alembic.ini
├── celery_app.py                     #  Celery 入口（import 路径更新）
├── main.py                           #  CLI 入口（import 路径更新）
├── requirements.txt
├── .env
├── .gitignore
├── README.md
└── CLAUDE.md
```

## 4. 受影响的文件清单

### 4.1 需要移动的文件

| 源路径 | 目标路径 |
|--------|----------|
| `core/*` | `backend/core/*` |
| `agents/*` | `backend/agents/*` |
| `tasks/*` | `backend/tasks/*` |
| `utils/*` | `backend/utils/*` |
| `services/*` | `backend/services/*` |
| `skills/*` | `backend/skills/*` |
| `perspectives/*` | `backend/perspectives/*` |
| `config.py` | `backend/config.py` |
| `guardrails_config.yaml` | `backend/guardrails_config.yaml` |
| `update_skills.py` | `scripts/update_skills.py` |
| `debug/reset_project.py` | `scripts/reset_project.py` |
| `debug/cleanup_stuck_tasks.py` | `scripts/cleanup_stuck_tasks.py` |
| `references/*` | `data/references/*` |

### 4.2 需要删除的文件/目录

| 路径 | 理由 |
|------|------|
| `plan/*` | 全部9个规划文档，重新规划 |
| `design-comparison.html` | 临时设计评审文件 |
| `assets/` | 空目录 |
| `outputs/` | 空目录 |
| `src/` | 空目录 + 空子目录 |
| `debug/` | 脚本已移到 scripts/ |
| `.cursor/` | 空目录 |
| `.DS_Store` | macOS 垃圾文件 |
| `__pycache__/*` | Python 编译缓存 |
| `.pycache/*` | Python 编译缓存 |
| `.pytest_cache/*` | pytest 缓存（测试时自动重建） |
| `logs/*.log`（除最近2天） | 旧日志文件 |

### 4.3 需要更新 import 路径的文件

#### 入口文件
- `main.py` (根目录)
- `celery_app.py` (根目录)

#### Backend 内部文件
- `backend/main.py`
- `backend/auth.py`
- `backend/deps.py`
- `backend/workflow_service.py`
- `backend/api/*.py` (所有路由文件)
- `backend/core/*.py` (核心模块间的相互引用)
- `backend/agents/*.py` (Agent 间的相互引用)
- `backend/tasks/*.py` (任务文件)

#### 测试文件
- `tests/*.py` (所有测试文件)

## 5. Import 路径更新规则

| 旧路径 | 新路径 |
|--------|--------|
| `from core.xxx import ...` | `from backend.core.xxx import ...` |
| `from agents.xxx import ...` | `from backend.agents.xxx import ...` |
| `from tasks.xxx import ...` | `from backend.tasks.xxx import ...` |
| `from utils.xxx import ...` | `from backend.utils.xxx import ...` |
| `from services.xxx import ...` | `from backend.services.xxx import ...` |
| `from .xxx import ...` (core 内部) | `from .xxx import ...` (保持相对引用不变) |
| `from ..xxx import ...` | `from ..xxx import ...` (保持相对引用不变)

## 6. 验收标准

重构完成后，以下验证必须全部通过：

1. **FastAPI 启动正常**
   ```bash
   conda activate novel_agent
   uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
   访问 http://localhost:8000/api/health 返回 `{"status": "ok"}`

2. **Celery Worker 启动正常**
   ```bash
   celery -A celery_app worker --loglevel=info
   ```

3. **所有单元测试通过**
   ```bash
   python -m unittest discover tests -v
   ```

4. **前端构建成功**
   ```bash
   cd frontend && npm run build
   ```

5. **目录结构符合规范**
   - 根目录文件数量 ≤ 20
   - 没有空目录
   - 没有临时垃圾文件

## 7. 风险与缓解措施

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| import 路径遗漏导致运行失败 | 中 | 高 | 逐模块移动、逐模块验证，不一次性移动所有文件 |
| 相对 import 在模块内部失效 | 低 | 中 | 先检查模块内部的相对引用，必要时改为绝对引用 |
| 测试文件 import 更新遗漏 | 中 | 中 | 每个模块移动后立即运行相关测试 |
| 配置文件路径硬编码 | 低 | 高 | grep 搜索所有硬编码的路径并更新 |

## 8. 实施步骤概览

详见生成的实施计划文档。
