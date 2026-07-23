import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GastoForm } from '@/components/GastoForm'

describe('GastoForm Component', () => {
  it('renders form elements correctly', () => {
    render(<GastoForm usuarioId="user-123" />)
    expect(screen.getByText('Registrar Nuevo Gasto')).toBeInTheDocument()
    expect(screen.getByLabelText('Concepto del Gasto')).toBeInTheDocument()
    expect(screen.getByLabelText('Monto ($ MXN)')).toBeInTheDocument()
  })

  it('shows error validation when concept is too short', async () => {
    render(<GastoForm usuarioId="user-123" />)

    const conceptoInput = screen.getByLabelText('Concepto del Gasto')
    fireEvent.change(conceptoInput, { target: { value: 'A' } })

    const submitBtn = screen.getByRole('button', { name: /guardar gasto/i })
    fireEvent.click(submitBtn)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El concepto debe tener al menos 5 caracteres'
    )
  })

  it('submits valid data when form is filled correctly', () => {
    const handleSub = vi.fn()
    render(<GastoForm usuarioId="user-123" onSubmit={handleSub} />)

    fireEvent.change(screen.getByLabelText('Concepto del Gasto'), {
      target: { value: 'Comida de trabajo con cliente' },
    })
    fireEvent.change(screen.getByLabelText('Monto ($ MXN)'), {
      target: { value: '450' },
    })

    fireEvent.click(screen.getByRole('button', { name: /guardar gasto/i }))

    expect(handleSub).toHaveBeenCalledWith(
      expect.objectContaining({
        concepto: 'Comida de trabajo con cliente',
        monto: 450,
        usuarioId: 'user-123',
      })
    )
  })
})
