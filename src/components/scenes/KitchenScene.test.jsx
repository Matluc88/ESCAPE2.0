import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import KitchenScene from './KitchenScene'

describe('KitchenScene', () => {
  it('renders without crashing', () => {
    const mockOnObjectClick = vi.fn()
    const { container } = render(<KitchenScene onObjectClick={mockOnObjectClick} />)
    expect(container).toBeTruthy()
  })

  it('accepts objectStates prop', () => {
    const mockOnObjectClick = vi.fn()
    const objectStates = {
      forno: 'on',
      frigo: 'off',
      cassetto: 'chiuso',
      valvola_gas: 'chiusa',
      finestra: 'aperta'
    }
    const { container } = render(
      <KitchenScene onObjectClick={mockOnObjectClick} objectStates={objectStates} />
    )
    expect(container).toBeTruthy()
  })
})
