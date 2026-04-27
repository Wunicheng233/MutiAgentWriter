# StoryForge AI

多智能体协作小说创作系统

<p align="center">
  <a href="https://htmlpreview.github.io/?https://github.com/yourusername/storyforge/blob/main/docs/StoryForge-Showcase.html"><strong>→ 查看交互式展示页</strong></a>
  &nbsp;|&nbsp;
  <a href="https://htmlpreview.github.io/?https://github.com/yourusername/storyforge/blob/main/docs/Components-Showcase.html"><strong>🧩 v2 组件库展示</strong></a>
</p>

---

故事创作的静谧之所。人类创意与人工智能在此和谐协作——策划、写作、评审、修订，各司其职，如同一个安静运转的专业创作团队。

<br />

<div align="center">

<table>
<tr>
<td align="center" width="25%">

**策划编辑**

设定世界观、人物、分章大纲与剧情路标

</td>
<td align="center" width="25%">

**专职作家**

流畅生成完整章节内容

</td>
<td align="center" width="25%">

**质量评审**

多维度结构化诊断与打分

</td>
<td align="center" width="25%">

**修订专家**

精准定位问题，局部智能修复

</td>
</tr>
</table>

</div>

<br />

---

~ • ~

---

<br />

## 核心特性

<br />

<table>
<tr>
<td width="33%" valign="top">

### 连贯创作记忆

NovelState 动态状态追踪系统，自动记录角色、时间线、伏笔和文风变化。向量语义检索，智能关联前文内容，永不遗忘人物设定与剧情线索。

</td>
<td width="33%" valign="top">

### 人机共创模式

支持策划方案和章节级确认机制。你掌控创作方向，AI 负责执行。不满意可以提出修改意见，系统按反馈定向优化，而非推倒重来。

</td>
<td width="33%" valign="top">

### 结构化质量闭环

Critic v2 多维度评审，问题定位到 scene/span 粒度。局部修复只替换目标片段，Stitching Pass 保证过渡、指代、情绪和语气的连贯性。

</td>
</tr>
</table>

<br />

<table>
<tr>
<td align="center" width="20%">
质量分析面板
</td>
<td align="center" width="20%">
三格式导出
</td>
<td align="center" width="20%">
只读分享链接
</td>
<td align="center" width="20%">
章节版本历史
</td>
<td align="center" width="20%">
协作者支持
</td>
</tr>
</table>

<br />

---

~ • ~

---

<br />

## 系统架构

<br />

```mermaid
flowchart TB
    subgraph Frontend["前端层"]
        direction LR
        A[项目指挥中心]
        B[写作工作台]
        C[沉浸式阅读]
        D[质量分析]
        E[章节管理]
    end

    subgraph Backend["服务层"]
        direction LR
        F[RESTful API]
        G[工作流服务]
        H[评审同步]
        I[导出服务]
    end

    subgraph Core["编排核心"]
        direction LR
        J[主编排器]
        K[动态状态管理]
        L[世界观追踪]
        M[标准化评审基座]
        N[零 Token 格式检查]
    end

    subgraph Agents["多智能体协作层"]
        direction LR
        O[Planner]
        P[Context Assembler]
        Q[Writer]
        R[Critic v2]
        S[Failure Router]
        T[Revise]
        U[Stitching Pass]
    end

    subgraph Persistence["持久化层"]
        direction LR
        V[(PostgreSQL)]
        W[ChromaDB 向量检索]
        X[Redis 任务队列]
        Y[文件系统 工件导出]
    end

    User((用户)) --> Frontend
    Frontend --> Backend
    Backend --> Core
    Core --> Agents
    Agents --> Core
    Core --> Persistence
    Persistence --> Core
```

<br />

### 项目结构

```
storyforge-ai/
├── frontend/
│   ├── src/pages/
│   │   ├── ProjectOverview
│   │   ├── Editor
│   │   ├── Reader
│   │   └── QualityDashboard
│   └── src/components/
│
├── backend/
│   ├── api/
│   ├── models.py
│   └── workflow_service.py
│
├── core/
│   ├── orchestrator.py
│   ├── evaluation_harness.py
│   ├── novel_state_service.py
│   ├── workflow_optimization.py
│   └── system_guardrails.py
│
├── agents/
│   ├── planner_agent.py
│   ├── writer_agent.py
│   ├── critic_agent.py
│   └── revise_agent.py
│
├── tasks/
│   ├── writing_tasks.py
│   └── export_tasks.py
│
└── utils/
    ├── volc_engine.py
    └── vector_db.py
```

<br />

---

~ • ~

---

<br />

## 创作工作流

<br />

```mermaid
flowchart TD
    Start([用户提交需求]) --> Planner

    Planner[生成设定圣经与 scene anchors] --> |存入向量库| Loop

    subgraph Loop[逐章生成循环]
        direction TB
        Context[装配章节上下文]
        Writer[连续生成整章]
        Guardrails[零 Token 格式检查]
        Critic[多维度结构化评审]

        Context --> Writer
        Writer --> Guardrails
        Guardrails --> Critic
    end

    Critic --> Pass{通过质量门槛?}

    Pass -->|是| Next[保存章节 更新状态 记录工件]
    Pass -->|否| Failure[诊断问题类型]

    Failure -->|局部问题| Revise[局部片段修复]
    Failure -->|连贯问题| Stitch[过渡/指代/情绪修复]
    Failure -->|严重问题| Rewrite[整章轻量重写]

    Revise --> Guardrails
    Stitch --> Guardrails
    Rewrite --> Guardrails

    Next --> More{还有章节?}
    More -->|是| Context
    More -->|否| Done([创作完成 可导出分享])
```

<br />

### 工作流 v2 原则

章节为最终叙事单位，不拆成互不连贯的小作文。Scene/span 只用于规划、诊断、定位和局部修复。局部修复必须携带前后邻接段，修后经 stitching 检查。连续两轮局部修复失败时，才升级为整章重写。

<br />

### 核心工件类型

| 工件 | 作用 |
|------|------|
| scene_anchor_plan | 本章剧情路标、冲突、角色动机、状态变化、结尾钩子 |
| chapter_critique_v2 | Critic v2 结构化诊断，含问题维度、证据、严重度、修复指令 |
| repair_trace | 局部修复批次、修复策略、替换范围、收益记录 |
| stitching_report | 过渡、代词、时间、情绪、语气连贯性检查结果 |
| novel_state_snapshot | 章节写前/写后的动态状态快照 |

<br />

---

~ • ~

---

<br />

## 快速开始

<br />

### 前置要求

| 依赖 | 版本要求 |
|------|---------|
| Python | ≥ 3.10 |
| Node.js | ≥ 16 |
| PostgreSQL | ≥ 12 |
| Redis | ≥ 6 |

<br />

### 一、环境安装 (macOS)

```bash
brew install postgresql@14 redis
brew services start postgresql
brew services start redis
```

<br />

### 二、依赖安装

```bash
conda create -n storyforge python=3.10
conda activate storyforge

pip install -r requirements.txt

cd frontend && npm install && cd ..
```

<br />

### 三、环境配置

编辑 `.env` 文件：

```env
WRITER_API_KEY=your-volcano-engine-api-key-here

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/storyforge

CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

<br />

### 四、数据库初始化

```bash
createdb storyforge
alembic upgrade head
```

<br />

### 五、启动所有服务

需要三个终端窗口，都激活虚拟环境。

| 终端 | 服务 | 启动命令 |
|------|------|----------|
| 1 | FastAPI 后端 | `uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000` |
| 2 | Celery Worker | `celery -A celery_app worker --loglevel=info` |
| 3 | Vite 前端 | `cd frontend && npm run dev` |

<br />

访问 `http://localhost:5173`，注册账号，开始创作。

<br />

---

~ • ~

---

<br />

## 智能体团队

<br />

| 角色 | 职责 |
|------|------|
| **Planner** | 生成小说整体策划、设定圣经、分章大纲、scene anchors |
| **Context Assembler** | 汇总章节目标、scene anchors、前文、设定、风格和 NovelState |
| **Writer** | 连续生成完整章节，按 scene anchors 推进但不拆段独立生成 |
| **Critic v2** | 多维度章节评审、打分、输出定位到 scene/span 的结构化问题清单 |
| **Failure Router** | 根据问题类型选择局部修复、stitching 或整章轻量重写 |
| **Revise** | 根据 Critic 或用户反馈，执行局部片段精准修复 |
| **Stitching Pass** | 修复过渡、指代、时间跳跃、情绪断裂和语气不一致 |
| **Evaluation Harness** | 标准化 Critic 输出，沉淀可追踪评审报告 |
| **NovelState / Worldview Manager** | 追踪角色、时间线、伏笔、文风和世界观动态事实 |

<br />

---

~ • ~

---

<br />

## 项目状态

审计日期：2026-04-24

<br />

| 维度 | 评分 | 说明 |
|------|------|------|
| 核心业务逻辑 | 9/10 | 完整、可运行、架构设计优秀 |
| 代码质量 | 7/10 | 存在少量重复，个别文件过大 |
| 测试覆盖 | 6/10 | 新功能有测试，核心流程待加强 |
| 架构前瞻性 | 9/10 | 数据模型超前，为扩展预留空间 |
| **总体健康度** | **7.8/10** | 优秀的 AI 写作产品原型 |

<br />

完整审计报告详见 `docs/project-health-audit-2026-04-24.md`

<br />

---

~ • ~

---

<br />

## 许可证

MIT License - 可自由使用、修改、分发。

<br />

---

基于多智能体协作架构思想，使用火山引擎 Doubao 模型提供 AI 生成能力。

<br />
<br />
