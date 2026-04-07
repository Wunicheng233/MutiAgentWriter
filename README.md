# 📖 Writer - 多Agent AI小说自动创作系统

这是一个闲人做的**全自动多Agent协同小说创作系统**，从策划到生产全流程自动化。所有代码几乎全部依赖AI。

## ✨ 功能特点

- 🤖 **多Agent分工协作** - 策划/设定/写作/校验/润色/终审全流程专业化分工
- ⚡ **并行检查加速** - 设定/质量/合规三项检查并行执行，节省约一半时间
- 🔧 **统一问题修复** - 一轮多个问题一次性修复，减少LLM调用次数
- 🌍 **世界观一致性保障** - 专门的Worldview Manager追踪时间线/角色/伏笔，杜绝人设崩塌时间混乱
- 🔍 **向量语义检索** - ChromaDB存储相关历史内容，保证剧情连贯性
- ✅ **多级质量控制** - 硬伤检查 → 统一修复 → 润色 → 对抗性终审，多重质量保证
- 📱 **移动端友好阅读** - 自动短段落排版，适配手机阅读
- 📦 **一键静态导出** - 导出静态网站，支持GitHub Pages部署

## 🏗️ 架构说明

```
writer/
├── agents/                 # 各专业Agent
│   ├── planner_agent.py    # 小说策划
│   ├── guardian_agent.py   # 设定一致性校验
│   ├── writer_agent.py     # 章节生成
│   ├── editor_agent.py     # 文笔润色
│   ├── compliance_agent.py # 合规检查
│   ├── quality_agent.py   # 质量格式检查
│   ├── critic_agent.py     # 终审对抗性评审
│   └── fix_agent.py       # 统一问题修复 (新增)
├── core/
│   └── worldview_manager.py # 世界观状态管理
├── prompts/               # 各Agent提示词模板
├── utils/                 # 工具函数
│   ├── volc_engine.py     # 火山引擎API客户端 (连接复用优化)
│   ├── vector_db.py       # ChromaDB向量检索
│   └── ...
├── templates/             # Flask Web阅读器模板
├── main.py                # 主入口，小说生成流程
├── app.py                 # Web阅读服务器
├── export_static.py       # 静态网站导出
├── config.py              # 配置文件 (API Key从环境变量读取)
└── user_requirements.yaml # 用户需求配置
```

## 🚀 快速开始

### 1. 环境安装

```bash
git clone https://github.com/your-username/writer.git
cd writer

# 创建虚拟环境
conda create -n novel_agent python=3.10
conda activate novel_agent

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置API Key

每个Agent使用独立的API Key接入火山引擎，设置环境变量：

```bash
# 在终端设置环境变量 (Linux/macOS)
export WRITER_API_KEY_PLANNER=your-api-key-here
export WRITER_API_KEY_GUARDIAN=your-api-key-here
export WRITER_API_KEY_WRITER=your-api-key-here
export WRITER_API_KEY_EDITOR=your-api-key-here
export WRITER_API_KEY_COMPLIANCE=your-api-key-here
export WRITER_API_KEY_QUALITY=your-api-key-here
export WRITER_API_KEY_CRITIC=your-api-key-here
export WRITER_API_KEY_FIX=your-api-key-here
```

> 你也可以创建 `.env` 文件存放这些环境变量，使用 `source .env` 加载。

### 3. 配置小说需求

编辑 `user_requirements.yaml`：

```yaml
novel_name: "我的小说"
novel_description: "..."
core_requirement: "..."
target_platform: "番茄小说"
chapter_word_count: 2000
start_chapter: 1
end_chapter: 10
skip_plan_confirmation: false
skip_chapter_confirmation: false
allow_plot_adjustment: false
auto_export_static: false
```

### 4. 开始生成

```bash
python main.py
```

按照提示确认策划方案，系统会自动生成所有章节。

### 5. 阅读生成的小说

```bash
# 启动Web阅读器
./start_server.sh
# 访问 http://localhost:5000 阅读
```

### 6. 导出静态网站 (可选)

```bash
python export_static.py
# 自动推送到GitHub Pages (配置好git远程后)
```

## 📊 工作流程

```
用户需求加载
    ↓
策划 → 生成设定圣经 → 存入向量数据库
    ↓
对每一章：
    1. writer生成初稿
    ↓
    2. 【并行同时】guardian设定检查 + quality硬伤检查 + compliance合规检查
    ↓
    3. 全部通过 → 下一步
       有问题 → 汇总所有问题 → fix agent一次性修复 → 最多重试4轮
    ↓
    4. editor文笔润色
    ↓
    5. critic终审挑刺 → 有问题 → optimize修复 → 最多重试3轮
    ↓
    6. 生成标题 → 保存 → 更新世界观状态
    ↓
所有章节完成 → 可选：导出静态网站
```

## 🔧 配置参数

所有可配置参数都在 `config.py`：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `MAX_FIX_RETRIES` | 初稿修复最多重试轮数 | 4 |
| `MAX_PARALLEL_CHECKS` | 并行检查最大线程数 | 3 |
| `WORD_COUNT_DEVIATION_ALLOWED` | 允许字数偏差比例 | 0.15 |
| `LONG_PARAGRAPH_THRESHOLD` | 长段落判断阈值（字符） | 300 |
| `AI_CLICHE_REPEAT_THRESHOLD` | AI套话多少次算重复 | 2 |
| `VECTOR_CHUNK_SIZE` | 向量数据库分块大小 | 500 |
| `CRITIC_PASS_SCORE` | Critic及格线 | 8 |

## 📝 工作原理

### Agent职责分工

| Agent | 职责 |
|-------|------|
| Planner | 生成小说整体策划大纲 |
| Guardian | 生成设定圣经，检查设定一致性 |
| Writer | 生成章节初稿，重写设定错误 |
| Quality | 检查字数/标题/格式硬伤 |
| Compliance | 内容合规检查 |
| Fix | **统一修复所有问题**，一轮多个问题一次性修复 |
| Editor | 文笔润色，去除AI刻板味 |
| Critic | 终审挑刺打分，发现软问题 |
| Worldview Manager | 追踪时间线/角色/伏笔，保证全局一致性 |

## 🚀 部署到GitHub Pages

1. 在GitHub创建仓库
2. 本地添加远程：
   ```bash
   git remote add origin https://github.com/你的用户名/writer.git
   ```
3. 添加并提交：
   ```bash
   git add .
   git commit -m "Initial commit: Multi-agent AI novel writing system"
   git push -u origin main
   ```

> ⚠️ 注意：`config.py` 已经不再包含硬编码API Key，可以安全提交。`.gitignore` 已经配置好忽略 `outputs/`, `vector_db/`, `logs/` 等目录。

## 📄 许可证

MIT License

## 🙏 致谢

基于多Agent协作架构思想，使用火山引擎Doubao模型提供强大的AI生成能力。
