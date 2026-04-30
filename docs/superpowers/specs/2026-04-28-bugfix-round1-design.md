# 项目Bug修复第一轮 - 设计文档

**日期**: 2026-04-28
**状态**: 设计完成
**修复问题数**: 9个

## 概述

基于项目全方位大体检发现的问题，进行第一轮Bug修复。专注于高优先级和中优先级的9个问题，确保系统稳定性和代码规范。

## 问题清单与修复方案

### 🔴 高优先级问题（2个）

#### 问题1: db_session() 缺少 @contextmanager 装饰器
- **文件**: `backend/database.py`
- **行号**: 47-61
- **问题描述**: `db_session()` 函数使用 `yield` 语法但缺少 `@contextmanager` 装饰器，导致无法通过 `with db_session() as db:` 正常使用
- **修复方案**:
  1. 在文件顶部添加导入: `from contextlib import contextmanager`
  2. 在 `db_session()` 函数定义前添加 `@contextmanager` 装饰器

#### 问题2: 缺少 contextmanager 导入
- **文件**: `backend/database.py`
- **行号**: 1-10
- **问题描述**: 缺少 `from contextlib import contextmanager` 导入语句
- **修复方案**: 见问题1

---

### 🟡 中优先级问题（7个）

#### 问题3: 文件删除操作缺少异常处理
- **文件**: `backend/api/projects.py`
- **行号**: 1305-1311
- **问题描述**: 删除 `novel_plan.md` 和 `setting_bible.md` 文件时没有 try-except 包装，文件不存在或无权限时会抛出500错误
- **修复方案**:
  ```python
  try:
      plan_file = project_dir / "novel_plan.md"
      if plan_file.exists():
          plan_file.unlink()
      setting_file = project_dir / "setting_bible.md"
      if setting_file.exists():
          setting_file.unlink()
  except Exception as e:
      logger.warning(f"Failed to delete plan/setting files: {e}")
  ```

#### 问题4: project.config 操作未验证类型
- **文件**: `backend/api/projects.py`
- **行号**: 1290-1303
- **问题描述**: 对 `project.config` 进行字典操作前未验证其类型，若 config 不是 dict 会导致 AttributeError
- **修复方案**:
  ```python
  if isinstance(project.config, dict):
      project.config.pop("start_chapter", None)
      project.config.pop("end_chapter", None)
      project.config.pop("skip_plan_confirmation", None)
      project.config.pop("skip_chapter_confirmation", None)
  ```

#### 问题5: 函数内部导入违反PEP8规范
- **文件**: `backend/rate_limiter.py`
- **行号**: 96
- **问题描述**: `from backend.deps import get_current_user` 在函数内部导入，违反PEP8规范，可能导致循环导入
- **修复方案**: 将导入语句移到文件顶部与其他导入语句一起

#### 问题6: useEffect中直接setState导致级联渲染
- **文件**: `frontend/src/pages/ProjectOutline.tsx`
- **行号**: 101
- **问题描述**: 在useEffect中直接调用 `setConfigForm(newConfig)` 导致级联渲染，ESLint报错
- **修复方案**: 使用useEvent包装或重构状态更新逻辑，避免在effect中直接同步状态。可以改为在数据获取后立即设置，或使用useRef判断是否需要更新。

#### 问题7: catch块中error变量未使用
- **文件**: `frontend/src/components/ai/AIChatPanel.tsx`
- **行号**: 66
- **问题描述**: `catch (error)` 中 error 变量定义但未使用，ESLint报错
- **修复方案**: 改为 `catch (_error)` 或移除变量

#### 问题8: 章节大纲补充缺少上限检查
- **文件**: `backend/core/orchestrator.py`
- **行号**: 577-590
- **问题描述**: 当 `self.end_chapter` 很大时，会生成大量重复大纲，没有上限保护
- **修复方案**: 添加上限检查（如最多补充200章），超过时记录警告并截断

#### 问题9: 未处理 chapter_outlines 为空的情况
- **文件**: `backend/core/orchestrator.py`
- **行号**: 592-595
- **问题描述**: 如果 `parse_outlines_from_setting_bible()` 返回空列表，后续处理会失败
- **修复方案**: 添加空列表检查，回退到默认大纲:
  ```python
  if not self.chapter_outlines:
      logger.warning("未解析到任何章节大纲，创建默认大纲")
      self.chapter_outlines = [{
          "chapter_num": 1,
          "title": "",
          "outline": self.plan or "默认章节大纲",
          "target_word_count": int(self.chapter_word_count)
      }]
  ```

---

## 🟢 低优先级问题（本次跳过，共5个）

以下问题在后续迭代中处理：
1. `ProjectOverview.tsx` - `dangerouslySetInnerHTML` XSS风险（内容来自内部API，风险较低）
2. `AppLayout.tsx` - 使用 `useLayoutStore.getState()` 不符合React最佳实践
3. `tests/test_rate_limiter.py` - 直接访问 `rate_limiter._requests.clear()` 不够封装
4. `tests/test_ai_assistant.py` - API路径硬编码
5. 多个前端文件 - 重复的轮询和状态初始化逻辑

---

## 测试验证

### 验收标准
1. ✅ 所有Python语法检查通过
2. ✅ 前端TypeScript构建通过（`npm run build`）
3. ✅ 前端ESLint检查通过（`npm run lint`）
4. ✅ 所有前端测试通过（326个用例）
5. ✅ 现有功能无回归

### 测试范围
- 前端单元测试：全部运行
- 后端语法检查：AST解析验证
- 构建验证：TypeScript编译

---

## 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 上下文管理器修复影响现有调用 | 中 | 低 | 检查所有 `with db_session()` 调用点 |
| rate_limiter导入移动导致循环导入 | 中 | 低 | 移动后验证导入链 |
| 前端状态重构引入回归 | 中 | 中 | 运行完整测试套件 |

---

## 变更范围

本次修改涉及以下文件：
1. `backend/database.py` - 导入和装饰器添加
2. `backend/api/projects.py` - 异常处理和类型验证
3. `backend/rate_limiter.py` - 导入语句移动
4. `backend/core/orchestrator.py` - 边界条件增强
5. `frontend/src/pages/ProjectOutline.tsx` - ESLint修复
6. `frontend/src/components/ai/AIChatPanel.tsx` - ESLint修复

共修改 **6个文件**，变更范围可控。
