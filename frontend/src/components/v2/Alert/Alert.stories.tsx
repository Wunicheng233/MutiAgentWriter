import type { Meta, StoryObj } from '@storybook/react'
import { Alert } from './Alert'

const meta: Meta<typeof Alert> = {
  title: 'v2/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'warning', 'error', 'info'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Alert>

export const Info: Story = {
  args: {
    children: '这是一条提示信息，用于展示普通的通知内容。',
  },
}

export const Success: Story = {
  args: {
    variant: 'success',
    children: '操作成功！您的内容已保存。',
  },
}

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: '请注意：您的存储空间即将用完，请及时清理。',
  },
}

export const Error: Story = {
  args: {
    variant: 'error',
    children: '发生错误：无法连接到服务器，请稍后重试。',
  },
}

export const WithTitle: Story = {
  args: {
    variant: 'success',
    title: '保存成功',
    children: '您的文档已成功保存，所有更改已同步到云端。',
  },
}

export const Closable: Story = {
  args: {
    variant: 'info',
    closable: true,
    children: '点击右上角的关闭按钮可以关闭此提示。',
  },
}
