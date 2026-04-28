"""
AI Assistant API Router

Extensibility Points:
- /ai/chat/stream: SSE streaming for typing effect (Phase 4)
- /ai/conversations: Conversation history management (Phase 4)
- /ai/suggestions: Smart suggestions based on context
"""
from fastapi import APIRouter, HTTPException
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
def chat(request: ChatRequest):
    """
    AI Assistant chat endpoint.

    Accepts user input and optional context, returns AI response.
    Designed for future extensibility with streaming and context-aware features.
    """
    try:
        result = AIAssistantService.chat(
            user_input=request.user_input,
            context=request.context,
        )
        return ChatResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")
