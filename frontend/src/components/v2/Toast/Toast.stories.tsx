import type { Meta, StoryObj } from '@storybook/react'
import { useContext } from 'react'
import { Button } from '../Button/Button'
import { ToastProvider } from './Toast'
import { ToastContext } from './toastContext'

const meta: Meta = {
  title: 'v2/Toast',
  component: ToastProvider,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj

const ToastDemo = () => {
  const { showToast } = useContext(ToastContext)

  return (
    <div className="flex flex-wrap gap-4">
      <Button onClick={() => showToast('这是一条成功提示消息！', 'success')}>
        成功提示
      </Button>
      <Button variant="secondary" onClick={() => showToast('这是一条信息提示！', 'info')}>
        信息提示
      </Button>
      <Button variant="secondary" onClick={() => showToast('请注意：这是一个警告！', 'warning')}>
        警告提示
      </Button>
      <Button variant="danger" onClick={() => showToast('发生错误：操作失败！', 'error')}>
        错误提示
      </Button>
    </div>
  )
}

export const Default: Story = {
  render: () => (
    <ToastProvider>
      <ToastDemo />
    </ToastProvider>
  ),
}
