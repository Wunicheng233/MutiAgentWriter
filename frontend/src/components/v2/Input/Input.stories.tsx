import type { Meta, StoryObj } from '@storybook/react'
import { Input, Textarea } from './Input'

const meta: Meta<typeof Input> = {
  title: 'v2/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    status: {
      control: 'radio',
      options: ['default', 'error', 'success'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: {
    placeholder: 'Enter your text here...',
  },
}

export const WithLabel: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'email@example.com',
  },
}

export const WithError: Story = {
  args: {
    label: 'Email',
    status: 'error',
    errorMessage: 'Please enter a valid email address',
    placeholder: 'email@example.com',
    value: 'invalid-email',
  },
}

export const WithPrefix: Story = {
  args: {
    label: 'Website',
    prefix: 'https://',
    placeholder: 'example.com',
  },
}

export const WithSuffix: Story = {
  args: {
    label: 'Username',
    suffix: '@gmail.com',
    placeholder: 'yourname',
  },
}

export const TextareaStory: StoryObj<typeof Textarea> = {
  render: (args) => <Textarea {...args} />,
  args: {
    label: 'Description',
    placeholder: 'Enter a detailed description...',
    rows: 5,
  },
}
