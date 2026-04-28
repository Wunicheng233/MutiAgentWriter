import React, { useRef, useEffect, useCallback } from 'react'
import { useChatStore, type ChatMessage as ChatMessageType } from '../../store/useChatStore'
import ChatMessage from './ChatMessage'
import { aiChat } from '../../utils/endpoints'

export const AIChatPanel: React.FC = () => {
  const { messages, inputText, isTyping, setInputText, addMessage, setIsTyping } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Adjust textarea height automatically
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [inputText, adjustTextareaHeight])

  // Smart auto-scroll - only scroll if user is near the bottom
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      if (isAtBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages, isTyping])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || isTyping) return

    const userMessage: ChatMessageType = {
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
      const response = await aiChat({
        user_input: userMessage.content,
        // TODO: Inject context here for Phase 1 (project awareness)
      })

      const assistantMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
      }

      addMessage(assistantMessage)
    } catch (error) {
      const errorMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，服务暂时不可用，请稍后再试。',
        timestamp: Date.now(),
      }
      addMessage(errorMessage)
    } finally {
      setIsTyping(false)
    }
  }, [inputText, isTyping, setInputText, addMessage, setIsTyping])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }, [handleSubmit])

  return (
    <div className="h-full flex flex-col" data-testid="ai-chat-panel">
      {/* Header */}
      <div className="px-4 pr-12 py-3 border-b border-[var(--border-default)]">
        <h3 className="font-medium text-[var(--text-primary)]">AI Assistant</h3>
      </div>

      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !isTyping ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
            <div className="text-center">
              <p className="text-sm mb-2">Ask me anything about your story</p>
              <p className="text-xs opacity-70">I can help with plot, characters, style, and more</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isTyping && (
              <div className="flex justify-start mb-4" data-testid="typing-indicator">
                <div className="bg-[var(--bg-tertiary)] rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '280ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[var(--border-default)]">
        <form onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="w-full resize-none rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-body)] placeholder-[var(--text-muted)] border-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-opacity-30 p-3 text-sm"
            rows={3}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="px-4 py-2 rounded-full bg-[var(--accent-primary)] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:opacity-90 transition-opacity duration-150"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AIChatPanel
