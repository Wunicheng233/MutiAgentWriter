import type { Meta, StoryObj } from '@storybook/react'
import { AgentCard } from './AgentCard'

const meta: Meta<typeof AgentCard> = {
  title: 'v2/AgentCard',
  component: AgentCard,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['idle', 'running', 'done', 'error'],
    },
  },
}

export default meta
type Story = StoryObj<typeof AgentCard>

export const Idle: Story = {
  args: {
    name: '内容分析 Agent',
    subtitle: '分析小说内容并提取关键信息',
    status: 'idle',
  },
}

export const Running: Story = {
  args: {
    name: '大纲生成 Agent',
    subtitle: '根据需求生成小说大纲',
    status: 'running',
    progress: 65,
    currentStep: '正在生成章节结构...',
  },
}

export const Done: Story = {
  args: {
    name: '章节写作 Agent',
    subtitle: '自动生成小说章节内容',
    status: 'done',
    progress: 100,
  },
}

export const Error: Story = {
  args: {
    name: '质量检查 Agent',
    subtitle: '检查内容质量和一致性',
    status: 'error',
  },
}
