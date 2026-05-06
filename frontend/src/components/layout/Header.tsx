import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Search } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useMe } from '@/api/users'
import Avatar from '../ui/Avatar'
import SearchModal from '../search/SearchModal'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  const authUser = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { data: me } = useMe()
  const [searchOpen, setSearchOpen] = useState(false)

  // Prefer the live profile (avatar updates immediately) over the stale auth user
  const user = me
    ? {
        id: me.id,
        display_name: me.display_name,
        avatar_url: me.avatar_url,
      }
    : authUser
      ? { id: authUser.id, display_name: authUser.displayName }
      : null

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
          {user && (
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Profile"
            >
              <Avatar user={user} size="sm" />
              <span className="text-sm text-gray-700 dark:text-gray-200">{user.display_name}</span>
            </Link>
          )}
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
