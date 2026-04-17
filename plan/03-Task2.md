# Task 2: 引入异步任务队列

## 一、任务目标

将小说生成流程从**同步阻塞执行**改造为**后台异步任务**，使 Web 前端可以发起生成请求后立即返回，并通过轮询或 WebSocket 获取实时进度。

**核心产出**：
1. Celery 应用配置（`celery_app.py`）
2. 一个 Celery 任务 `generate_novel_task`，内部调用 `NovelOrchestrator`
3. 进度状态存储与查询机制（Redis）
4. Flask/FastAPI 路由适配（调用任务而非直接执行编排器）

## 二、为什么需要任务队列

| 现状问题 | 改造后收益 |
|----------|------------|
| Web 请求一直挂起直到生成完成（可能数十分钟），浏览器易超时 | 请求秒级返回 `task_id`，前端异步查询进度 |
| 无法并发处理多个用户的生成请求 | Celery worker 支持多进程/多节点扩展 |
| 生成中断无法恢复 | 任务状态持久化，可查询失败原因并重试 |
| 无任务优先级控制 | 可配置队列优先级，VIP 用户优先 |

## 三、技术选型建议

- **消息代理**：Redis（轻量，项目已有依赖）
- **结果后端**：Redis（存储任务状态与进度）
- **任务队列库**：Celery（Python 生态标准）
- **并发模型**：每个 worker 同时只处理一个生成任务（避免 LLM 速率限制冲突）

## 四、分步实施要点

### 4.1 Celery 应用初始化

**文件**：`celery_app.py`（项目根目录）

**要点**：
- 配置 `broker_url` 和 `result_backend` 指向 Redis。
- 设置 `task_track_started = True`，使任务状态包含 `STARTED`。
- 定义 `task_serializer = 'json'`。
- 自动发现任务模块：`celery_app.autodiscover_tasks(['tasks'])`

### 4.2 封装生成任务

**文件**：`tasks/writing_tasks.py`

**要点**：
- 导入 `celery_app` 和 `NovelOrchestrator`。
- 定义 `@celery_app.task(bind=True, name='generate_novel')` 装饰的任务函数。
- 任务函数签名：`def generate_novel_task(self, project_dir: str, user_id: str = None) -> dict`
- **进度回调绑定**：实例化 `NovelOrchestrator` 时，传入一个回调函数，该函数调用 `self.update_state(state='PROGRESS', meta={'progress': pct, 'step': step, 'message': msg})`。
- **任务元信息**：在任务开始时，将 `project_dir` 和 `user_id` 存入 `self.request.meta` 便于追踪。
- **异常处理**：捕获所有异常，调用 `self.retry()` 或标记失败，并将错误信息存入 `meta`。

### 4.3 进度状态存储设计

**存储方案**：直接利用 Celery 的 `result_backend`（Redis）存储任务状态。

**进度数据结构**（存储在 `AsyncResult.info` 中）：
```json
{
  "progress": 0.35,
  "step": "generating_chapter_3",
  "message": "正在生成第 3 章初稿...",
  "chapter": 3,
  "total_chapters": 10
}
```

**前端查询方式**：
- 轮询端点 `GET /api/task/<task_id>/status`，返回上述 JSON。
- （进阶）使用 WebSocket 推送进度更新，需在回调中通过 Redis Pub/Sub 广播。

### 4.4 Web 层改造

**文件**：`app.py` 或新的 FastAPI 路由模块

**要点**：
- 新增端点 `POST /api/projects/<project_id>/generate`：
  - 接收请求，校验项目存在且未在生成中。
  - 调用 `generate_novel_task.delay(project_dir)` 触发后台任务。
  - 返回 `{"task_id": task.id}`。
- 新增端点 `GET /api/task/<task_id>/status`：
  - 通过 `AsyncResult(task_id)` 获取状态。
  - 返回 `state`、`progress`、`step`、`message`、`result`（完成时）。
- 确保所有 API 端点支持 CORS（如前端独立部署）。

## 五、注意事项与风险提示

1. **Worker 与 Web 进程分离**：
   - Celery worker 需要单独启动命令：`celery -A celery_app worker --loglevel=info --concurrency=1`
   - 确保 worker 运行环境与 Web 环境一致（相同的 `.env` 和 Python 包）。

2. **并发控制**：
   - 建议 `--concurrency=1`，因为每个生成任务会大量调用 LLM API，多并发可能触发速率限制或导致 API 密钥额度快速耗尽。
   - 如需支持多用户同时生成，可增加 worker 数量，但需在前端提示排队。

3. **任务持久化与重试**：
   - 若生成过程中 worker 崩溃，Celery 会重新调度任务（取决于 `acks_late` 配置）。需要确保 `NovelOrchestrator` 能够从断点恢复（这是 Task 3 或后续迭代的事），当前可先接受“失败重试从头开始”。
   - 设置 `max_retries=3`，并在任务内部捕获可恢复的 API 超时错误。

4. **进度回调的线程安全性**：
   - Celery 任务运行在独立进程中，回调中调用 `self.update_state` 是安全的。
   - 不要在回调中执行耗时 I/O 操作，仅更新状态即可。

5. **Redis 内存占用**：
   - 每个任务的结果默认在 Redis 中保留 24 小时，可通过 `result_expires` 调整。
   - 如果生成的小说内容较大，不要将完整内容存入任务结果，而应在任务完成后返回文件路径或数据库 ID，由前端另行拉取。

## 六、验收标准

- [ ] 启动 Celery worker 后，可通过 Python 交互环境调用 `generate_novel_task.delay(project_dir)` 触发异步生成。
- [ ] 在另一个终端轮询任务状态，能够看到 `PROGRESS` 状态和实时百分比、步骤信息。
- [ ] Web 端点 `POST /api/projects/xxx/generate` 返回 `task_id`，且 `GET /api/task/<task_id>/status` 返回正确进度。
- [ ] 任务完成后，`GET /api/task/<task_id>/status` 返回 `state='SUCCESS'` 及生成结果摘要（或文件路径）。
- [ ] 若生成过程中发生异常（如 API 密钥无效），任务状态变为 `FAILURE`，且 `info` 中包含错误原因。

## 七、后续依赖

- Task 3（FastAPI 后端与数据库）将在此任务基础上，将项目、用户信息存入数据库，并将 `project_dir` 的构建逻辑与数据库记录关联。
- Task 4（前端）将通过轮询上述状态端点实现生成进度条展示。