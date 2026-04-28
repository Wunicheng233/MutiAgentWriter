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
    const response = await api.post<ChatResponse>('/v1/ai/chat', request)
    return response.data
  },
}
