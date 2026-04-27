import type { Meta, StoryObj } from '@storybook/react'
import { Avatar, AvatarGroup } from './Avatar'

const meta: Meta<typeof Avatar> = {
  title: 'v2/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Avatar>

export const Default: Story = {
  args: {
    children: 'AB',
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'SM',
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'LG',
  },
}

export const WithImage: Story = {
  args: {
    src: 'https://picsum.photos/200/200',
    alt: 'User avatar',
  },
}

export const AvatarGroupStory: StoryObj<typeof AvatarGroup> = {
  render: () => (
    <AvatarGroup max={3}>
      <Avatar>A1</Avatar>
      <Avatar>A2</Avatar>
      <Avatar>A3</Avatar>
      <Avatar>A4</Avatar>
      <Avatar>A5</Avatar>
    </AvatarGroup>
  ),
  name: 'AvatarGroup',
}
