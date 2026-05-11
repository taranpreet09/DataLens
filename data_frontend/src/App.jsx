import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import LandingPage from './pages/LandingPage'
import DataExplorer from './pages/DataExplorer'
import Visualizer from './pages/Visualizer'
import Reports from './pages/Reports'
import Home from './pages/Home'
import AIInsights from './pages/Aiinsights'
import StatisticalTests from './pages/StatisticalTests'
import DataQuality from './pages/DataQuality'
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
              <Route path="/signup" element={<SignupLayout />}>
                <Route index element={<SignupStep1 />} />
                <Route path="step2" element={<SignupStep2 />} />
                <Route path="step3" element={<SignupStep3 />} />
              </Route>
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="dashboard" element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />
                <Route path="data-explorer" element={<ErrorBoundary><DataExplorer /></ErrorBoundary>} />
                <Route path="visualizer" element={<ErrorBoundary><Visualizer /></ErrorBoundary>} />
                <Route path="statistical-tests" element={<ErrorBoundary><StatisticalTests /></ErrorBoundary>} />
                <Route path="data-quality" element={<ErrorBoundary><DataQuality /></ErrorBoundary>} />
                <Route path="reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
                <Route path="ai-insights" element={<ErrorBoundary><AIInsights /></ErrorBoundary>} />
              </Route>
            </Routes>
          </AnimatePresence>
        </DatasetProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
