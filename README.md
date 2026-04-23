# 📖 Writer - 多Agent AI小说自动创作系统

这是一个**全自动多Agent协同小说创作系统**，从策划到生产全流程自动化。所有代码几乎全部依赖AI。

> **部署说明**: 本项目采用前后端分离架构，需要后端提供API服务。
> 
> 如果你只是想体验UI，前端可以编译为静态文件部署到 GitHub Pages / Vercel 等免费托管服务。完整功能需要后端配合。
> 
> 比赛展示可以参考下方「免费部署方案」将前后端都部署到免费平台，评委可以直接在线体验。

## ✨ 功能特点

- 🤖 **多Agent分工协作** - 策划/设定/写作/校验/润色/终审全流程专业化分工
- ⚡ **并行检查加速** - 设定/质量/合规三项检查并行执行，节省约一半时间
- 🔧 **统一问题修复** - 一轮多个问题一次性修复，减少LLM调用次数
- 🌍 **世界观一致性保障** - 专门的Worldview Manager追踪时间线/角色/伏笔，杜绝人设崩塌时间混乱
- 🔍 **向量语义检索** - ChromaDB存储相关历史内容，保证剧情连贯性
- ✅ **多级质量控制** - 硬伤检查 → 统一修复 → 润色 → 对抗性终审，多重质量保证
- 📱 **移动端友好阅读** - 自动短段落排版，适配手机阅读
- 📦 **多格式导出** - 支持 EPUB / DOCX / HTML 三种格式导出
- 📜 **章节版本历史** - 每次保存自动创建版本，支持一键回滚
- 🧮 **Token用量统计** - 自动统计每个项目的Token消耗和预估成本
- 🔗 **只读分享链接** - 创建公开分享链接，无需登录即可阅读
- 👥 **项目协作** - 支持添加协作者，共同浏览项目
- 🤝 **可选人机交互确认** - 支持策划方案确认和每章生成确认，你可以掌控创作方向

## 🏗️ 系统架构

重构后采用**前后端分离 + 异步任务队列**架构：

```
writer/
├── backend/                # FastAPI 后端 RESTful API
│   ├── api/                # API 端点（认证/项目/章节/任务/分享）
│   └── models.py           # SQLAlchemy ORM 数据模型
├── frontend/               # React + TypeScript 前端
│   └── src/
│       ├── pages/          # 页面组件（登录/项目列表/编辑器/分析等）
│       └── utils/          # API 封装和工具
├── agents/                 # 各专业 Agent
│   ├── planner_agent.py    # 小说策划
│   ├── guardian_agent.py   # 设定一致性校验
│   ├── writer_agent.py     # 章节生成
│   ├── editor_agent.py     # 文笔润色
│   ├── compliance_agent.py # 合规检查
│   ├── quality_agent.py   # 质量格式检查
│   ├── critic_agent.py     # 终审对抗性评审
│   └── fix_agent.py       # 统一问题修复
├── core/
│   ├── config.py           # 配置中心（pydantic-settings）
│   ├── orchestrator.py     # 主编排器
│   └── worldview_manager.py # 世界观状态管理
├── tasks/                  # Celery 异步任务
│   ├── writing_tasks.py    # 小说生成任务
│   └── export_tasks.py     # 导出任务
├── services/               # 业务服务层
│   └── export_service.py   # 多格式导出服务
├── prompts/                # 各 Agent 提示词模板
├── utils/                  # 工具函数
│   ├── volc_engine.py      # 火山引擎 API 客户端（自动记录 Token）
│   └── vector_db.py        # ChromaDB 向量检索
├── alembic/                # 数据库迁移
├── main.py                 # CLI 入口（也可直接生成）
├── requirements.txt        # Python 依赖
└── TESTING.md              # 完整测试计划
```

## 🚀 快速开始

### 1. 环境准备

需要预先安装：
- Python 3.10+
- Node.js 16+
- PostgreSQL 12+
- Redis

**在 macOS 上安装（Homebrew）：**
```bash
# 安装 PostgreSQL
brew install postgresql@14
brew services start postgresql

# 安装 Redis
brew install redis
brew services start redis
```

**在 Ubuntu/Debian 上安装：**
```bash
# 安装 PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib redis-server
sudo systemctl start postgresql
sudo systemctl start redis
```

**在 Windows 上：**
- 下载安装 [PostgreSQL](https://www.postgresql.org/download/windows/)
- 下载安装 [Redis](https://github.com/microsoftarchive/redis/releases) 或使用 WSL2 安装
- 推荐使用 WSL2 运行，体验更好

**不限制平台：** 理论上支持 macOS / Linux / Windows（WSL2），只要能运行 Python/Node.js/PostgreSQL/Redis 即可。

### 2. 安装依赖

```bash
# 创建虚拟环境
conda create -n novel_agent python=3.10
conda activate novel_agent

# 安装 Python 依赖
pip install -r requirements.txt

# 安装前端依赖
cd frontend
npm install
cd ..
```

### 3. 配置环境变量

编辑 `.env` 文件：
```env
# ========== API Key（必需）==========
WRITER_API_KEY=your-volcano-engine-api-key-here

# ========== 数据库（默认本地开发可不用改）==========
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mutiagent_writer

# ========== Redis（默认本地开发可不用改）==========
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### 4. 初始化数据库

```bash
# 创建数据库
createdb mutiagent_writer

# 运行迁移建表
alembic upgrade head
```

### 5. 启动所有服务

**❗ 重要：需要同时打开 3 个终端窗口，都激活你的 Python 虚拟环境：**

| 终端 | 作用 | 启动命令 |
|------|------|----------|
| **终端 1** | FastAPI 后端服务（处理HTTP请求） | ```bash\nconda activate novel_agent\ncd /path/to/writer\nuvicorn backend.main:app --reload --host 0.0.0.0 --port 8000\n``` |
| **终端 2** | Celery Worker（异步处理AI生成任务） | ```bash\nconda activate novel_agent\ncd /path/to/writer\ncelery -A celery_app worker --loglevel=info\n``` |
| **终端 3** | Vite 前端开发服务器 | ```bash\nconda activate novel_agent\ncd /path/to/writer/frontend\nnpm run dev\n``` |

**为什么需要 3 个终端？**
- FastAPI 负责处理网页 API 请求
- Celery Worker 负责在后台运行耗时的AI生成任务，不会阻塞网页响应
- Vite 提供前端热重载开发服务

三者都必须运行，系统才能正常工作！

### 6. 使用系统

打开浏览器访问：`http://localhost:5173`

1. 注册新用户账号
2. 在设置页面填入你的火山引擎 API Key
3. 登录后点击"创建新项目"
4. 填写小说需求：
   - **跳过策划确认**: 开启后自动通过策划方案，不需要人工确认
   - **跳过章节确认**: 开启后自动生成所有章节，不需要逐章确认
   - *如果两个都关闭*，系统会在生成完策划方案后停下来，等待你审阅确认，确认通过后才会开始生成正文
5. 点击"开始生成"，生成在后台异步运行
6. 刷新页面查看进度，当等待你确认时，会弹出确认对话框：
   - 可以预览策划方案或已生成章节（Markdown 自动渲染，包括表格）
   - 选择"通过，继续生成" → 系统继续生成下一步
   - 填写修改意见后选择"不通过，按修改意见重新优化" → AI 根据你的反馈重新修改
7. 全部生成完成后可以：
   - 阅读/编辑章节
   - 查看质量分析（总体评分、雷达图、章节评分趋势）
   - 导出 EPUB/DOCX/HTML
   - 创建分享链接
   - 添加协作者

---

## 📊 工作流程

```
用户需求加载
    ↓
策划 → 生成设定圣经 → 存入向量数据库
    ↓
对每一章：
  1. writer 生成初稿
  ↓
  2. 【并行同时】guardian 设定检查 + quality 硬伤检查 + compliance 合规检查
  ↓
  3. 全部通过 → 下一步
     有问题 → 汇总所有问题 → fix agent 一次性修复 → 最多重试 4 轮
  ↓
  4. editor 文笔润色
  ↓
  5. critic 终审挑刺 → 有问题 → optimize 修复 → 最多重试 3 轮
  ↓
  6. 生成标题 → 保存 → 更新世界观状态
  ↓
所有章节完成 → 可导出多种格式
```

---

## 🎯 新功能详解

### 1. 多格式导出
- **EPUB**: 可用于电子书阅读器
- **DOCX**: 可用于 Word/Pages 编辑
- **HTML**: 静态网页打包，适合分享

### 2. 章节版本历史
- 每次保存章节自动创建新版本
- 保留最近 10 个版本
- 在编辑器侧边栏可查看历史、预览、恢复任何版本

### 3. Token 使用量统计
- 每次 LLM 调用自动记录 Token 消耗
- 项目概览显示总 Token 和预估美元成本
- 设置页面显示用户月度统计

### 4. 只读分享链接
- 项目所有者可创建公开分享链接
- 任何人打开链接都可以阅读，无需登录
- 纯只读，无法编辑

### 5. 项目协作
- 项目所有者可以通过用户名添加协作者
- 协作者有只读权限，可以查看项目和章节
- 随时可以移除协作者

### 6. 人机交互确认模式（开发中）

> ⚠️ **当前状态**: 功能正在完善中，可能存在交互问题。稳定使用建议勾选"跳过策划确认"和"跳过章节确认"开启全自动模式。

开启方式：创建项目时关闭"跳过策划确认"和"跳过章节确认"

计划工作流程：
1. AI 生成完策划方案 → 弹出确认对话框 → 你预览 → 确认通过 / 修改后重新生成
2. AI 生成完每一章 → 弹出确认对话框 → 你预览 → 确认通过 / 修改后重新优化
3. 完全掌控创作方向，不满意可以随时调整

适合：
- 对小说要求高，想要亲自把关每一步
- 初次创作，不确定方向，需要逐步调整
- 重要作品，不想完全全自动

全自动模式（推荐稳定使用）：创建项目时勾选"跳过策划确认"和"跳过章节确认"，系统会全自动生成所有章节。

---

## 🔧 配置参数

所有可配置参数都在 `core/config.py`：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `MAX_FIX_RETRIES` | 初稿修复最多重试轮数 | 4 |
| `MAX_PARALLEL_CHECKS` | 并行检查最大线程数 | 3 |
| `WORD_COUNT_DEVIATION_ALLOWED` | 允许字数偏差比例 | 0.15 |
| `LONG_PARAGRAPH_THRESHOLD` | 长段落判断阈值（字符） | 300 |
| `AI_CLICHE_REPEAT_THRESHOLD` | AI 套话多少次算重复 | 2 |
| `VECTOR_CHUNK_SIZE` | 向量数据库分块大小 | 500 |
| `CRITIC_PASS_SCORE` | Critic 及格线 | 8 |

---

## 🧑‍💼 Agent 职责分工

| Agent | 职责 |
|-------|------|
| Planner | 生成小说整体策划大纲 |
| Guardian | 生成设定圣经，检查设定一致性 |
| Writer | 生成章节初稿，重写设定错误 |
| Quality | 检查字数/标题/格式硬伤 |
| Compliance | 内容合规检查 |
| Fix | **统一修复所有问题**，一轮多个问题一次性修复 |
| Editor | 文笔润色，去除 AI 刻板味 |
| Critic | 终审挑刺打分，发现软问题 |
| Worldview Manager | 追踪时间线/角色/伏笔，保证全局一致性 |

---

## 📝 说明

- 所有 Agent 的 API Key 都使用火山引擎方舟平台
- 默认配置使用统一 API Key，简单方便
- 需要自己准备火山引擎账号和 API Key

## 📄 许可证

MIT License

## 🙏 致谢

基于多 Agent 协作架构思想，使用火山引擎 Doubao 模型提供强大的 AI 生成能力。
