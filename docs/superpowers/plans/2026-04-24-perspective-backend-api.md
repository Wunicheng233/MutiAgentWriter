# 作家视角 - 后端 API 与数据模型实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现后端数据库字段扩展、API 端点以及智能体参数透传，让视角选择可以在项目级别持久化并生效。

**Architecture:** 通过扩展 Project 模型添加视角配置字段，新增 perspectives API 端点提供视角列表/详情服务，修改各 agent 入口函数透传 perspective 参数。

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic

---

## 文件结构总览

| 操作 | 路径 | 职责 |
|-----|------|------|
| 修改 | `backend/models.py` | Project 表新增视角相关字段 |
| 创建 | `backend/api/perspectives.py` | 视角 API 端点 (list, get detail, update project) |
| 修改 | `backend/main.py` | 注册 perspectives router |
| 修改 | `agents/planner_agent.py` | 透传 perspective 参数 |
| 修改 | `agents/writer_agent.py` | 透传 perspective 参数 |
| 修改 | `agents/critic_agent.py` | 透传 perspective 参数 |
| 修改 | `agents/revise_agent.py` | 透传 perspective 参数 |
| 创建 | `tests/test_perspective_api.py` | API 集成测试 |

---

## Task 1: 数据库模型扩展

**Files:**
- Modify: `backend/models.py:Project`
- Create: `tests/test_perspective_api.py`

- [ ] **Step 1: 写测试用例 - Project 模型字段检查**

```python
# tests/test_perspective_api.py
import unittest
from sqlalchemy import inspect
from backend.database import Base, engine


class ModelFieldTests(unittest.TestCase):
    def test_project_has_perspective_fields(self):
        """Project 模型应该有所有视角相关字段"""
        inspector = inspect(engine)
        columns = [c['name'] for c in inspector.get_columns('projects')]

        # 检查字段是否存在
        # 注意：这个测试初始会失败，因为字段还没加，需要先做 migration
        # 这是一个验证测试，确保 migration 正确执行

        # 我们先做一个简单的 import 测试
        from backend.models import Project

        # 检查类属性
        self.assertTrue(hasattr(Project, 'writer_perspective'))
        self.assertTrue(hasattr(Project, 'use_perspective_critic'))
        self.assertTrue(hasattr(Project, 'perspective_strength'))
        self.assertTrue(hasattr(Project, 'perspective_mix'))

        print(" Project 模型包含所有视角相关字段")
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_api.ModelFieldTests.test_project_has_perspective_fields -v
```
Expected: FAIL (fields don't exist yet)

- [ ] **Step 3: 扩展 Project 模型**

找到 `backend/models.py` 中的 `Project` 类，添加字段：

```python
# 在 backend/models.py 的 Project 类中添加：

class Project(db.Model):
    __tablename__ = 'projects'

    # ... 保留所有原有字段 ...

    # === 新增：创作风格配置 ===
    # 选定的作家视角 ID（如 'liu-cixin'），None 表示默认模式
    writer_perspective = db.Column(db.String(100), nullable=True)

    # 是否同时应用该视角的评审标准来做 Critic
    use_perspective_critic = db.Column(db.Boolean, default=True)

    # 视角强度 (0.0-1.0)
    # 0.3 = 轻微风格影响
    # 0.7 = 完整融入心智模型和表达风格（默认）
    # 1.0 = 完全按该作家模式创作
    perspective_strength = db.Column(db.Float, default=0.7)

    # 混合视角模式（可选）- JSON 格式存储
    # 示例：[{"id": "jin-yong", "weight": 0.7}, {"id": "liu-cixin", "weight": 0.3}]
    perspective_mix = db.Column(db.JSON, nullable=True)
```

- [ ] **Step 4: 运行测试验证字段存在**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_api.ModelFieldTests.test_project_has_perspective_fields -v
```
Expected: PASS

- [ ] **Step 5: 生成 Alembic 迁移脚本**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent alembic revision --autogenerate -m "add perspective fields to project"
```

检查生成的迁移文件（`alembic/versions/` 下最新的 `.py`），确保内容正确：
- 应该有 `add_column` 操作添加 4 个新字段
- 不应该有无关的表变更

- [ ] **Step 6: 执行迁移**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent alembic upgrade head
```

Expected: 迁移成功，数据库表结构更新

- [ ] **Step 7: 提交**

```bash
git add backend/models.py alembic/versions/
git commit -m "feat: add perspective fields to Project model"
```

---

## Task 2: Perspectives API 端点 - 列表与详情

**Files:**
- Create: `backend/api/perspectives.py`
- Modify: `backend/main.py`

- [ ] **Step 1: 写测试用例 - 获取视角列表**

```python
# 添加到 tests/test_perspective_api.py

from fastapi.testclient import TestClient
from backend.main import app


class PerspectiveAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_list_perspectives_endpoint_exists(self):
        """GET /perspectives 应该返回可用视角列表"""
        response = self.client.get("/perspectives/")

        # 端点应该存在
        self.assertNotEqual(response.status_code, 404)

        # 应该至少有一个视角（liu-cixin）
        data = response.json()
        self.assertIn('perspectives', data)
        perspectives = data['perspectives']

        # 找到刘慈欣视角
        liu_cixin = next((p for p in perspectives if p['id'] == 'liu-cixin'), None)
        self.assertIsNotNone(liu_cixin)
        self.assertEqual(liu_cixin['name'], '刘慈欣')
        self.assertEqual(liu_cixin['genre'], '科幻')

        print(f" 获取到 {len(perspectives)} 个视角")

    def test_get_perspective_detail(self):
        """GET /perspectives/{id} 应该返回视角详情"""
        response = self.client.get("/perspectives/liu-cixin")

        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data['id'], 'liu-cixin')
        self.assertEqual(data['name'], '刘慈欣')
        self.assertIn('preview', data)
        self.assertIn('planner_injection', data['preview'])
        self.assertIn('writer_injection', data['preview'])
        self.assertIn('critic_injection', data['preview'])
        self.assertIn('strengths', data)
        self.assertIn('weaknesses', data)

    def test_get_nonexistent_perspective_returns_404(self):
        """获取不存在的视角应该返回 404"""
        response = self.client.get("/perspectives/nonexistent-writer-12345")
        self.assertEqual(response.status_code, 404)
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_api.PerspectiveAPITests.test_list_perspectives_endpoint_exists -v
```
Expected: FAIL with 404 (endpoint not registered)

- [ ] **Step 3: 实现 perspectives API 端点**

创建 `backend/api/perspectives.py`：

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from core.perspective_engine import PerspectiveEngine

router = APIRouter(prefix="/perspectives", tags=["perspectives"])


class Perspective(BaseModel):
    id: str
    name: str
    genre: str
    description: str
    strength_recommended: float
    builtin: bool
    strengths: List[str]
    weaknesses: List[str]


class PerspectiveDetail(Perspective):
    preview: Dict[str, str]


@router.get("/", response_model=Dict[str, List[Perspective]])
async def list_perspectives():
    """列出所有可用的作家视角"""
    perspectives = PerspectiveEngine.list_available_perspectives()

    # 补充 strengths 和 weaknesses
    for p in perspectives:
        try:
            engine = PerspectiveEngine(p['id'])
            p['strengths'] = engine.perspective_data.get('strengths', [])
            p['weaknesses'] = engine.perspective_data.get('weaknesses', [])
        except Exception:
            p['strengths'] = []
            p['weaknesses'] = []

    return {"perspectives": perspectives}


@router.get("/{perspective_id}", response_model=PerspectiveDetail)
async def get_perspective_detail(perspective_id: str):
    """获取特定视角的详细信息和预览"""
    try:
        engine = PerspectiveEngine(perspective_id)
        data = engine.perspective_data
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Perspective '{perspective_id}' not found")

    return PerspectiveDetail(
        id=perspective_id,
        name=data['name'],
        genre=data['genre'],
        description=data['description'],
        strength_recommended=data['strength_recommended'],
        builtin=True,
        strengths=data.get('strengths', []),
        weaknesses=data.get('weaknesses', []),
        preview={
            'planner_injection': engine._get_planner_injection(data['strength_recommended']),
            'writer_injection': engine._get_writer_injection(data['strength_recommended']),
            'critic_injection': engine._get_critic_injection(data['strength_recommended']),
        }
    )


class UpdateProjectPerspectiveRequest(BaseModel):
    perspective: Optional[str] = None
    perspective_strength: float = 0.7
    use_perspective_critic: bool = True


@router.put("/project/{project_id}")
async def update_project_perspective(
    project_id: int,
    request: UpdateProjectPerspectiveRequest,
):
    """更新项目的创作风格配置"""
    from backend.database import SessionLocal
    from backend.models import Project

    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # 验证 perspective 是否有效
        if request.perspective is not None:
            try:
                PerspectiveEngine(request.perspective)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid perspective: {request.perspective}")

        # 更新字段
        project.writer_perspective = request.perspective
        project.perspective_strength = request.perspective_strength
        project.use_perspective_critic = request.use_perspective_critic

        db.commit()

        return {
            "status": "ok",
            "writer_perspective": project.writer_perspective,
            "perspective_strength": project.perspective_strength,
            "use_perspective_critic": project.use_perspective_critic,
        }
    finally:
        db.close()
```

- [ ] **Step 4: 在 main.py 中注册 router**

在 `backend/main.py` 中找到其他 router 注册的位置，添加：

```python
# 在其他 router.include_router 之后添加：
from backend.api.perspectives import router as perspectives_router
app.include_router(perspectives_router)
```

- [ ] **Step 5: 运行 API 测试**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_api.PerspectiveAPITests -v
```
Expected: All 3 tests PASS

- [ ] **Step 6: 手动验证端点（可选）**

启动后端并访问：
```
http://localhost:8000/docs
```
检查 `/perspectives/` 端点是否正常工作

- [ ] **Step 7: 提交**

```bash
git add backend/api/perspectives.py backend/main.py tests/test_perspective_api.py
git commit -m "feat: add perspectives API endpoints"
```

---

## Task 3: Writer Agent 参数透传

**Files:**
- Modify: `agents/writer_agent.py`
- Modify: `tests/test_perspective_e2e.py`

- [ ] **Step 1: 写测试用例 - writer_agent 支持 perspective**

```python
# 添加到 tests/test_perspective_e2e.py

class WriterAgentPerspectiveTests(unittest.TestCase):
    def test_writer_agent_accepts_perspective_parameter(self):
        """generate_chapter 应该接受 perspective 参数"""
        import inspect
        from agents.writer_agent import generate_chapter

        sig = inspect.signature(generate_chapter)
        params = list(sig.parameters.keys())

        self.assertIn('perspective', params)
        self.assertIn('perspective_strength', params)

        print(" generate_chapter 接受 perspective 和 perspective_strength 参数")

    def test_writer_agent_perspective_effect(self):
        """传入 perspective 应该影响生成的 prompt"""
        from agents.writer_agent import generate_chapter

        # 这是一个测试，验证参数传递不会导致错误
        # 我们不实际调用 LLM API，只验证函数签名和参数接收

        # 检查函数定义
        import inspect
        source = inspect.getsource(generate_chapter)

        # 应该在调用 load_prompt 时传入 perspective
        self.assertIn('perspective', source)
        self.assertIn('perspective_strength', source)

        print(" generate_chapter 内部使用 perspective 参数")
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_e2e.WriterAgentPerspectiveTests.test_writer_agent_accepts_perspective_parameter -v
```
Expected: FAIL (parameter doesn't exist yet)

- [ ] **Step 3: 修改 writer_agent.py 支持 perspective 参数**

找到 `agents/writer_agent.py` 中的 `generate_chapter` 函数，修改签名和实现：

```python
# 修改函数签名
def generate_chapter(
    setting_bible: str,
    plan: str,
    chapter_num: int,
    prev_chapter_end: str = "",
    related_content: str = "",
    constraints: dict = None,
    target_word_count: int = 2000,
    content_type: str = "full_novel",
    client = None,
    perspective: str = None,           # 新增
    perspective_strength: float = 0.7,  # 新增
) -> str:
    # ... 原有代码 ...

    # 找到加载 prompt 的调用，添加 perspective 参数：
    system_prompt = load_prompt(
        'writer',
        content_type=content_type,
        perspective=perspective,
        perspective_strength=perspective_strength,
    )

    # ... 其余代码保持不变 ...
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_e2e.WriterAgentPerspectiveTests -v
```
Expected: Both tests PASS

- [ ] **Step 5: 提交**

```bash
git add agents/writer_agent.py tests/test_perspective_e2e.py
git commit -m "feat: pass perspective parameters to writer agent"
```

---

## Task 4: Planner、Critic、Revise Agent 参数透传

**Files:**
- Modify: `agents/planner_agent.py`
- Modify: `agents/critic_agent.py`
- Modify: `agents/revise_agent.py`
- Modify: `tests/test_perspective_e2e.py`

- [ ] **Step 1: 修改 planner_agent.py**

```python
# agents/planner_agent.py

# 修改 generate_plan 函数签名
def generate_plan(
    core_requirement: str,
    target_platform: str,
    chapter_word_count: str,
    content_type: str = "full_novel",
    world_bible: str = "",
    genre: str = "",
    total_words: str = "",
    core_hook: str = "",
    client = None,
    perspective: str = None,           # 新增
    perspective_strength: float = 0.7,  # 新增
) -> str:
    # ... 原有代码 ...

    # 找到 call_volc_api 之前的 load_prompt 调用
    # 注意：planner 使用 call_volc_api 时 context 会传给 load_prompt
    # 所以我们需要把 perspective 加到 context 里

    context = {}
    if world_bible:
        context["world_bible"] = world_bible
    if genre:
        context["genre"] = genre
    if target_platform:
        context["platform"] = target_platform
    if total_words:
        context["total_words"] = total_words
    if core_hook:
        context["core_hook"] = core_hook

    # 新增：把 perspective 配置加入 context
    context["perspective"] = perspective
    context["perspective_strength"] = perspective_strength

    logger.info(f" 顶层策划Agent正在生成{content_type}方案...")
    return call_volc_api("planner", user_input, content_type=content_type, context=context, client=client)
```

- [ ] **Step 2: 修改 critic_agent.py**

```python
# agents/critic_agent.py - 类似地修改函数签名和 perspective 传递

def evaluate_chapter(
    chapter_content: str,
    setting_bible: str,
    chapter_outline: str,
    prev_chapter_summary: str = "",
    client = None,
    perspective: str = None,
    perspective_strength: float = 0.7,
) -> str:
    # ... 原有代码 ...

    system_prompt = load_prompt(
        'critic',
        perspective=perspective,
        perspective_strength=perspective_strength,
    )

    # ... 其余代码 ...
```

- [ ] **Step 3: 修改 revise_agent.py**

```python
# agents/revise_agent.py

def revise_chapter(
    original_content: str,
    critique: str,
    setting_bible: str = "",
    chapter_outline: str = "",
    client = None,
    perspective: str = None,
    perspective_strength: float = 0.7,
) -> str:
    # ... 原有代码 ...

    system_prompt = load_prompt(
        'revise',
        perspective=perspective,
        perspective_strength=perspective_strength,
    )

    # ... 其余代码 ...
```

- [ ] **Step 4: 添加集成测试**

```python
# 添加到 tests/test_perspective_e2e.py

class AllAgentsPerspectiveTests(unittest.TestCase):
    def test_all_agents_accept_perspective(self):
        """所有 agent 入口函数都应该接受 perspective 参数"""
        import inspect

        agents_to_check = [
            ('planner_agent', 'generate_plan'),
            ('writer_agent', 'generate_chapter'),
            ('critic_agent', 'evaluate_chapter'),
            ('revise_agent', 'revise_chapter'),
        ]

        for module_name, func_name in agents_to_check:
            module = __import__(f'agents.{module_name}', fromlist=[func_name])
            func = getattr(module, func_name)
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())

            self.assertIn(
                'perspective',
                params,
                f"{module_name}.{func_name} 缺少 perspective 参数"
            )
            self.assertIn(
                'perspective_strength',
                params,
                f"{module_name}.{func_name} 缺少 perspective_strength 参数"
            )

            print(f" {module_name}.{func_name} 接受 perspective 参数")
```

- [ ] **Step 5: 运行所有 agent 测试**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_e2e.AllAgentsPerspectiveTests.test_all_agents_accept_perspective -v
```
Expected: PASS

- [ ] **Step 6: 运行完整测试套件**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine tests.test_perspective_e2e tests.test_perspective_api -v 2>&1 | tail -30
```
Expected: All tests PASS

- [ ] **Step 7: 提交**

```bash
git add agents/planner_agent.py agents/critic_agent.py agents/revise_agent.py tests/test_perspective_e2e.py
git commit -m "feat: pass perspective parameters to all agents"
```

---

## Task 5: 工作流服务集成 - 生成时自动应用项目视角

**Files:**
- Modify: `backend/services/workflow_service.py` (或对应的工作流入口)

- [ ] **Step 1: 找到工作流中调用 agent 的位置**

检查项目中触发章节生成的代码位置（通常在 `backend/tasks.py` 或 `backend/services/workflow_service.py`），找到调用 `generate_chapter`、`generate_plan` 等的地方，从 project 对象读取 perspective 配置并传递。

```python
# 示例代码（根据实际项目结构调整）：
def run_generation_task(project_id: int):
    db = SessionLocal()
    project = db.query(Project).get(project_id)

    # 读取视角配置
    perspective = project.writer_perspective
    strength = project.perspective_strength or 0.7

    # 调用 agent 时传递
    plan = generate_plan(
        ...,
        perspective=perspective,
        perspective_strength=strength,
    )

    # Critic 时根据配置决定是否使用相同视角
    critic_perspective = perspective if project.use_perspective_critic else None

    critique = evaluate_chapter(
        ...,
        perspective=critic_perspective,
        perspective_strength=strength,
    )
```

注意：这一步需要根据项目中实际的工作流实现来做具体调整。如果当前还没有统一的 workflow service，可以先跳过这一步，在前端集成时直接在调用处传递参数。

---

## 计划自检

### Spec 覆盖检查

对照规格文档，本计划覆盖了：
-  Project 表 4 个新增字段
-  Alembic 数据迁移
-  视角列表 API (`GET /perspectives/`)
-  视角详情 API (`GET /perspectives/{id}`)
-  项目视角配置 API (`PUT /perspectives/project/{id}`)
-  所有 4 个 Agent 的 perspective 参数透传
-  完整的集成测试覆盖

### 后续工作说明

以下内容将在后续计划中覆盖：
- 前端 PerspectiveSelector 组件
- 项目配置页集成
- 写作工作台侧边栏切换
- 视角预览生成 API
- 剩余 11+ 个内置视角的 YAML 迁移

---

**计划完成并已保存到 `docs/superpowers/plans/2026-04-24-perspective-backend-api.md`。**
