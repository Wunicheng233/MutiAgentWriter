import type { Meta, StoryObj } from '@storybook/react'
import { Empty } from './Empty'
import { Button } from '../Button/Button'

const meta: Meta<typeof Empty> = {
  title: 'v2/Empty',
  component: Empty,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    icon: {
      control: { type: 'select' },
      options: ['document', 'folder', 'list'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Empty>

export const Default: Story = {
  args: {},
}

export const WithDescription: Story = {
  args: {
    title: '还没有项目',
    description: '创建你的第一个创作项目，开始你的写作之旅',
  },
}

export const WithAction: Story = {
  args: {
    icon: 'folder',
    title: '暂无项目',
    description: '点击下方按钮创建你的第一个项目',
    action: <Button variant="primary">创建项目</Button>,
  },
}

export const EmptyList: Story = {
  args: {
    icon: 'list',
    title: '列表为空',
    description: '还没有添加任何内容',
  },
}
