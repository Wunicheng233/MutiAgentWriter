# AI Assistant 功能设计文档

**日期：** 2026-04-28
**状态：** 设计确认，待实现
**优先级：**  P2 - 增强用户体验

## 1. 功能概述

AI Assistant 是一个集成在写作平台中的通用对话助手，用户可以在任何页面通过悬浮按钮唤起，进行：
- 写作灵感咨询
- 问题排查
- 功能使用指导
- 其他通用对话需求

**核心设计原则：可扩展性优先**
- 模块化架构，便于后续增加功能
- 清晰的接口边界，便于重构
- 与现有基础设施完全解耦

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                                │
├──────────────────┬──────────────────┬──────────────────────┤
│  FloatingToggle  │  AIChatPanel     │  useChatStore         │
│  Button          │  (UI)            │  (Zustand 状态)       │
└──────────────────┴──────────────────┴──────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        API 层                               │
├─────────────────────────────────────────────────────────────┤
│  POST /api/v1/ai/chat                                       │
│  - user_input: str                                          │
│  - context: Optional[dict]  (预留：项目上下文)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        业务层                               │
├─────────────────────────────────────────────────────────────┤
│  ai_assistant_service.py                                    │
│  - handle_chat_request()                                    │
│  - 预留：context_enricher()  (后续添加上下文感知)           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        基础设施层                            │
├─────────────────────────────────────────────────────────────┤
│  volc_engine.py  (已存在)                                   │
│  - call_volc_api(agent_role="assistant")                    │
│  - 客户端缓存、连接池复用                                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 扩展点设计（面向未来）

| 扩展方向 | 接口预留位置 | 预计实现方式 |
|---------|------------|------------|
| **上下文感知** | `context: Optional[dict]` 参数 | 注入当前项目状态、章节内容 |
| **多 Agent 路由** | Service 层 | 根据用户问题自动选择 Planner/Writer/Editor 视角 |
| **工具调用** | Service 层中间件 | 后续集成 Function Calling |
| **对话历史** | 数据库层 | 保存会话历史，支持多轮对话 |
| **流式输出** | API 层 | SSE 或 WebSocket 支持打字机效果 |
| **Prompt 工程** | Prompt 模板层 | Skill Runtime 方式叠加不同能力 |

---

## 3. 详细设计

### 3.1 后端设计

#### 3.1.1 Prompt 模板

**路径：** `backend/prompts/assistant/system.txt`

```
你是 StoryForge AI 的写作助手，帮助用户进行小说创作。

【你的角色】
- 耐心解答用户关于写作平台的使用问题
- 提供创作灵感和建议
- 帮助用户排查问题
- 保持友好、专业的语气

【注意事项】
- 如果用户询问具体项目的内容，请告知用户该功能正在开发中
- 不要编造不存在的功能
- 回答简洁明了
```

#### 3.1.2 AI Assistant Service

**路径：** `backend/services/ai_assistant_service.py`

```python
from backend.utils.volc_engine import call_volc_api

class AIAssistantService:
    """
    AI Assistant 服务层
    
    扩展点：
    - 后续添加 context_enricher 方法注入项目上下文
    - 后续添加 agent_router 方法根据问题类型选择不同 Agent
    - 后续添加 tool_calling 中间件支持工具调用
    """
    
    @staticmethod
    async def chat(user_input: str, context: dict = None) -> str:
        """
        处理聊天请求
        
        Args:
            user_input: 用户输入
            context: 预留的上下文参数，可包含 project_id, current_chapter 等
        
        Returns:
            AI 回复内容
        """
        # 当前版本：简单调用通用 Assistant Agent
        # 后续版本：在这里添加上下文增强、Agent 路由等逻辑
        
        result = call_volc_api(
            agent_role="assistant",
            user_input=user_input,
            context=context or {},
        )
        
        return result
```

#### 3.1.3 API 端点

**路径：** `backend/api/ai.py`

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from backend.services.ai_assistant_service import AIAssistantService

router = APIRouter(prefix="/ai", tags=["ai"])

class ChatRequest(BaseModel):
    user_input: str
    context: dict | None = None

class ChatResponse(BaseModel):
    content: str

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    AI Assistant 聊天接口
    
    扩展点：
    - 后续添加流式输出支持（SSE）
    - 后续添加 project_id 认证
    """
    result = await AIAssistantService.chat(
        user_input=request.user_input,
        context=request.context,
    )
    
    return {"content": result}
```

#### 3.1.4 配置更新

在 `backend/core/config.py` 中添加 Assistant Agent 配置：

```python
# AI Assistant 配置
AGENT_CONFIGS["assistant"] = {
    "model": DEFAULT_MODEL,
    "temperature": 0.7,  # 创造性适中
    "max_tokens": 1000,
}
```

### 3.2 前端设计

#### 3.2.1 API 客户端

**路径：** `frontend/src/utils/aiApi.ts`

```typescript
import api from './api'

export interface ChatRequest {
  user_input: string
  context?: Record<string, unknown>
}

export interface ChatResponse {
  content: string
}

/**
 * AI Assistant API 客户端
 * 
 * 扩展点：
 * - 后续添加 streamChat() 支持流式输出
 * - 后续添加 getSuggestions() 智能建议
 * - 后续添加 saveConversation() 保存历史
 */
export const aiApi = {
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>('/ai/chat', request)
    return response.data
  },
}
```

#### 3.2.2 AIChatPanel 集成

**路径：** `frontend/src/components/ai/AIChatPanel.tsx`

修改 `handleSend` 方法，替换 mock setTimeout 为真实 API 调用：

```typescript
const handleSend = async () => {
  if (!inputText.trim() || isTyping) return

  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: inputText.trim(),
    timestamp: Date.now(),
  }

  addMessage(userMessage)
  setInputText('')
  setIsTyping(true)

  try {
    // 调用真实后端 API
    const response = await aiApi.chat({
      user_input: userMessage.content,
      // 后续可以在这里注入上下文：当前项目 ID、当前章节等
    })

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response.content,
      timestamp: Date.now(),
    }

    addMessage(assistantMessage)
  } catch (error) {
    const errorMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '抱歉，服务暂时不可用，请稍后再试。',
      timestamp: Date.now(),
    }
    addMessage(errorMessage)
  } finally {
    setIsTyping(false)
  }
}
```

---

## 4. 测试设计

### 4.1 后端测试

**路径：** `tests/test_ai_assistant.py`

```python
import unittest
from unittest.mock import patch, MagicMock
from backend.services.ai_assistant_service import AIAssistantService

class TestAIAssistantService(unittest.TestCase):
    
    @patch('backend.services.ai_assistant_service.call_volc_api')
    def test_chat_basic(self, mock_call_volc):
        """测试基础聊天功能"""
        mock_call_volc.return_value = "你好！有什么我可以帮助你的吗？"
        
        result = AIAssistantService.chat("你好")
        
        self.assertEqual(result, "你好！有什么我可以帮助你的吗？")
        mock_call_volc.assert_called_once_with(
            agent_role="assistant",
            user_input="你好",
            context={},
        )
    
    @patch('backend.services.ai_assistant_service.call_volc_api')
    def test_chat_with_context(self, mock_call_volc):
        """测试带上下文的聊天（扩展点验证）"""
        mock_call_volc.return_value = "好的，我了解你的项目情况。"
        
        context = {"project_id": 1, "current_chapter": 3}
        result = AIAssistantService.chat("帮我看看这个项目", context=context)
        
        mock_call_volc.assert_called_once_with(
            agent_role="assistant",
            user_input="帮我看看这个项目",
            context=context,
        )
    
    def test_service_extensibility_hooks(self):
        """验证服务层预留的扩展方法存在"""
        # 确保类结构支持后续添加方法
        self.assertTrue(hasattr(AIAssistantService, 'chat'))
        # 后续可以添加：context_enricher, agent_router 等
```

### 4.2 前端测试

**路径：** `frontend/src/utils/__tests__/aiApi.test.ts`

```typescript
import { aiApi } from '../aiApi'
import api from '../api'
import { vi, describe, it, expect } from 'vitest'

vi.mock('../api')

describe('aiApi', () => {
  describe('chat', () => {
    it('should call the correct endpoint', async () => {
      const mockResponse = { data: { content: 'Hello!' } }
      ;(api.post as vi.Mock).mockResolvedValue(mockResponse)

      const result = await aiApi.chat({ user_input: 'Hi' })

      expect(api.post).toHaveBeenCalledWith('/ai/chat', { user_input: 'Hi' })
      expect(result).toEqual({ content: 'Hello!' })
    })

    it('should pass context when provided', async () => {
      const mockResponse = { data: { content: 'Got it' } }
      ;(api.post as vi.Mock).mockResolvedValue(mockResponse)

      const context = { project_id: 1 }
      await aiApi.chat({ user_input: 'Hi', context })

      expect(api.post).toHaveBeenCalledWith('/ai/chat', { 
        user_input: 'Hi', 
        context 
      })
    })
  })
})
```

---

## 5. 验收标准

### 5.1 功能验收

- [ ] 用户点击悬浮按钮可以打开/关闭聊天面板
- [ ] 用户可以输入消息并发送
- [ ] 发送后显示"正在输入"状态
- [ ] 正确接收并显示 AI 的回复
- [ ] 错误情况有友好的降级提示

### 5.2 架构验收（可扩展性验证）

- [ ] Service 层与 Controller 层完全分离
- [ ] API 层预留 context 参数接口
- [ ] Prompt 模板独立可替换
- [ ] 前端 API 客户端模块化
- [ ] 不破坏任何现有功能

### 5.3 质量验收

- [ ] 所有后端测试通过
- [ ] 所有前端测试通过
- [ ] 代码遵循项目现有风格

---

## 6. 后续扩展路线图

### Phase 1: 上下文感知 (预计 1-2 周)
- 注入当前打开的项目信息
- 注入当前章节内容
- Assistant 可以引用项目具体内容回答

### Phase 2: 多 Agent 智能路由 (预计 2-3 周)
- 根据问题类型自动选择 Agent
- 写作问题 → Writer 视角
- 大纲问题 → Planner 视角
- 质量问题 → Critic 视角

### Phase 3: 工具调用 & 主动操作 (预计 3-4 周)
- Assistant 可以主动生成章节
- Assistant 可以修改大纲
- Assistant 可以运行质量检查

### Phase 4: 流式输出 & 对话历史 (预计 1-2 周)
- SSE 流式打字机效果
- 会话历史持久化
- 多会话管理

---

## 7. 风险评估

| 风险项 | 影响 | 概率 | 缓解措施 |
|--------|------|------|----------|
| API 超时影响体验 | 中 | 中 | 前端超时保护 + 友好重试提示 |
| Token 成本控制 | 中 | 低 | 限制单次输出长度，统计使用量 |
| 后续重构成本 | 低 | 低 | 模块化设计，接口稳定 |

**总体风险等级：** 低风险，高收益
