import type { Meta, StoryObj } from '@storybook/react'
import { Switch } from './Switch'

const meta: Meta<typeof Switch> = {
  title: 'v2/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    labelPosition: {
      control: 'select',
      options: ['left', 'right'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Switch>

export const Default: Story = {
  args: {},
}

export const Checked: Story = {
  args: {
    checked: true,
  },
}

export const WithLabel: Story = {
  args: {
    label: '启用通知',
  },
}

export const LabelLeft: Story = {
  args: {
    label: '左侧标签',
    labelPosition: 'left',
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
    label: '小号开关',
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
    label: '大号开关',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    label: '已禁用',
  },
}

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    checked: true,
    label: '已禁用（开启状态）',
  },
}
