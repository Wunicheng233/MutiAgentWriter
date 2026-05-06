# AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working AI Assistant chat feature integrated with the existing Volcano Engine API infrastructure, with extensible architecture for future enhancements.

**Architecture:** Modular 4-layer design (UI → API Client → API Endpoint → Service Layer → LLM Infrastructure) with clear extension points for context awareness, multi-agent routing, and tool calling.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + TypeScript + Zustand (frontend), Volcano Engine API (LLM)

---

## File Structure Map

| File | Purpose | Change Type |
|------|---------|------------|
| `backend/prompts/assistant/system.txt` | AI Assistant system prompt template | Create |
| `backend/core/config.py` | Add assistant agent configuration | Modify |
| `backend/services/ai_assistant_service.py` | Service layer for chat logic | Create |
| `backend/api/ai.py` | FastAPI router for chat endpoints | Create |
| `backend/main.py` | Register the new AI router | Modify |
| `tests/test_ai_assistant.py` | Backend unit tests | Create |
| `frontend/src/utils/aiApi.ts` | Frontend API client | Create |
| `frontend/src/components/ai/AIChatPanel.tsx` | Integrate real API call | Modify |
| `frontend/src/utils/__tests__/aiApi.test.ts` | Frontend API client tests | Create |

---

### Task 1: Create AI Assistant Prompt Template

**Files:**
- Create: `backend/prompts/assistant/system.txt`

- [ ] **Step 1: Create the prompt directory and file**

```bash
mkdir -p /Users/nobody1/Desktop/project/writer/backend/prompts/assistant
```

- [ ] **Step 2: Write the system prompt template**

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

- [ ] **Step 3: Verify the file was created**

Run: `cat /Users/nobody1/Desktop/project/writer/backend/prompts/assistant/system.txt`
Expected: File content matches the above

- [ ] **Step 4: Commit**

```bash
git add backend/prompts/assistant/system.txt
git commit -m "feat: add AI Assistant system prompt template"
```

---

### Task 2: Add Assistant Agent Configuration

**Files:**
- Modify: `backend/core/config.py` (add AGENT_CONFIGS entry)
- Test: `tests/test_ai_assistant.py` (config test)

- [ ] **Step 1: Write the failing test for agent config**

Create `tests/test_ai_assistant.py`:

```python
import unittest
from backend.core.config import settings

class TestAIAssistantConfig(unittest.TestCase):

    def test_assistant_agent_config_exists(self):
        """Verify assistant agent is properly configured"""
        agent_config = settings.get_agent_config("assistant")
        self.assertIsNotNone(agent_config)
        self.assertIn("model", agent_config)
        self.assertIn("temperature", agent_config)
        self.assertIn("max_tokens", agent_config)

    def test_assistant_temperature_setting(self):
        """Verify assistant has appropriate temperature (creative but consistent)"""
        agent_config = settings.get_agent_config("assistant")
        temperature = agent_config.get("temperature")
        # Should be between 0.5 (balanced) and 0.9 (creative)
        self.assertGreaterEqual(temperature, 0.5)
        self.assertLessEqual(temperature, 0.9)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nobody1/Desktop/project/writer && conda run -n novel_agent python -m unittest tests.test_ai_assistant.TestAIAssistantConfig -v`
Expected: FAIL with "assertIsNotNone" or similar because config doesn't exist

- [ ] **Step 3: Add assistant config to AGENT_CONFIGS**

In `backend/core/config.py`, find the `AGENT_CONFIGS` dictionary and add:

```python
    "assistant": {
        "model": DEFAULT_MODEL,
        "temperature": 0.7,  # 创造性适中，适合对话
        "max_tokens": 1000,
    },
```

Make sure it's added in the same format as other agents like "planner", "writer", etc.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/nobody1/Desktop/project/writer && conda run -n novel_agent python -m unittest tests.test_ai_assistant.TestAIAssistantConfig -v`
Expected: Both tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/core/config.py tests/test_ai_assistant.py
git commit -m "feat: add AI Assistant agent configuration"
```

---

### Task 3: Create AI Assistant Service Layer

**Files:**
- Create: `backend/services/ai_assistant_service.py`
- Test: `tests/test_ai_assistant.py` (add service tests)

- [ ] **Step 1: Write failing tests for service layer**

Add to `tests/test_ai_assistant.py`:

```python
from unittest.mock import patch, MagicMock
from backend.services.ai_assistant_service import AIAssistantService

class TestAIAssistantService(unittest.TestCase):

    @patch('backend.services.ai_assistant_service.call_volc_api')
    def test_chat_basic(self, mock_call_volc):
        """Test basic chat functionality"""
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
        """Test chat with context parameter (extensibility verification)"""
        mock_call_volc.return_value = "好的，我了解你的项目情况。"

        context = {"project_id": 1, "current_chapter": 3}
        result = AIAssistantService.chat("帮我看看这个项目", context=context)

        mock_call_volc.assert_called_once_with(
            agent_role="assistant",
            user_input="帮我看看这个项目",
            context=context,
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nobody1/Desktop/project/writer && conda run -n novel_agent python -m unittest tests.test_ai_assistant.TestAIAssistantService -v`
Expected: FAIL with "ModuleNotFoundError" or similar

- [ ] **Step 3: Implement the service layer**

Create `backend/services/ai_assistant_service.py`:

```python
"""
AI Assistant Service Layer

Extensibility Points:
- context_enricher(): Inject project/chapter context for contextual responses
- agent_router(): Route to specialized agents based on query type
- tool_calling_middleware(): Add function calling support
"""
from backend.utils.volc_engine import call_volc_api


class AIAssistantService:
    """
    AI Assistant service for handling chat requests.

    This service provides a clean separation between API layer
    and LLM infrastructure, designed for future extensibility.
    """

    @staticmethod
    def chat(user_input: str, context: dict = None) -> str:
        """
        Process a chat request and return AI response.

        Args:
            user_input: The user's message
            context: Optional context dictionary for future features
                    Can contain: project_id, current_chapter, genre, etc.

        Returns:
            AI-generated response string
        """
        # TODO: Add context enrichment here for Phase 1
        # TODO: Add agent routing here for Phase 2
        # TODO: Add tool calling middleware here for Phase 3

        result = call_volc_api(
            agent_role="assistant",
            user_input=user_input,
            context=context or {},
        )

        return result
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/nobody1/Desktop/project/writer && conda run -n novel_agent python -m unittest tests.test_ai_assistant.TestAIAssistantService -v`
Expected: Both tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/ai_assistant_service.py tests/test_ai_assistant.py
git commit -m "feat: add AI Assistant service layer"
```

---

### Task 4: Create FastAPI Router for AI Chat

**Files:**
- Create: `backend/api/ai.py`
- Modify: `backend/main.py` (register router)

- [ ] **Step 1: Write failing API tests**

Add to `tests/test_ai_assistant.py`:

```python
import json
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

class TestAIAssistantAPI(unittest.TestCase):

    @patch('backend.api.ai.AIAssistantService')
    def test_chat_endpoint_basic(self, mock_service):
        """Test POST /ai/chat endpoint with basic input"""
        mock_service.chat.return_value = "Hello from AI!"

        response = client.post(
            "/ai/chat",
            json={"user_input": "Hello"}
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("content", data)
        self.assertEqual(data["content"], "Hello from AI!")
        mock_service.chat.assert_called_once_with(
            user_input="Hello",
            context=None,
        )

    @patch('backend.api.ai.AIAssistantService')
    def test_chat_endpoint_with_context(self, mock_service):
        """Test POST /ai/chat endpoint with context parameter"""
        mock_service.chat.return_value = "Got context"

        response = client.post(
            "/ai/chat",
            json={
                "user_input": "Check project",
                "context": {"project_id": 1}
            }
        )

        self.assertEqual(response.status_code, 200)
        mock_service.chat.assert_called_once_with(
            user_input="Check project",
            context={"project_id": 1},
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nobody1/Desktop/project/writer && conda run -n novel_agent python -m unittest tests.test_ai_assistant.TestAIAssistantAPI -v`
Expected: FAIL with 404 (endpoint doesn't exist)

- [ ] **Step 3: Create the FastAPI router**

Create `backend/api/ai.py`:

```python
"""
AI Assistant API Router

Extensibility Points:
- /ai/chat/stream: SSE streaming for typing effect (Phase 4)
- /ai/conversations: Conversation history management (Phase 4)
- /ai/suggestions: Smart suggestions based on context
"""
from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.ai_assistant_service import AIAssistantService

router = APIRouter(prefix="/ai", tags=["ai"])


class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    user_input: str
    context: dict | None = None


class ChatResponse(BaseModel):
    """Response model for chat endpoint"""
    content: str


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    AI Assistant chat endpoint.

    Accepts user input and optional context, returns AI response.
    Designed for future extensibility with streaming and context-aware features.
    """
    result = AIAssistantService.chat(
        user_input=request.user_input,
        context=request.context,
    )

    return {"content": result}
```

- [ ] **Step 4: Register router in main.py**

In `backend/main.py`, find where other routers are imported and add:

```python
from backend.api.ai import router as ai_router
```

Then find where routers are included (after `app.include_router(projects_router)` etc.) and add:

```python
app.include_router(ai_router, prefix="/api/v1")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/nobody1/Desktop/project/writer && conda run -n novel_agent python -m unittest tests.test_ai_assistant.TestAIAssistantAPI -v`
Expected: Both tests PASS

- [ ] **Step 6: Verify endpoint works manually**

Run: `curl -X POST http://localhost:8000/api/v1/ai/chat -H "Content-Type: application/json" -d '{"user_input": "你好"}'`
Expected: JSON response with content field (may need to start server first)

- [ ] **Step 7: Commit**

```bash
git add backend/api/ai.py backend/main.py tests/test_ai_assistant.py
git commit -m "feat: add AI Assistant FastAPI router"
```

---

### Task 5: Create Frontend API Client

**Files:**
- Create: `frontend/src/utils/aiApi.ts`
- Create: `frontend/src/utils/__tests__/aiApi.test.ts`

- [ ] **Step 1: Write failing tests for API client**

Create `frontend/src/utils/__tests__/aiApi.test.ts`:

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
        context,
      })
    })

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('API Error')
      ;(api.post as vi.Mock).mockRejectedValue(mockError)

      await expect(aiApi.chat({ user_input: 'Hi' })).rejects.toThrow('API Error')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nobody1/Desktop/project/writer/frontend && npm run test:run -- --run src/utils/__tests__/aiApi.test.ts`
Expected: FAIL with "Cannot find module '../aiApi'"

- [ ] **Step 3: Implement the API client**

Create `frontend/src/utils/aiApi.ts`:

```typescript
/**
 * AI Assistant API Client
 *
 * Extensibility Points:
 * - streamChat(): SSE streaming for typing effect (Phase 4)
 * - getSuggestions(): Context-aware smart suggestions
 * - saveConversation(): Persist chat history
 * - getConversations(): List past conversations
 */
import api from './api'

export interface ChatRequest {
  user_input: string
  context?: Record<string, unknown>
}

export interface ChatResponse {
  content: string
}

export const aiApi = {
  /**
   * Send a chat message to the AI Assistant
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>('/ai/chat', request)
    return response.data
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/nobody1/Desktop/project/writer/frontend && npm run test:run -- --run src/utils/__tests__/aiApi.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/aiApi.ts frontend/src/utils/__tests__/aiApi.test.ts
git commit -m "feat: add AI Assistant frontend API client"
```

---

### Task 6: Integrate Real API into AIChatPanel

**Files:**
- Modify: `frontend/src/components/ai/AIChatPanel.tsx` (lines 67-77)

- [ ] **Step 1: Review current mock implementation**

Read the file to confirm the mock setTimeout location.

- [ ] **Step 2: Import the aiApi client and update handleSend**

In `frontend/src/components/ai/AIChatPanel.tsx`:

First, add the import:

```typescript
import { aiApi } from '../../utils/aiApi'
```

Then replace the `handleSend` function:

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
    // Call real backend API
    const response = await aiApi.chat({
      user_input: userMessage.content,
      // TODO: Inject context here for Phase 1 (project awareness)
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

- [ ] **Step 3: Verify the component compiles**

Run: `cd /Users/nobody1/Desktop/project/writer/frontend && npm run build`
Expected: Build completes successfully with no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ai/AIChatPanel.tsx
git commit -m "feat: integrate real API into AIChatPanel"
```

---

### Task 7: Run Full Test Suite and Verify Integration

**Files:**
- All files from previous tasks

- [ ] **Step 1: Run all backend tests**

Run: `cd /Users/nobody1/Desktop/project/writer && conda run -n novel_agent python -m unittest tests.test_ai_assistant -v`
Expected: All 6 tests PASS (2 config + 2 service + 2 API)

- [ ] **Step 2: Run all frontend tests**

Run: `cd /Users/nobody1/Desktop/project/writer/frontend && npm run test:run`
Expected: aiApi tests PASS, no regressions

- [ ] **Step 3: Start backend and test endpoint manually**

Run: `cd /Users/nobody1/Desktop/project/writer && conda run -n novel_agent uvicorn backend.main:app --host 0.0.0.0 --port 8000`
In another terminal: `curl -X POST http://localhost:8000/api/v1/ai/chat -H "Content-Type: application/json" -d '{"user_input": "你好，请介绍一下你自己"}'`
Expected: Returns valid JSON with AI response

- [ ] **Step 4: Start frontend and verify UI works**

Run: `cd /Users/nobody1/Desktop/project/writer/frontend && npm run dev`
Manual test:
1. Open browser to http://localhost:5173
2. Click the floating AI button
3. Type a message and send
4. Verify: typing indicator shows, AI response appears

- [ ] **Step 5: Commit verification (no changes needed if all pass)**

```bash
echo "All tests passed, AI Assistant feature complete"
```

---

## Self-Review

**1. Spec Coverage:**
- Prompt template → Task 1
- Agent config → Task 2
- Service layer → Task 3
- API endpoint → Task 4
- Frontend API client → Task 5
- UI integration → Task 6
- Full integration test → Task 7
- Extensibility comments → All files have TODO/extensibility notes

**2. Placeholder Scan:**
- No TBD/TODO placeholders in implementation code
- All code blocks are complete
- All steps have exact commands and expected output
- All test code is complete

**3. Type Consistency:**
- Backend: `user_input`, `context` → matches frontend
- Frontend: `ChatRequest`, `ChatResponse` → matches backend Pydantic models
- `aiApi.chat()` → matches `/ai/chat` endpoint signature
- Service `chat()` → matches API layer call

---

Plan complete and saved to `docs/superpowers/plans/2026-04-28-ai-assistant-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
