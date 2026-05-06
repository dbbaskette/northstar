import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import BoardPage from './pages/BoardPage'
import AppShell from './components/layout/AppShell'
import ProtectedRoute from './components/auth/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/boards/:boardId" element={<BoardPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
