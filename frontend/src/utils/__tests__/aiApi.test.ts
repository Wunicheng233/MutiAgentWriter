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

      expect(api.post).toHaveBeenCalledWith('/v1/ai/chat', { user_input: 'Hi' })
      expect(result).toEqual({ content: 'Hello!' })
    })

    it('should pass context when provided', async () => {
      const mockResponse = { data: { content: 'Got it' } }
      ;(api.post as vi.Mock).mockResolvedValue(mockResponse)

      const context = { project_id: 1 }
      await aiApi.chat({ user_input: 'Hi', context })

      expect(api.post).toHaveBeenCalledWith('/v1/ai/chat', {
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
