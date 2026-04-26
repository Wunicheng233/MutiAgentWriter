import type { Meta, StoryObj } from '@storybook/react'
import { Slider } from './Slider'

const meta: Meta<typeof Slider> = {
  title: 'v2/Slider',
  component: Slider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    min: { control: { type: 'number' } },
    max: { control: { type: 'number' } },
    step: { control: { type: 'number' } },
    disabled: { control: { type: 'boolean' } },
    label: { control: { type: 'text' } },
    showValue: { control: { type: 'boolean' } },
  },
}

export default meta
type Story = StoryObj<typeof Slider>

export const Default: Story = {
  args: {
    value: 50,
    label: '强度',
    showValue: true,
  },
}

export const Disabled: Story = {
  args: {
    value: 30,
    disabled: true,
    label: '已禁用',
    showValue: true,
  },
}

export const WithStep: Story = {
  args: {
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.1,
    label: '精细调节',
    showValue: true,
  },
}
