import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function Header() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <span className="text-sm text-gray-600">{user.displayName}</span>
        )}
        <button
          onClick={logout}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
