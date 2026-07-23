'use client'
import dynamic from 'next/dynamic'
import React from 'react'

const GastosApp = dynamic(() => import('../../gastos_viaje_app'), { ssr: false })

// ErrorBoundary: muestra el error real en pantalla en lugar de página blanca
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'ui-monospace, monospace', background: '#FFF5F5', minHeight: '100vh' }}>
          <h2 style={{ color: '#B4443C' }}>Error en la aplicación</h2>
          <p>Comparte una captura de este mensaje para poder corregirlo:</p>
          <pre style={{ background: '#fff', border: '1px solid #B4443C', borderRadius: 8, padding: 16, whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack?.split('\n').slice(0, 8).join('\n')}
          </pre>
          <button onClick={() => location.reload()} style={{ marginTop: 16, padding: '8px 20px', cursor: 'pointer' }}>
            Recargar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Home() {
  return (
    <ErrorBoundary>
      <GastosApp />
    </ErrorBoundary>
  )
}
