# Task 1: 核心模块解耦与配置管理

## 一、任务目标

将当前 `main.py` 中高度耦合的流水线代码重构为**可复用、可扩展、可测试**的核心模块。这是后续所有产品化工作的地基。

**核心产出**：
1. `core/orchestrator.py` —— 小说生成流程的编排器类
2. `core/agent_pool.py` —— Agent 实例池，解决重复初始化问题
3. `core/config.py` —— 基于 Pydantic Settings 的统一配置中心
4. 保持命令行入口 `python -m core.orchestrator` 可用，验证重构未破坏原有功能

## 二、重构原则（必须遵守）

1. **单向依赖**：`orchestrator` → `agent_pool` → `config`。配置层不感知上层。
2. **不修改 Agent 内部逻辑**：本次只动架构层，`agents/` 目录下的类接口保持不变（除非构造函数签名需要统一）。
3. **保持向后兼容**：重构后，原有的 `main.py` 应该可以删除或用一行调用替代。
4. **配置优先级**：环境变量 > `.env` 文件 > 代码默认值。与现有习惯一致。

## 三、分步实施要点

### 3.1 统一配置中心 (core/config.py)

**要解决的问题**：当前 API 密钥散落在 `.env`、`config.py`、`os.getenv()` 中，模型名、超时等参数硬编码。

**实现要点**：
- 使用 `pydantic_settings.BaseSettings` 定义 `Settings` 类。
- 字段设计需支持：
  - `unified_api_key`：一个密钥全 Agent 共用（新手友好）
  - 各 Agent 独立密钥：`planner_api_key`、`writer_api_key` 等（高级用户分账号计费）
  - 提供方法 `get_api_key_for_agent(agent_name: str) -> str`，优先返回独立密钥，否则回退统一密钥。
- 其他配置项：`base_url`、`default_model`、`max_retries`、`request_timeout`、`chroma_persist_directory`、`critic_pass_threshold` 等。
- **注意**：配置类应设计为单例，在模块顶层实例化 `settings = Settings()`，其他模块从此导入。

### 3.2 Agent 实例池 (core/agent_pool.py)

**要解决的问题**：当前每次生成章节都重新创建 Agent 对象，导致 OpenAI 客户端重复握手，浪费连接资源。

**实现要点**：
- 设计一个 `AgentPool` 类，内部维护 `_instances: Dict[str, Any]` 字典。
- 提供 `get_agent(agent_name: str)` 方法，按名称返回单例。
- Agent 名称与类的映射建议使用显式字典，而非动态反射（避免安全问题）。
- **关键决策**：Agent 的构造函数签名需要统一。如果当前各 Agent 构造参数不一致（例如有的用 `api_key` 有的用 `client`），建议在此次重构中统一为：
  ```python
  def __init__(self, client: OpenAI, model: str):
  ```
  这意味着你需要微调各 Agent 类的 `__init__`，但改动范围可控。
- **注意**：池应当是惰性初始化的，即第一次 `get_agent` 时才创建实例。

### 3.3 编排器类 (core/orchestrator.py)

**要解决的问题**：`main.py` 中的流程以全局函数和变量形式存在，无法在多项目、多用户场景下复用。

**实现要点**：
- 创建 `NovelOrchestrator` 类，构造函数接收：
  - `project_dir: str` —— 项目根目录路径
  - `progress_callback: Optional[Callable]` —— 进度回调，用于解耦 UI 输出
- 将原 `main.py` 中的以下流程封装为类方法：
  - `run_planner()` —— 策划阶段
  - `run_guardian_bible()` —— 设定圣经生成与向量化
  - `run_chapter_generation(chapter_index: int)` —— 单章生成（含检查-修复-评审全流程）
  - `run_full_novel()` —— 串联全部章节
- **状态管理**：编排器内部应持有 `WorldviewManager`、`VectorDB` 等实例，避免在每个方法中重复创建。
- **进度上报**：每进入一个新阶段，调用 `self._report_progress(step, percentage, message)`，内部通过回调传出。
- **错误处理**：生成失败应抛出明确异常，而非静默退出。由上层（CLI 或 API）决定如何处理。

## 四、目录结构变化

重构后 `core/` 目录结构预期如下：

```
core/
├── __init__.py
├── config.py           # 新增：Pydantic Settings 配置中心
├── agent_pool.py       # 新增：Agent 单例池
├── orchestrator.py     # 新增：主编排器
└── worldview_manager.py # 已有，可能需要微调导入路径
```

原有的 `main.py` 可改为：

```python
# main.py (简化后的命令行入口)
import sys
from core.orchestrator import NovelOrchestrator

if __name__ == "__main__":
    project_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    orchestrator = NovelOrchestrator(project_dir)
    orchestrator.run_full_novel()
```

## 五、注意事项与风险提示

1. **Agent 构造函数统一风险**：
   - 如果 `agents/` 下的类构造参数差异较大，不要强行统一。可以在 `AgentPool` 中通过 `agent_name` 判断，采用不同的实例化逻辑。但建议长远来看统一接口。

2. **向量数据库初始化位置**：
   - `VectorDB` 的持久化目录应与项目绑定。建议在 `Orchestrator` 构造函数中初始化，路径为 `{project_dir}/data/chroma`。

3. **YAML 与 JSON 混用**：
   - 项目目前同时存在 `config.yaml`、`project_info.json` 等。重构时不必强行统一格式，保持原样读取即可。

4. **全局状态隔离**：
   - 确保新的 `Orchestrator` 是无副作用的单次运行实例。不要使用全局变量保存项目状态。

5. **测试验证**：
   - 重构完成后，必须使用一个已有项目目录（或新建测试项目）运行 `run_full_novel()`，验证能完整生成小说且质量评分正常。

## 六、验收标准

- [ ] `from core.config import settings` 可正常导入，且能读取 `.env` 中的 `WRITER_API_KEY`。
- [ ] 连续两次调用 `AgentPool.get_agent("writer")` 返回同一对象实例。
- [ ] 执行 `python -m core.orchestrator /path/to/project` 可完整生成小说，无报错。
- [ ] 原有 `main.py` 的功能完全被 `core.orchestrator` 替代，且输出内容一致。
- [ ] 各 Agent 的 API 密钥获取逻辑正确：独立密钥优先，否则回退统一密钥。

## 七、后续依赖

完成本任务后，Task 2（引入 Celery 任务队列）将依赖 `NovelOrchestrator` 作为任务执行体。因此请确保 `Orchestrator` 的接口设计清晰，尤其 `progress_callback` 回调机制要稳定。