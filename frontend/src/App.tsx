import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/v2'
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
const ProjectOutline = lazy(() => import('./pages/ProjectOutline'))
const ProjectExport = lazy(() => import('./pages/ProjectExport'))
const ShareView = lazy(() => import('./pages/ShareView'))
const Reader = lazy(() => import('./components/Reader/index'))
const ComponentShowcase = lazy(() => import('./pages/ComponentShowcase'))
const SkillManagement = lazy(() => import('./pages/SkillManagement'))
const ProjectVersions = lazy(() => import('./pages/ProjectVersions'))
const BiblePage = lazy(() => import('./pages/BiblePage'))

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

function LegacyWriteRedirect() {
  const { id, chapterIndex } = useParams<{ id: string; chapterIndex?: string }>()
  const parsedChapter = chapterIndex ? parseInt(chapterIndex, 10) : 1
  const targetChapter = Number.isNaN(parsedChapter) || parsedChapter < 1 ? 1 : parsedChapter

  return <Navigate to={`/projects/${id}/editor/${targetChapter}`} replace />
}

// Wrapper for protected routes with app layout
function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  )
}

// Export AppRoutes for testing
export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/share/:token" element={<ShareView />} />
        <Route path="/showcase" element={<ComponentShowcase />} />

        {/* Protected routes with unified 3-column layout */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects/new" element={<CreateProject />} />

          {/* Nested project routes with unified prefix */}
          <Route path="/projects/:id/*" element={<Outlet />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<ProjectOverview />} />
            <Route path="chapters" element={<ChapterList />} />
            <Route path="workflows/:runId" element={<WorkflowRunDetail />} />
            <Route path="artifacts/:artifactId" element={<ArtifactDetail />} />
            <Route path="editor" element={<Navigate to="1" replace />} />
            <Route path="editor/:chapterIndex" element={<Editor />} />
            <Route path="write" element={<LegacyWriteRedirect />} />
            <Route path="write/:chapterIndex" element={<LegacyWriteRedirect />} />
            <Route path="read" element={<Navigate to="1" replace />} />
            <Route path="read/:chapterIndex" element={<Reader />} />
            <Route path="analytics" element={<QualityDashboard />} />
            <Route path="outline" element={<ProjectOutline />} />
            <Route path="bible" element={<BiblePage />} />
            <Route path="versions" element={<ProjectVersions />} />
            <Route path="export" element={<ProjectExport />} />
            <Route path="skills" element={<SkillManagement />} />
          </Route>

          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
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
          <AppRoutes />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
