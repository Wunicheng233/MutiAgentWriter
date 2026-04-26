import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from './Modal'
import { Button } from '../Button'

const meta: Meta<typeof Modal> = {
  title: 'v2/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Modal>

const ModalWithState = (args: any) => {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <ModalHeader>Modal Title</ModalHeader>
        <ModalContent>
          <p>This is the modal content. You can put anything here!</p>
        </ModalContent>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={() => setIsOpen(false)}>Confirm</Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export const Default: Story = {
  render: (args) => <ModalWithState {...args} />,
  args: {
    size: 'md',
    showCloseButton: true,
  },
}

export const Small: Story = {
  render: (args) => <ModalWithState {...args} />,
  args: {
    size: 'sm',
  },
}

export const Large: Story = {
  render: (args) => <ModalWithState {...args} />,
  args: {
    size: 'lg',
  },
}

export const ExtraLarge: Story = {
  render: (args) => <ModalWithState {...args} />,
  args: {
    size: 'xl',
  },
}

export const FullWidth: Story = {
  render: (args) => <ModalWithState {...args} />,
  args: {
    size: 'full',
  },
}

export const WithoutCloseButton: Story = {
  render: (args) => <ModalWithState {...args} />,
  args: {
    showCloseButton: false,
  },
}

export const LongContent: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false)
    return (
      <div>
        <Button onClick={() => setIsOpen(true)}>Open Long Modal</Button>
        <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} size="lg">
          <ModalHeader>Long Content Modal</ModalHeader>
          <ModalContent>
            {Array.from({ length: 20 }).map((_, i) => (
              <p key={i} className="mb-4">
                This is paragraph {i + 1} of very long content. The modal should scroll naturally
                when content exceeds the viewport height.
              </p>
            ))}
          </ModalContent>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={() => setIsOpen(false)}>Confirm</Button>
          </ModalFooter>
        </Modal>
      </div>
    )
  },
}
