import React from 'react'

interface LayoutProps {
  children: React.ReactNode
}

// Simplified Layout - only wraps children
// NavBar is now integrated into AppLayout for protected routes
// This Layout is kept for backward compatibility and used by pages that need a simple container
export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return <>{children}</>
}

export default Layout
