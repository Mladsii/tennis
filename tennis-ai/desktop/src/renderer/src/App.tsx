import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Login from './pages/Login'
import Layout from './components/Layout'
import CourtGrid from './pages/CourtGrid'
import Players from './pages/Players'
import Trainings from './pages/Trainings'
import Competitions from './pages/Competitions'
import Courts from './pages/Courts'
import Cash from './pages/Cash'
import Subscriptions from './pages/Subscriptions'
import Equipment from './pages/Equipment'
import Queue from './pages/Queue'
import Analytics from './pages/Analytics'
import QRScanner from './pages/QRScanner'
import Reports from './pages/Reports'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="grid" replace />} />
          <Route path="grid" element={<CourtGrid />} />
          <Route path="courts" element={<Courts />} />
          <Route path="players" element={<Players />} />
          <Route path="trainings" element={<Trainings />} />
          <Route path="competitions" element={<Competitions />} />
          <Route path="cash" element={<Cash />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="equipment" element={<Equipment />} />
          <Route path="queue" element={<Queue />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reports" element={<Reports />} />
          <Route path="qr" element={<QRScanner />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
