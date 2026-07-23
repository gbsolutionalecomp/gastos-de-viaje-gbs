export const metadata = { 
  title: 'Gastos de Viaje — SECOVI', 
  description: 'Sistema de gestión de viáticos y reembolsos' 
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, background: '#F3F4FA' }}>
        {children}
      </body>
    </html>
  )
}
