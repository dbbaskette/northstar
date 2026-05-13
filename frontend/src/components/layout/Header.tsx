import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Search, Menu, User as UserIcon, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useMe } from '@/api/users'
import Avatar from '../ui/Avatar'
import ThemeToggle from './ThemeToggle'
import NotificationsBell from './NotificationsBell'
import { useCommandPalette } from '../ui/CommandPalette'

interface HeaderProps {
  onMenuClick?: () => void
}

export default function Header({ onMenuClick }: HeaderProps = {}) {
  const authUser = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { data: me } = useMe()
  const navigate = useNavigate()
  const openPalette = useCommandPalette((s) => s.setOpen)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const user = me
    ? {
        id: me.id,
        display_name: me.display_name,
        email: me.email,
        role: me.role,
        avatar_url: me.avatar_url,
      }
    : authUser
      ? {
          id: authUser.id,
          display_name: authUser.displayName,
          email: authUser.email,
          role: authUser.role,
        }
      : null

  // Cmd-K is owned by CommandPalette globally — Header just exposes
  // a click target.

  // Close the user menu on outside-click. Pointerdown not click so we
  // close before the click bubbles to a Link inside the menu.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const handleSignOut = () => {
    setMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="flex h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white px-3 sm:px-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 md:hidden dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              title="Open menu"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => openPalette(true)}
            aria-label="Open command palette"
            className="flex flex-1 max-w-xs items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 hover:border-gray-300 hover:bg-white sm:flex-none sm:w-72 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-600"
          >
            <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <span className="flex-1 truncate text-left">Jump to a board, search cards…</span>
            <kbd className="hidden rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-500 sm:inline dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationsBell />
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Avatar user={user} size="sm" />
                <span className="hidden text-sm text-gray-700 sm:inline dark:text-gray-200">
                  {user.display_name}
                </span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="border-b border-gray-100 px-3 py-2 text-xs dark:border-gray-700">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {user.display_name}
                    </div>
                    <div className="truncate text-gray-500 dark:text-gray-400">{user.email}</div>
                    {user.role === 'admin' && (
                      <span className="mt-1 inline-block rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                        admin
                      </span>
                    )}
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <UserIcon className="h-4 w-4 text-gray-400" />
                    Profile
                  </Link>
                  <Link
                    to="/security"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <ShieldCheck className="h-4 w-4 text-gray-400" />
                    Security
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <LogOut className="h-4 w-4 text-gray-400" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    </>
  )
}
