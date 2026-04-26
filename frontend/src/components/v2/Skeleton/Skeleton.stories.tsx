import type { Meta, StoryObj } from '@storybook/react'
import { Skeleton, SkeletonCard, SkeletonParagraph } from './Skeleton'

const meta: Meta<typeof Skeleton> = {
  title: 'v2/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['text', 'circle', 'rect'],
    },
    animation: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof Skeleton>

export const Text: Story = {
  args: {
    variant: 'text',
    count: 3,
  },
}

export const TextWithLastLine: Story = {
  args: {
    variant: 'text',
    count: 4,
    lastLineWidth: '60%',
  },
}

export const Circle: Story = {
  args: {
    variant: 'circle',
    width: 40,
    height: 40,
  },
}

export const Rect: Story = {
  args: {
    variant: 'rect',
    width: 200,
    height: 100,
  },
}

export const WithoutAnimation: Story = {
  args: {
    variant: 'text',
    count: 3,
    animation: false,
  },
}

export const CardSkeleton: Story = {
  render: () => (
    <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] w-64">
      <SkeletonCard lines={3} />
    </div>
  ),
}

export const ParagraphSkeleton: Story = {
  render: () => (
    <div className="max-w-lg">
      <SkeletonParagraph lines={5} />
    </div>
  ),
}

export const ProfileCard: Story = {
  render: () => (
    <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-4 max-w-sm">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton variant="circle" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      <Skeleton variant="rect" height={150} />
    </div>
  ),
}
