import type { Meta, StoryObj } from '@storybook/react'
import { StatsCard } from './StatsCard'

const meta: Meta<typeof StatsCard> = {
  title: 'v2/StatsCard',
  component: StatsCard,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'warning'],
    },
  },
}

export default meta
type Story = StoryObj<typeof StatsCard>

export const Default: Story = {
  args: {
    label: '章节数量',
    value: 24,
  },
}

export const Primary: Story = {
  args: {
    label: '平均评分',
    value: '8.5',
    variant: 'primary',
  },
}

export const Success: Story = {
  args: {
    label: '通过率',
    value: '95%',
    variant: 'success',
  },
}

export const Warning: Story = {
  args: {
    label: '待处理',
    value: 3,
    variant: 'warning',
  },
}

export const WithIcon: Story = {
  args: {
    label: '总字数',
    value: '125,000',
    variant: 'primary',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
      </svg>
    ),
  },
}

export const GridLayout: StoryObj = {
  render: () => (
    <div className="grid grid-cols-4 gap-4 max-w-2xl">
      <StatsCard label="项目总数" value={12} />
      <StatsCard label="已完成" value={8} variant="success" />
      <StatsCard label="进行中" value={3} variant="primary" />
      <StatsCard label="待审核" value={1} variant="warning" />
    </div>
  ),
  name: 'Grid Layout',
}
