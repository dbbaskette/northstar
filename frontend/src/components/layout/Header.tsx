import { useEffect, useState } from 'react'
import { LogOut, Search } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import SearchModal from '../search/SearchModal'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-700 dark:bg-gray-800">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex w-72 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 hover:border-gray-300 hover:bg-white dark:border-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-600"
        >
          <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <span className="flex-1 text-left">Search cards…</span>
          <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
            ⌘K
          </kbd>
        </button>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user && <span className="text-sm text-gray-600 dark:text-gray-300">{user.displayName}</span>}
          <button
            onClick={logout}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
