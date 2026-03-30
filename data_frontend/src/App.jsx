import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import DataExplorer from './pages/DataExplorer'
import Visualizer from './pages/Visualizer'
import Reports from './pages/Reports'
import { DatasetProvider } from './context/DatasetContext'

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
  return (
    <DatasetProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path="dashboard" element={<LandingPage />} />
          <Route path="data-explorer" element={<DataExplorer />} />
          <Route path="visualizer" element={<Visualizer />} />
          <Route path="reports" element={<Reports />} />
          <Route path="ai-insights" element={<AIInsightsPlaceholder />} />
        </Route>
      </Routes>
    </DatasetProvider>
  )
}

export default App