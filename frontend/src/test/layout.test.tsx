import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThreeColumnLayout } from '../components/layout/ThreeColumnLayout'
import { BrowserRouter } from 'react-router-dom'

describe('Three Column Layout', () => {
  it('should render all three layout regions', () => {
    render(
      <BrowserRouter>
        <ThreeColumnLayout
          nav={<div data-testid="nav-rail" />}
          canvas={<div data-testid="canvas" />}
          rightPanel={<div data-testid="right-panel" />}
        />
      </BrowserRouter>
    )
    expect(screen.getByTestId('nav-rail')).toBeTruthy()
    expect(screen.getByTestId('canvas')).toBeTruthy()
    expect(screen.getByTestId('right-panel')).toBeTruthy()
  })
})
