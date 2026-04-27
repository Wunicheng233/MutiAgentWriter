import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '../Button/Button'
import { Popover, PopoverTrigger, PopoverContent } from './Popover'

const meta: Meta<typeof Popover> = {
  title: 'v2/Popover',
  component: Popover,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Popover>

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger>
        <Button variant="secondary">点击打开</Button>
      </PopoverTrigger>
      <PopoverContent>
        <h4 className="font-medium mb-2">弹出框标题</h4>
        <p className="text-sm text-[var(--text-secondary)]">
          这是一个弹出框的内容，您可以放置任意内容在这里。
        </p>
      </PopoverContent>
    </Popover>
  ),
}

export const TopPosition: Story = {
  render: () => (
    <div className="mt-20">
      <Popover>
        <PopoverTrigger>
          <Button variant="secondary">上方弹出</Button>
        </PopoverTrigger>
        <PopoverContent side="top">
          <p className="text-sm">从上方弹出的内容</p>
        </PopoverContent>
      </Popover>
    </div>
  ),
}

export const LeftPosition: Story = {
  render: () => (
    <div className="ml-40">
      <Popover>
        <PopoverTrigger>
          <Button variant="secondary">左侧弹出</Button>
        </PopoverTrigger>
        <PopoverContent side="left">
          <p className="text-sm">从左侧弹出的内容</p>
        </PopoverContent>
      </Popover>
    </div>
  ),
}

export const RightPosition: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger>
        <Button variant="secondary">右侧弹出</Button>
      </PopoverTrigger>
      <PopoverContent side="right">
        <p className="text-sm">从右侧弹出的内容</p>
      </PopoverContent>
    </Popover>
  ),
}
