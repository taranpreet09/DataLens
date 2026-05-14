import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import LandingPage from './pages/LandingPage'
import Home from './pages/Home'
import Workspace from './pages/Workspace'
import AIInsights from './pages/Aiinsights'
import Reports from './pages/Reports'
import SharedReport from './pages/SharedReport'
import DatasetComparison from './pages/DatasetComparison'
import { DatasetProvider } from './context/DatasetContext'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/auth/Login'
import SignupLayout from './pages/auth/SignupLayout'
import SignupStep1 from './pages/auth/SignupStep1'
import SignupStep2 from './pages/auth/SignupStep2'
import SignupStep3 from './pages/auth/SignupStep3'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  const location = useLocation()

  return (
    <ErrorBoundary>
      <AuthProvider>
        <DatasetProvider>
          <AnimatePresence mode="popLayout">
            <Routes location={location} key={location.pathname.split('/')[1] || '/'}>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/shared/:token" element={<SharedReport />} />
              <Route path="/signup" element={<SignupLayout />}>
                <Route index element={<SignupStep1 />} />
                <Route path="step2" element={<SignupStep2 />} />
                <Route path="step3" element={<SignupStep3 />} />
              </Route>
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                {/* Datasets hub — upload + library */}
                <Route path="dashboard" element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />

                {/* Single workspace surface with tabs */}
                <Route path="workspace" element={<ErrorBoundary><Workspace /></ErrorBoundary>} />

                {/* Dataset-scoped but standalone (different interaction models) */}
                <Route path="ai-insights" element={<ErrorBoundary><AIInsights /></ErrorBoundary>} />
                <Route path="reports"     element={<ErrorBoundary><Reports /></ErrorBoundary>} />
                <Route path="compare"     element={<ErrorBoundary><DatasetComparison /></ErrorBoundary>} />

                {/* Back-compat: old per-feature routes redirect into the workspace tab */}
                <Route path="data-explorer"       element={<Navigate to="/workspace?tab=explore"   replace />} />
                <Route path="data-quality"        element={<Navigate to="/workspace?tab=quality"   replace />} />
                <Route path="visualizer"          element={<Navigate to="/workspace?tab=visualize" replace />} />
                <Route path="statistical-tests"   element={<Navigate to="/workspace?tab=tests"     replace />} />
                <Route path="analysis-playground" element={<Navigate to="/workspace?tab=lab"       replace />} />
              </Route>
            </Routes>
          </AnimatePresence>
        </DatasetProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
