import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import DataExplorer from './pages/DataExplorer'
import Visualizer from './pages/Visualizer'
import Reports from './pages/Reports'
import Home from './pages/Home'
import { DatasetProvider } from './context/DatasetContext'
import { AuthProvider } from './context/AuthContext'

import Login from './pages/auth/Login'
import SignupLayout from './pages/auth/SignupLayout'
import SignupStep1 from './pages/auth/SignupStep1'
import SignupStep2 from './pages/auth/SignupStep2'
import SignupStep3 from './pages/auth/SignupStep3'

function AIInsightsPlaceholder() {
  return (
    <div className="p-10 max-w-3xl mx-auto flex flex-col items-center justify-center h-[60vh] text-center gap-6">
      <div className="w-20 h-20 rounded-2xl bg-tertiary/10 flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-headline font-extrabold tracking-tight">AI Insights</h1>
        <p className="text-on-surface-variant text-lg max-w-md">This feature is under development and will be available in a future update.</p>
      </div>
      <span className="px-4 py-2 rounded-full bg-tertiary/10 text-tertiary text-xs font-bold uppercase tracking-widest">Coming Soon</span>
    </div>
  )
}

function App() {
  const location = useLocation()

  return (
    <AuthProvider>
      <DatasetProvider>
        <AnimatePresence mode="popLayout">
          <Routes location={location}>
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
              <Route path="ai-insights" element={<AIInsightsPlaceholder />} />
            </Route>
          </Routes>
        </AnimatePresence>
      </DatasetProvider>
    </AuthProvider>
  )
}

export default App