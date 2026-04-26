import type { Meta, StoryObj } from '@storybook/react'
import { Tooltip } from './Tooltip'
import { Button } from '../Button'

const meta: Meta<typeof Tooltip> = {
  title: 'v2/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  argTypes: {
    position: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
    },
    delay: {
      control: 'number',
    },
  },
}

export default meta
type Story = StoryObj<typeof Tooltip>

export const Default: Story = {
  args: {
    content: 'This is a tooltip',
    children: <Button>Hover me</Button>,
  },
}

export const Top: Story = {
  args: {
    content: 'Tooltip on top',
    position: 'top',
    children: <Button>Top Position</Button>,
  },
}

export const Right: Story = {
  args: {
    content: 'Tooltip on right',
    position: 'right',
    children: <Button>Right Position</Button>,
  },
}

export const Bottom: Story = {
  args: {
    content: 'Tooltip on bottom',
    position: 'bottom',
    children: <Button>Bottom Position</Button>,
  },
}

export const Left: Story = {
  args: {
    content: 'Tooltip on left',
    position: 'left',
    children: <Button>Left Position</Button>,
  },
}

export const LongContent: Story = {
  args: {
    content: 'This is a tooltip with much longer content that should still look good',
    children: <Button>Long Tooltip</Button>,
  },
}

export const AllPositions: Story = {
  render: () => (
    <div className="flex items-center justify-center gap-8 p-24">
      <Tooltip content="Top" position="top">
        <Button variant="secondary">Top</Button>
      </Tooltip>
      <Tooltip content="Right" position="right">
        <Button variant="secondary">Right</Button>
      </Tooltip>
      <Tooltip content="Bottom" position="bottom">
        <Button variant="secondary">Bottom</Button>
      </Tooltip>
      <Tooltip content="Left" position="left">
        <Button variant="secondary">Left</Button>
      </Tooltip>
    </div>
  ),
}
