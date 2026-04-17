# Task 3: FastAPI 后端与数据持久化

## 一、任务目标

将项目从“单机脚本工具”升级为**多用户、可持久化、API 驱动**的后端服务。引入关系型数据库管理用户、项目、章节元数据，并使用 FastAPI 构建规范的 RESTful API。

**核心产出**：
1. PostgreSQL 数据库模型设计（SQLAlchemy ORM）
2. 用户系统（注册、登录、API Key 管理）
3. 项目管理 CRUD API
4. 章节内容存取 API
5. 与 Task 2 任务队列的集成（生成任务触发）

## 二、当前状态与目标差距

| 当前（基于文件系统） | 目标（基于数据库） |
|---------------------|-------------------|
| 项目数据散落在 YAML/JSON 文件中 | 用户、项目、章节元数据存储在 PostgreSQL |
| 无用户概念，所有项目混在一起 | 每个用户拥有独立的项目空间 |
| 章节内容以 `.md` 文件存储 | 章节内容存入数据库（或对象存储），元数据在数据库 |
| API 层简陋（Flask 模板渲染为主） | 标准 RESTful API，JSON 响应，适合前后端分离 |

## 三、技术选型

- **Web 框架**：FastAPI（原生异步支持、自动文档、类型提示）
- **ORM**：SQLAlchemy 2.0 + Alembic（数据库迁移）
- **数据库**：PostgreSQL（生产级，支持 JSON 字段）
- **认证**：JWT（`python-jose`）或简单的 API Key（内部使用）
- **密码加密**：`passlib[bcrypt]`
- **向量数据库**：ChromaDB 保持现有方式（不在此任务改动）

## 四、数据模型设计要点

### 4.1 核心表结构

| 表名 | 字段要点 | 说明 |
|------|----------|------|
| `users` | id, username, email, hashed_password, api_key, created_at | 用户表，api_key 用于 Agent 调用（可选） |
| `projects` | id, user_id, name, content_type, status, config (JSON), bible (JSON), quality_score, created_at, updated_at | 项目主表，config 存策划配置，bible 存设定圣经 |
| `chapters` | id, project_id, chapter_index, title, content, word_count, quality_score, status, agent_logs (JSON), created_at | 章节表，agent_logs 存储该章各 Agent 输出日志 |
| `generation_tasks` | id, project_id, celery_task_id, status, progress, error_message, started_at, completed_at | 生成任务追踪表，关联 Celery 任务 |

### 4.2 关系与约束

- `projects.user_id` → `users.id`（级联删除）
- `chapters.project_id` → `projects.id`（级联删除）
- `generation_tasks.project_id` → `projects.id`（级联删除）
- `projects` 表 `config` 和 `bible` 字段使用 `JSON` 类型，灵活存储 YAML 内容
- `chapters.agent_logs` 存储该章各 Agent 的输入输出摘要（可选）

### 4.3 索引建议

- `users.email` 唯一索引
- `projects.user_id` 普通索引
- `chapters.project_id` + `chapter_index` 联合唯一索引
- `generation_tasks.celery_task_id` 唯一索引

## 五、API 端点设计

### 5.1 认证模块

| 方法 | 路径 | 功能 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/register` | 用户注册 | 无 |
| POST | `/api/auth/login` | 登录，返回 JWT | 无 |
| GET | `/api/auth/me` | 获取当前用户信息 | JWT |
| POST | `/api/auth/api-key` | 生成/刷新 API Key | JWT |

### 5.2 项目管理

| 方法 | 路径 | 功能 | 鉴权 |
|------|------|------|------|
| GET | `/api/projects` | 列出当前用户的所有项目 | JWT |
| POST | `/api/projects` | 创建新项目（填写基础信息） | JWT |
| GET | `/api/projects/{id}` | 获取项目详情（含 config、bible） | JWT |
| PUT | `/api/projects/{id}` | 更新项目配置 | JWT |
| DELETE | `/api/projects/{id}` | 删除项目 | JWT |
| POST | `/api/projects/{id}/generate` | 触发生成任务（调用 Celery） | JWT |

### 5.3 章节管理

| 方法 | 路径 | 功能 | 鉴权 |
|------|------|------|------|
| GET | `/api/projects/{id}/chapters` | 列出项目所有章节（含摘要） | JWT |
| GET | `/api/projects/{id}/chapters/{index}` | 获取指定章节完整内容 | JWT |
| PUT | `/api/projects/{id}/chapters/{index}` | 更新章节内容（人工修改） | JWT |
| POST | `/api/projects/{id}/chapters/{index}/regenerate` | 重新生成单章 | JWT |

### 5.4 任务状态

| 方法 | 路径 | 功能 | 鉴权 |
|------|------|------|------|
| GET | `/api/tasks/{task_id}` | 获取 Celery 任务状态与进度 | JWT |

### 5.5 质量分析

| 方法 | 路径 | 功能 | 鉴权 |
|------|------|------|------|
| GET | `/api/projects/{id}/analytics` | 获取项目整体质量报告 | JWT |

## 六、实施步骤建议

### 6.1 数据库初始化
1. 编写 SQLAlchemy 模型（`models.py`）。
2. 配置 Alembic 并生成初始迁移脚本。
3. 编写数据库连接依赖（FastAPI `Depends`）。

### 6.2 用户系统实现
1. 实现注册、登录、JWT 签发与验证。
2. 编写认证依赖函数 `get_current_user`，用于保护路由。

### 6.3 项目 CRUD 实现
1. 创建项目时，在服务器文件系统中创建对应的 `project_dir`（如 `data/projects/{user_id}/{project_id}/`），用于存储 ChromaDB 和临时文件。
2. 将文件路径存入项目记录的 `file_path` 字段或通过约定路径生成。

### 6.4 与生成任务集成
1. 修改 `POST /projects/{id}/generate` 端点：
   - 检查项目是否已有运行中的任务（查询 `generation_tasks` 表）。
   - 构建 `project_dir` 路径。
   - 调用 `generate_novel_task.delay(project_dir, user_id=str(current_user.id))`。
   - 在 `generation_tasks` 表中插入记录，关联 `celery_task_id`。
2. 修改 Celery 任务，在进度回调中同时更新 `generation_tasks` 表的 `progress` 字段。

### 6.5 章节内容存取
- 初始生成时，章节内容仍写入 `chapters/` 目录的 `.md` 文件。
- 在生成完成钩子中，将章节内容同步存入数据库 `chapters` 表（便于快速查询和 API 响应）。
- 后续人工修改通过 API 直接更新数据库，并异步写回文件（保持一致性）。

## 七、注意事项与风险提示

1. **文件系统与数据库一致性**：
   - 核心状态应以数据库为准。文件系统作为生成过程的中间存储和向量数据库的源。
   - 考虑实现一个同步服务，或在每次读取时优先数据库，缺失时回退文件。

2. **用户数据隔离**：
   - 所有查询必须带 `user_id` 过滤，防止越权访问。
   - 文件系统路径建议采用 `data/users/{user_id}/projects/{project_id}` 结构。

3. **数据库迁移**：
   - 使用 Alembic 管理 schema 变更，每次修改模型后生成迁移文件。
   - 在开发环境测试迁移的升级和降级。

4. **性能考虑**：
   - 章节内容字段使用 `TEXT` 类型，若单章过长（>10万字），可考虑压缩存储或使用对象存储（如 S3/MinIO）。
   - 对于频繁访问的项目列表，适当添加 Redis 缓存。

5. **API 文档与测试**：
   - FastAPI 自动生成 Swagger UI (`/docs`)，确保所有端点都有清晰的 `summary` 和 `description`。
   - 编写几个关键流程的集成测试（如注册→创建项目→触发生成→查询进度）。

## 八、验收标准

- [ ] 可通过 `POST /api/auth/register` 注册新用户，并获取 JWT。
- [ ] 使用 JWT 可创建项目，并在数据库中看到相应记录。
- [ ] 触发生成任务后，`generation_tasks` 表有对应记录，且 `celery_task_id` 有效。
- [ ] 任务完成后，`GET /api/projects/{id}/chapters` 返回已生成的章节列表。
- [ ] 尝试访问其他用户的项目 ID 会返回 403 或 404。
- [ ] Swagger 文档 (`/docs`) 可正常访问并测试 API。

## 九、后续依赖

- Task 4 前端开发将完全基于本任务提供的 RESTful API 进行交互。
- Task 5 导出功能将复用数据库中的章节内容生成 `.epub` 等格式。