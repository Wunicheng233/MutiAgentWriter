import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './store/useAuthStore'
import { useEffect } from 'react'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import CreateProject from './pages/CreateProject'
import ProjectOverview from './pages/ProjectOverview'
import ChapterList from './pages/ChapterList'
import Editor from './pages/Editor'
import QualityDashboard from './pages/QualityDashboard'
import ShareView from './pages/ShareView'
import Reader from './components/Reader/index';

import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
})

function App() {
  const initializeAuth = useAuthStore(state => state.initializeAuth)

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/new"
              element={
                <ProtectedRoute>
                  <CreateProject />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/overview"
              element={
                <ProtectedRoute>
                  <ProjectOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/chapters"
              element={
                <ProtectedRoute>
                  <ChapterList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/write/:chapterIndex"
              element={
                <ProtectedRoute>
                  <Editor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/read/:chapterIndex"
              element={
                <ProtectedRoute>
                  <Reader />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/analytics"
              element={
                <ProtectedRoute>
                  <QualityDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            {/* 分享链接不需要登录 */}
            <Route path="/share/:token" element={<ShareView />} />
          </Routes>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
