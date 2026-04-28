import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Toast } from './Toast'

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe('基础渲染', () => {
    it('当 open 为 true 时应该渲染 Toast', () => {
      render(<Toast message="测试消息" open={true} onClose={() => {}} />)
      expect(screen.getByText('测试消息')).toBeInTheDocument()
    })

    it('当 open 为 false 时不应该渲染', () => {
      render(<Toast message="测试消息" open={false} onClose={() => {}} />)
      expect(screen.queryByText('测试消息')).not.toBeInTheDocument()
    })
  })

  describe('关闭功能', () => {
    it('点击关闭按钮应该触发 onClose 回调', () => {
      const onClose = vi.fn()
      render(<Toast message="测试消息" open={true} onClose={onClose} />)

      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('自动关闭', () => {
    it('duration 后应该自动触发 onClose 回调', () => {
      const onClose = vi.fn()
      render(<Toast message="测试消息" open={true} onClose={onClose} duration={1000} />)

      expect(onClose).not.toHaveBeenCalled()

      vi.advanceTimersByTime(999)
      expect(onClose).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('当 duration 为 0 时不应该自动关闭', () => {
      const onClose = vi.fn()
      render(<Toast message="测试消息" open={true} onClose={onClose} duration={0} />)

      vi.advanceTimersByTime(10000)
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('变体样式', () => {
    it('应该正确渲染 info 变体', () => {
      render(<Toast message="信息消息" open={true} variant="info" onClose={() => {}} />)
      const toast = screen.getByRole('alert')
      expect(toast).toHaveClass('info')
    })

    it('应该正确渲染 success 变体', () => {
      render(<Toast message="成功消息" open={true} variant="success" onClose={() => {}} />)
      const toast = screen.getByRole('alert')
      expect(toast).toHaveClass('success')
    })

    it('应该正确渲染 warning 变体', () => {
      render(<Toast message="警告消息" open={true} variant="warning" onClose={() => {}} />)
      const toast = screen.getByRole('alert')
      expect(toast).toHaveClass('warning')
    })

    it('应该正确渲染 error 变体', () => {
      render(<Toast message="错误消息" open={true} variant="error" onClose={() => {}} />)
      const toast = screen.getByRole('alert')
      expect(toast).toHaveClass('error')
    })
  })
})
