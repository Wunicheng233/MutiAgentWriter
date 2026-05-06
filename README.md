# StoryForge AI

多智能体协作小说创作系统

<p align="center">
  <a href="https://htmlpreview.github.io/?https://github.com/Wunicheng233/MultiAgentWriter/blob/main/docs/StoryForge-Showcase.html"><strong>→ 查看交互式展示页</strong></a>
  &nbsp;|&nbsp;
  <a href="https://htmlpreview.github.io/?https://github.com/Wunicheng233/MultiAgentWriter/blob/main/docs/Components-Showcase.html"><strong> v2 组件库展示</strong></a>
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

## 创新亮点

StoryForge AI 致力于解决的问题：**传统 AI 写作工具只能生成片段，无法驾驭长篇叙事的连贯性和质量**。

<br />

<table>
<tr>
<td width="50%" valign="top">

###  多智能体编排，而非单次问答

四个专职 Agent（Planner → Writer → Critic → Revise）按流程协作，各自使用独立优化的提示词和模型参数。Critic 发现的问题由 Revise 精准修复，而非丢回 Writer 重头生成。一次生成 = 一次完整的 PDCA 循环。

</td>
<td width="50%" valign="top">

###  结构化质量闭环，而非模糊修改

Critic v2 将质量问题定位到 scene/span 粒度，Failure Router 自动选择最优修复策略（局部替换 / 过渡缝补 / 整章重写）。连续两轮局部修复失败才升级为整章重写——用最小的修改代价达到质量标准。

</td>
</tr>
<tr>
<td width="50%" valign="top">

###  Hermes 自我进化系统

每次章节生成后，系统自动从 Critic 低分、Guardian 违规、用户反馈中**提炼经验 → 蒸馏技能 → 注册到技能库**。下次写作时，SkillAssembler 根据当前章节上下文（角色、剧情阶段）动态检索并注入最相关的技能。系统越用越懂你的写作风格。

</td>
<td width="50%" valign="top">

###  动态叙事状态管理

NovelState 持续追踪角色状态、时间线、伏笔、世界观变迁，而非只在 prompt 里塞设定。Pre-write Context 为 Writer 提供写前快照，State Validator 在零 token 消耗下拦截硬错误，保证每章生成不偏离已建立的叙事逻辑。

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

### 架构分层概述

StoryForge AI 的架构分为四个层次，每层各司其职：

| 层次 | 职责 | 关键组件 |
|------|------|---------|
| **前端层** | 用户交互与创作管理 | 项目指挥中心、写作工作台、沉浸式阅读、质量分析面板、章节管理 |
| **服务层** | API 网关与任务调度 | RESTful API、工作流服务、异步任务队列（Celery/Redis） |
| **编排核心** | 多 Agent 编排与状态管理 | NovelOrchestrator、NovelStateService、EvaluationHarness、SystemGuardrails |
| **多智能体层** | AI 写作协作流水线 | Planner / Writer / Critic v2 / Revise / Stitching Pass / SkillAssembler |
| **持久化层** | 数据与知识存储 | PostgreSQL（业务数据）、ChromaDB（向量检索）、文件系统（章节工件） |

<br />

### 画图建议

如需绘制架构图用于方案汇报或产品文档，建议分层如下：

```
┌─────────────────────────────────────────────┐
│               用户界面 (Web)                   │
│  项目管理  │  编辑器  │  阅读器  │  质量面板    │
├─────────────────────────────────────────────┤
│             RESTful API + WebSocket           │
├─────────────────────────────────────────────┤
│              NovelOrchestrator                │
│  ┌──────┐  ┌───────┐  ┌──────────────────┐  │
│  │Planner│→│ Writer│→│ Critic → Revise   │  │
│  └──────┘  └───────┘  └──────────────────┘  │
│       ↕ NovelState ↔ ChromaDB                │
├─────────────────────────────────────────────┤
│  PostgreSQL  │  Redis  │  ChromaDB  │ 文件系统 │
└─────────────────────────────────────────────┘
```

核心交互流程为：**用户通过前端发起创作 → Orchestrator 编排 Agent 流水线 → 各 Agent 通过 ChromaDB 共享上下文 → NovelState 保证叙事连贯性 → 结果持久化并返回前端**。

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

## 自我进化系统（Hermes Learning Loop）

StoryForge AI 的独特之处在于**系统能通过分析自身生成结果的质量，自动提炼写作经验并注册为可复用的技能**，形成"生成 → 评估 → 提炼 → 提升"的学习闭环。

<br />

```mermaid
flowchart LR
    A[章节生成完成] --> B[Trace Aggregator<br/>聚合执行轨迹]
    B --> C[Feedback Collector<br/>收集 Critic/Guardian/用户反馈]
    C --> D{存在明显问题?}
    D -->|是| E[Experience Extractor<br/>LLM 分析根因]
    D -->|否| END[无需学习]
    E --> F[Skill Distiller<br/>转为结构化技能]
    F --> G{置信度 ≥ 0.5?}
    G -->|是| H[Skill Registry<br/>注册到技能库]
    G -->|否| I[标记为 Draft<br/>需人工审核]
    H --> J[ChromaDB 向量索引]
    J --> K[下次写作时<br/>SkillAssembler 动态检索注入]
```

<br />

### 学习流程

| 阶段 | 组件 | 产出 |
|------|------|------|
| **信号采集** | TraceAggregator + FeedbackCollector | 标准化 FeedbackSignal（来源：Critic 低分 / Guardian 违规 / 用户修改） |
| **经验提取** | Experience Extractor（LLM 驱动） | WritingExperience：问题类型 + 根因分析 + 改进建议 + 原文证据 |
| **技能蒸馏** | Skill Distiller | Structured Skill（character_style / writing_style / plot_helper / user_preference） |
| **动态注册** | SkillRegistry + ChromaDB | Auto-generated SKILL.md，按角色和剧情阶段索引 |
| **上下文检索** | SkillAssembler + ChapterContext | 根据当前章节涉及的角色和剧情阶段，排序注入最相关的技能 |

<br />

### 置信度自动分级

| 置信度 | 处理策略 |
|--------|---------|
| 0.8+ | 自动注册，strength=0.7，直接生效 |
| 0.5 - 0.8 | 自动注册，strength=0.3，低强度试用 |
| < 0.5 | 标记为 draft，需人工审核后启用 |

随着生成章节增多，技能库持续积累，系统对故事风格的理解越来越精准。

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
