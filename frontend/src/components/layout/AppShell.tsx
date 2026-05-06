import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import KeyboardShortcutsHelp from '../ui/KeyboardShortcutsHelp'
import { useHotkey, useHotkeySequence } from '@/hooks/useHotkeys'

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const navigate = useNavigate()

  useHotkey('?', () => setHelpOpen((v) => !v))
  useHotkeySequence(['g', 'd'], () => navigate('/dashboard'))

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      {/* Sidebar visible at md+, hidden + slide-in drawer on smaller */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform md:static md:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main id="main-content" className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>
      </div>
      <KeyboardShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
