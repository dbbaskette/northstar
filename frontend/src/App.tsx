import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import BoardPage from './pages/BoardPage'
import ProfilePage from './pages/ProfilePage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import AdminAuditLogPage from './pages/AdminAuditLogPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminPluginsPage from './pages/AdminPluginsPage'
import SecurityPage from './pages/SecurityPage'
import AppShell from './components/layout/AppShell'
import ProtectedRoute from './components/auth/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invites/:token" element={<AcceptInvitePage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/boards/:boardId" element={<BoardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/plugins" element={<AdminPluginsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
