import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal, ModalHeader, ModalContent, ModalFooter } from './Modal'

describe('Modal', () => {
  beforeEach(() => {
    // Reset body classes before each test
    document.body.className = ''
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render children when isOpen is false', () => {
    render(<Modal isOpen={false}>Modal Content</Modal>)
    expect(screen.queryByText(/Modal Content/i)).not.toBeInTheDocument()
  })

  it('renders children when isOpen is true', () => {
    render(<Modal isOpen={true}>Modal Content</Modal>)
    expect(screen.getByText(/Modal Content/i)).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Modal isOpen={true} onClose={onClose}>Content</Modal>)

    await user.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when clicking content area', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Modal isOpen={true} onClose={onClose}>Content</Modal>)

    await user.click(screen.getByTestId('modal-content'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn()
    render(<Modal isOpen={true} onClose={onClose}>Content</Modal>)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('applies correct size class', () => {
    const { rerender } = render(<Modal isOpen={true} size="sm">Small</Modal>)
    expect(screen.getByTestId('modal-content').parentElement).toHaveClass(/max-w-sm/)

    rerender(<Modal isOpen={true} size="lg">Large</Modal>)
    expect(screen.getByTestId('modal-content').parentElement).toHaveClass(/max-w-2xl/)
  })

  it('renders ModalHeader correctly', () => {
    render(
      <Modal isOpen={true}>
        <ModalHeader>Modal Title</ModalHeader>
      </Modal>
    )
    expect(screen.getByText(/Modal Title/i)).toBeInTheDocument()
  })

  it('renders ModalContent correctly', () => {
    render(
      <Modal isOpen={true}>
        <ModalContent>Modal Body Content</ModalContent>
      </Modal>
    )
    expect(screen.getByText(/Modal Body Content/i)).toBeInTheDocument()
  })

  it('renders ModalFooter correctly', () => {
    render(
      <Modal isOpen={true}>
        <ModalFooter>Modal Footer</ModalFooter>
      </Modal>
    )
    expect(screen.getByText(/Modal Footer/i)).toBeInTheDocument()
  })

  it('renders close button when showCloseButton is true', () => {
    render(<Modal isOpen={true} showCloseButton={true}>Content</Modal>)
    expect(screen.getByTestId('modal-close-button')).toBeInTheDocument()
  })

  it('does not render close button when showCloseButton is false', () => {
    render(<Modal isOpen={true} showCloseButton={false}>Content</Modal>)
    expect(screen.queryByTestId('modal-close-button')).not.toBeInTheDocument()
  })
})
