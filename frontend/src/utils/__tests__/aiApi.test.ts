import { aiChat } from '../endpoints'
import api from '../api'
import { vi, describe, it, expect } from 'vitest'

vi.mock('../api')

describe('aiChat', () => {
  it('should call the correct endpoint', async () => {
    const mockResponse = { data: { content: 'Hello!' } }
    ;(api.post as vi.Mock).mockResolvedValue(mockResponse)

    const result = await aiChat({ user_input: 'Hi' })

    expect(api.post).toHaveBeenCalledWith('/v1/ai/chat', { user_input: 'Hi' })
    expect(result).toEqual({ content: 'Hello!' })
  })

  it('should pass context when provided', async () => {
    const mockResponse = { data: { content: 'Got it' } }
    ;(api.post as vi.Mock).mockResolvedValue(mockResponse)

    const context = { project_id: 1 }
    await aiChat({ user_input: 'Hi', context })

    expect(api.post).toHaveBeenCalledWith('/v1/ai/chat', {
      user_input: 'Hi',
      context,
    })
  })

  it('should handle API errors gracefully', async () => {
    const mockError = new Error('API Error')
    ;(api.post as vi.Mock).mockRejectedValue(mockError)

    await expect(aiChat({ user_input: 'Hi' })).rejects.toThrow('API Error')
  })
})
