import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LoginForm } from '@/components/LoginForm'

describe('LoginForm Component', () => {
  it('renders email and password inputs', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText('Correo Electrónico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
  })

  it('shows error on invalid email', async () => {
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Correo Electrónico'), {
      target: { value: 'invalid-email' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: '123456' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de Inicio de Sesión' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo no válido')
  })

  it('triggers onLogin when validation passes', async () => {
    const handleLogin = vi.fn().mockResolvedValue(undefined)
    render(<LoginForm onLogin={handleLogin} />)

    fireEvent.change(screen.getByLabelText('Correo Electrónico'), {
      target: { value: 'test@gbsolutions.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'secret123' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de Inicio de Sesión' }))

    expect(handleLogin).toHaveBeenCalledWith('test@gbsolutions.com', 'secret123')
  })
})
