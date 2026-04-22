import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import DataExplorer from './pages/DataExplorer'
import Visualizer from './pages/Visualizer'
import Reports from './pages/Reports'
import Home from './pages/Home'
import AIInsights from './pages/Aiinsights'
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
              <Route path="dashboard" element={<LandingPage />} />
              <Route path="data-explorer" element={<DataExplorer />} />
              <Route path="visualizer" element={<Visualizer />} />
              <Route path="reports" element={<Reports />} />
              <Route path="ai-insights" element={<AIInsights />} />
            </Route>
          </Routes>
        </AnimatePresence>
      </DatasetProvider>
    </AuthProvider>
  )
}

export default App
