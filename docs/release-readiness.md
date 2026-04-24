# StoryForge AI 发布收口清单

最后更新：

- 2026-04-24

---

## 1. 这份文档解决什么问题

随着比赛冲刺推进，项目已经从“能跑的多 Agent 原型”进入“可交付产品”阶段。

当前最需要避免的问题，不是再多做几个功能，而是：

- 发布时遗漏数据库迁移
- 前后端状态看起来正常，但真实环境没有做一轮闭环回归
- 团队成员知道代码变了，却不知道上线前该核对什么

这份文档就是一份短而能执行的发布清单。

---

## 2. 本轮关键发布事项

### A. 用户自定义 API Key 已切换为加密静态存储

本次后端已经新增：

- `users.encrypted_api_key`
- 新写入默认走加密存储
- 读取路径优先解密新字段，再兼容旧字段
- worker 执行链路读取的是解密后的有效值

发布时必须执行 Alembic 迁移：

```bash
conda run -n novel_agent alembic upgrade head
```

本次迁移不仅会加列，还会把已有明文 `api_key` 回填到 `encrypted_api_key`，并清空旧列。

### B. 前端已做路由懒加载和 vendor 拆包

本次前端入口已增加：

- 路由级懒加载
- `editor / charts / react / query` 分组拆包

上线前需要确认：

- 登录页首屏可正常打开
- 编辑器页首次进入虽是懒加载，但没有白屏和闪退
- 质量分析页图表仍能正常渲染

---

## 3. 发布前必跑检查

### 后端检查

```bash
conda run -n novel_agent python -m unittest tests.test_review_fixes tests.test_workflow_foundation
conda run -n novel_agent python -m py_compile backend/auth.py backend/api/auth.py backend/models.py tasks/writing_tasks.py core/config.py alembic/versions/0005_add_encrypted_user_api_key.py
```

### 前端检查

```bash
cd frontend
npm run lint
npm run build
```

### 数据库迁移

```bash
conda run -n novel_agent alembic upgrade head
```

---

## 4. 最小人工回归路径

上线前至少手动走一遍下面这条路径：

1. 注册或登录
2. 创建项目
3. 触发生成
4. 进入等待确认
5. 提交反馈并继续生成
6. 打开项目概览页、章节页、运行详情页
7. 打开质量分析页
8. 打开 artifact 详情页
9. 清空并重新设置用户自定义 API Key
10. 导出或分享一次作品

重点观察：

- `waiting_confirm` 状态是否稳定
- run detail 是否能看到 steps / feedback / artifact
- artifact 详情页是否能正常回看版本链
- 重新设置 API Key 后，后续生成是否仍可用

---

## 5. 发布阻塞条件

如果出现以下任一情况，不建议直接发布：

- Alembic 迁移未执行
- `tests.test_review_fixes` 或 `tests.test_workflow_foundation` 未通过
- 编辑器页、质量页、运行详情页存在懒加载白屏
- 生成流程在 `waiting_confirm -> continue` 之间状态错乱
- 自定义 API Key 设置后无法继续执行任务

---

## 6. 发布后的首轮观察点

发布后的第一轮观察，不要只看“能不能进页面”，而要重点看：

- 新项目生成任务是否稳定写入 workflow run
- 失败任务是否仍能正确取消或恢复
- 用户设置 API Key 后是否出现解密失败或空值回退异常
- 前端懒加载后首屏和大页面跳转是否明显改善

如果这些都稳定，当前版本就已经可以视为一版“完成度较高、具备持续演进基础”的正式候选版本。
