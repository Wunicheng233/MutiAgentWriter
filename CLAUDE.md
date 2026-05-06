# StoryForge AI - Claude Code 配置

本项目使用 Claude Code Superpowers 工作流进行开发。

## Superpowers 工作流配置

###  始终启用的技能

以下技能在本项目中必须始终使用：

1. **brainstorming** - 任何新功能开发前必须先进行设计和规划
2. **writing-plans** - 设计确认后生成详细实现计划
3. **test-driven-development** - 先写测试再写代码
4. **subagent-driven-development** - 复杂任务分解给子代理执行
5. **systematic-debugging** - 遇到 bug 时系统化调试
6. **requesting-code-review** - 完成后请求代码审查
7. **verification-before-completion** - 提交前验证所有功能
8. **finishing-a-development-branch** - 分支完成时的收尾工作

### 项目开发流程

```
新功能需求
    ↓
/brainstorming → 探索问题、提出方案、设计确认
    ↓
/writing-plans → 生成详细的分步实现计划
    ↓
/test-driven-development → 先写测试，再实现功能
    ↓
/requesting-code-review → 代码审查
    ↓
/verification-before-completion → 验证测试通过
    ↓
/finishing-a-development-branch → 合并/提交
```

### 项目环境

- **Conda 环境**: `novel_agent` - 所有 Python 命令必须在此环境下运行
- **后端**: FastAPI + SQLAlchemy + Celery
- **前端**: React + TypeScript + Vite + Tailwind CSS
- **数据库**: PostgreSQL + Redis
- **测试框架**: Python unittest (后端) + Vitest (前端)

### 常用命令

```bash
# 激活环境
conda activate novel_agent

# 启动后端
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# 启动 Celery
celery -A celery_app worker --loglevel=info

# 启动前端
cd frontend && npm run dev

# 运行后端测试
cd /Users/nobody1/Desktop/project/writer && python -m unittest discover tests -v

# 运行前端测试
cd frontend && npm run test:run
```

### 禁止事项

1.  跳过 brainstorming 直接写代码
2.  没有计划就开始大规模重构
3.  不写测试就提交功能
4.  在 novel_agent 环境外运行 Python 命令
5.  直接 push 到 main 分支（除非是文档更新）

### 代码规范

- 遵循现有代码风格，保持一致性
- 新功能必须带测试
- 提交前运行完整测试套件
- 使用 git worktree 进行并行开发
