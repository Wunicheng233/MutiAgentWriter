import type { Meta, StoryObj } from '@storybook/react'
import { Divider } from './Divider'

const meta: Meta<typeof Divider> = {
  title: 'v2/Divider',
  component: Divider,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Divider>

export const Horizontal: Story = {
  args: {},
}

export const Dashed: Story = {
  args: {
    dashed: true,
  },
}

export const WithText: Story = {
  args: {
    children: '或者',
  },
}

export const Vertical: StoryObj = {
  render: () => (
    <div className="flex items-center h-16 gap-4">
      <span>左侧内容</span>
      <Divider orientation="vertical" />
      <span>右侧内容</span>
    </div>
  ),
  name: 'Vertical',
}
