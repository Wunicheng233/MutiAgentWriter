import React from 'react'
import NavBar from './NavBar'
import ToastProvider from './Toast'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-parchment">
        <NavBar />
        <main className="max-w-content mx-auto px-4 py-8">
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}

export default Layout
