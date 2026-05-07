# StoryForge AI

多智能体协作小说创作系统。StoryForge AI 不是一次性生成一段文字，而是把 Planner、Writer、Critic、Revise、Skill 注入层和人工确认组织成一间可持续工作的 AI 写作工作室。

> Vibe Coding? Vibe Writing!
> 更高效，更沉浸，更有灵魂。

<p align="center">
  <a href="docs/demo/storyforge-demo.mp4">
    <img src="docs/demo/storyforge-demo-still.png" alt="StoryForge AI Demo" width="900" />
  </a>
</p>

<p align="center">
  <a href="docs/demo/storyforge-demo.mp4"><strong>观看完整 Demo 视频</strong></a>
  &nbsp;|&nbsp;
  <a href="docs/productization-roadmap.md"><strong>产品化路线</strong></a>
  &nbsp;|&nbsp;
  <a href="tools/demo-video/README.md"><strong>Demo 视频工程</strong></a>
</p>

## Demo 片段

| 创建 Brief 与 Skill | 多智能体工作流 | AI 选区润色与版本 |
|---|---|---|
| ![创建 Brief 与 Skill](docs/demo/storyforge-create.gif) | ![多智能体工作流](docs/demo/storyforge-workflow.gif) | ![AI 选区润色与版本](docs/demo/storyforge-editor.gif) |

## 解决什么问题

通用 AI 写作工具擅长短文本，但在长篇小说里容易失去设定、人物状态、章节目标和质量闭环。StoryForge AI 的目标是把“灵感输入”变成“可确认、可修改、可追踪、可导出”的完整创作流程：

- 让 AI 负责策划、写作、评审、修订等重复劳动。
- 让用户保留关键决策权，尤其是大纲确认和逐章确认。
- 用结构化质量分析、版本历史和局部润色减少返工。
- 通过作家风格 Skill 注入层，让不同项目拥有更稳定的叙事气质。
- 支持 OpenAI-compatible 多模型接口，用户可配置系统默认或自己的模型 API。

## 核心能力

| 模块 | 能力 |
|---|---|
| 项目创建 | 作品定位、内容类型、章节范围、字数目标、协作模式、作家风格 Skill 一次配置 |
| 策划确认模式 | 先生成策划方案，用户确认或反馈修改后再进入章节生成 |
| 逐章共创模式 | 每章生成后进入人工确认，确认通过才继续下一章 |
| 多智能体工作流 | Planner 产出设定与章节路标，Writer 写作，Critic 结构化评审，Revise 局部修复 |
| 字数守护 | 目标字数预算、硬阈值拦截、修订轮次后的最终达标检查 |
| Skill 注入层 | 作家风格、叙事偏好和动态技能按 Agent 阶段注入 |
| 编辑器 | 分章编辑、AI 选区润色、章节切换、历史版本对比与回滚 |
| 阅读器 | 沉浸式阅读、分页/滚动模式、字体与阅读进度 |
| 质量中心 | 总体评分、章节评分、问题定位和工作流追踪 |
| 导出分享 | EPUB、DOCX、HTML 导出，只读分享链接与访问统计 |
| 公测治理 | 用户模型设置、连接测试、生成前检查、配额、失败恢复、问题反馈上报 |

## 系统架构

```mermaid
flowchart TB
    User["创作者"] --> Frontend["React / TypeScript 前端"]
    Frontend --> API["FastAPI 服务层"]
    API --> Workflow["工作流服务 / Celery 任务"]
    Workflow --> Orchestrator["NovelOrchestrator"]

    subgraph Agents["多智能体协作层"]
        Planner["Planner"]
        Writer["Writer"]
        Critic["Critic v2"]
        Revise["Revise / Stitching"]
    end

    Orchestrator --> Planner
    Planner --> Writer
    Writer --> Critic
    Critic --> Revise
    Revise --> Critic

    Orchestrator --> Guardrails["Guardrails / 字数与结构守护"]
    Orchestrator --> SkillRuntime["SkillAssembler / 作家风格注入"]
    Orchestrator --> NovelState["NovelState / 叙事状态"]
    Orchestrator --> LLM["LLM Router / 多供应商适配"]

    API --> DB["PostgreSQL"]
    Workflow --> Redis["Redis / Celery Broker"]
    NovelState --> VectorDB["ChromaDB / 向量检索"]
    Workflow --> Files["导出与章节工件"]
```

## 创作工作流

```mermaid
flowchart TD
    Start["用户创建项目"] --> Plan["Planner 生成策划方案"]
    Plan --> ConfirmPlan{"需要策划确认?"}
    ConfirmPlan -->|是| HumanPlan["用户确认 / 提修改意见"]
    HumanPlan --> Plan
    ConfirmPlan -->|否或确认通过| Loop["进入章节循环"]

    Loop --> Context["装配章节上下文、Skill、NovelState"]
    Context --> Write["Writer 生成完整章节"]
    Write --> Guard["字数、结构、连贯性守护"]
    Guard --> Critic["Critic v2 评分与问题定位"]
    Critic --> Pass{"质量与字数达标?"}
    Pass -->|否| Repair["Revise 局部修复 / Stitching / 必要时重写"]
    Repair --> Guard
    Pass -->|是| ConfirmChapter{"需要逐章确认?"}
    ConfirmChapter -->|是| HumanChapter["用户确认 / 修改意见"]
    HumanChapter --> Repair
    ConfirmChapter -->|否或确认通过| Save["保存章节、工件、状态、评分"]
    Save --> More{"还有章节?"}
    More -->|是| Loop
    More -->|否| Done["阅读、编辑、导出、分享"]
```

## 作家风格 Skill 注入层

项目内置多位作家风格 Skill，并支持后续扩展。当前策略是：

- 创建项目时选择 Skill，而不是等到大纲页再补选。
- 限制作家风格主 Skill 数量，避免多个强风格互相污染。
- Planner / Writer / Revise 可注入风格与叙事策略，Critic 默认保持客观评审。
- Hermes-style 学习闭环可从评审失败和用户反馈中提炼经验，沉淀为后续可检索技能。

## 多模型 API

系统默认使用 OpenAI-compatible 调用方式，并在设置页暴露模型供应商配置。支持方向包括：

- 火山引擎方舟
- OpenAI
- DeepSeek
- 通义千问
- Moonshot
- 其他 OpenAI-compatible API

在设置页中填写 Provider、Base URL、模型 ID 和 API Key 后，可以先执行“测试连接”。用户自带 API 时，平台配额只做安全预检，不做系统默认 API 的硬性消耗限制。

## 项目结构

```text
writer/
├── backend/
│   ├── api/                  # FastAPI 路由
│   ├── agents/               # Planner / Writer / Critic / Revise
│   ├── core/                 # 编排、Guardrails、LLM Router、Skill Runtime
│   ├── services/             # 配额、预检、导出、业务服务
│   ├── tasks/                # Celery 异步任务
│   ├── skills/               # 作家风格与动态技能
│   └── models.py             # SQLAlchemy ORM
├── frontend/
│   └── src/
│       ├── pages/            # 书架、创建、概览、编辑器、阅读器、质量中心
│       ├── components/       # 设计系统、布局、反馈、引导、版本
│       └── utils/            # API 封装与前端工具
├── alembic/versions/         # 数据库迁移
├── tests/                    # 后端回归测试
├── docs/                     # 产品化文档和 README 演示素材
└── tools/demo-video/         # Remotion Demo 视频工程
```

## 快速开始

项目本地环境建议使用已有的 `novel_agent` conda 环境。

```bash
conda activate novel_agent
pip install -r requirements.txt

cd frontend
npm install
cd ..
```

创建 `.env`：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/multiagent_writer
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

JWT_SECRET_KEY=replace-with-a-long-random-secret
USER_API_KEY_ENCRYPTION_KEY=replace-with-a-fernet-compatible-or-random-secret

WRITER_API_KEY=your-api-key
BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3
UNIFIED_MODEL=your-model-or-endpoint-id
```

初始化数据库：

```bash
createdb multiagent_writer
conda run -n novel_agent alembic upgrade head
```

启动服务：

```bash
# 终端 1：后端
conda run -n novel_agent uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# 终端 2：异步任务
conda run -n novel_agent celery -A celery_app worker --loglevel=info

# 终端 3：前端
cd frontend
npm run dev
```

访问 `http://localhost:5173`。

## 健康检查

每次重要修改后建议运行：

```bash
conda run -n novel_agent python -m pytest tests -q

cd frontend
npm test -- --run
npm run lint
npm run build

cd ..
git diff --check
conda run -n novel_agent alembic heads
```

当前 README 中的 GIF 由 `docs/demo/storyforge-demo.mp4` 切片生成；Remotion 工程保留在 `tools/demo-video/`。

## 当前状态

项目处于复赛 Demo 后的公测产品化打磨阶段。核心创作闭环已经可运行，当前重点是：

- 提升真实生成稳定性和失败恢复体验。
- 完善多模型 API 配置、连接测试和错误提示。
- 收敛新用户引导、帮助页和问题反馈链路。
- 持续补充工作流、配额、安全和前端交互测试。

## License

MIT License.
