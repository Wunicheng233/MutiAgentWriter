import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
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
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-secondary">StoryForge AI</p>
        <p className="text-base text-inkwell">正在加载工作台...</p>
      </div>
    </div>
  )
}

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
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
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={
                  <ProtectedPage>
                    <Dashboard />
                  </ProtectedPage>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedPage>
                    <Dashboard />
                  </ProtectedPage>
                }
              />
              <Route
                path="/projects/new"
                element={
                  <ProtectedPage>
                    <CreateProject />
                  </ProtectedPage>
                }
              />
              <Route
                path="/projects/:id/overview"
                element={
                  <ProtectedPage>
                    <ProjectOverview />
                  </ProtectedPage>
                }
              />
              <Route
                path="/projects/:id/chapters"
                element={
                  <ProtectedPage>
                    <ChapterList />
                  </ProtectedPage>
                }
              />
              <Route
                path="/projects/:id/workflows/:runId"
                element={
                  <ProtectedPage>
                    <WorkflowRunDetail />
                  </ProtectedPage>
                }
              />
              <Route
                path="/projects/:id/artifacts/:artifactId"
                element={
                  <ProtectedPage>
                    <ArtifactDetail />
                  </ProtectedPage>
                }
              />
              <Route
                path="/projects/:id/write/:chapterIndex"
                element={
                  <ProtectedPage>
                    <Editor />
                  </ProtectedPage>
                }
              />
              <Route
                path="/projects/:id/read/:chapterIndex"
                element={
                  <ProtectedPage>
                    <Reader />
                  </ProtectedPage>
                }
              />
              <Route
                path="/projects/:id/analytics"
                element={
                  <ProtectedPage>
                    <QualityDashboard />
                  </ProtectedPage>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedPage>
                    <Settings />
                  </ProtectedPage>
                }
              />
              <Route path="/share/:token" element={<ShareView />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
