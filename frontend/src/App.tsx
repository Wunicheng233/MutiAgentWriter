import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import { useAuthStore } from './store/useAuthStore'
import { Suspense, lazy, useEffect } from 'react'

// Pages
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Settings = lazy(() => import('./pages/Settings'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CreateProject = lazy(() => import('./pages/CreateProject'))
const ProjectOverview = lazy(() => import('./pages/ProjectOverview'))
const ChapterList = lazy(() => import('./pages/ChapterList'))
const WorkflowRunDetail = lazy(() => import('./pages/WorkflowRunDetail'))
const ArtifactDetail = lazy(() => import('./pages/ArtifactDetail'))
const Editor = lazy(() => import('./pages/Editor'))
const QualityDashboard = lazy(() => import('./pages/QualityDashboard'))
const ShareView = lazy(() => import('./pages/ShareView'))
const Reader = lazy(() => import('./components/Reader/index'))

import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
})

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-6 text-center">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">StoryForge AI</p>
        <p className="text-base text-[var(--text-primary)]">正在加载工作台...</p>
      </div>
    </div>
  )
}

// Wrapper for protected routes with app layout
function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  )
}

function App() {
  const initializeAuth = useAuthStore(state => state.initializeAuth)

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/share/:token" element={<ShareView />} />

              {/* Protected routes with unified 3-column layout */}
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects/new" element={<CreateProject />} />
                <Route path="/projects/:id/overview" element={<ProjectOverview />} />
                <Route path="/projects/:id/chapters" element={<ChapterList />} />
                <Route path="/projects/:id/workflows/:runId" element={<WorkflowRunDetail />} />
                <Route path="/projects/:id/artifacts/:artifactId" element={<ArtifactDetail />} />
                <Route path="/projects/:id/write/:chapterIndex" element={<Editor />} />
                <Route path="/projects/:id/read/:chapterIndex" element={<Reader />} />
                <Route path="/projects/:id/analytics" element={<QualityDashboard />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Routes>
          </Suspense>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
