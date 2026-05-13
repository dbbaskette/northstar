import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  // Either an action OR a submenu of items.
  onClick?: () => void
  submenu?: ContextMenuItem[]
  // Visually demarcate a destructive action.
  danger?: boolean
  // Disabled — shown muted, click is a no-op.
  disabled?: boolean
}

interface Props {
  // Anchored to viewport coordinates from the contextmenu event.
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

// Lightweight contextmenu: positions at (x,y), flips inside viewport,
// closes on outside-click / Esc, and supports one level of submenu
// for "Move to list" / "Set priority" / "Add label".
export default function ContextMenu({ x, y, items, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [submenu, setSubmenu] = useState<{ items: ContextMenuItem[]; top: number; left: number } | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Flip the root menu inside the viewport.
  const [pos, setPos] = useState({ x, y })
  useEffect(() => {
    if (!rootRef.current) return
    const r = rootRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    setPos({
      x: x + r.width > vw - 8 ? vw - r.width - 8 : x,
      y: y + r.height > vh - 8 ? vh - r.height - 8 : y,
    })
  }, [x, y])

  const pick = (it: ContextMenuItem) => {
    if (it.disabled) return
    if (it.submenu) return // handled by hover
    it.onClick?.()
    onClose()
  }

  const openSubmenuFor = (it: ContextMenuItem, btn: HTMLButtonElement) => {
    if (!it.submenu) return setSubmenu(null)
    const r = btn.getBoundingClientRect()
    setSubmenu({ items: it.submenu, top: r.top, left: r.right + 2 })
  }

  return (
    <div
      ref={rootRef}
      role="menu"
      style={{ top: pos.y, left: pos.x }}
      className="fixed z-[90] w-52 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800"
    >
      {items.map((it) =>
        it.id.startsWith('sep:') ? (
          <div key={it.id} className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
        ) : (
          <button
            key={it.id}
            disabled={it.disabled}
            onClick={() => pick(it)}
            onMouseEnter={(e) => openSubmenuFor(it, e.currentTarget)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
              it.disabled
                ? 'cursor-not-allowed text-gray-400'
                : it.danger
                  ? 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {it.icon && <span className="text-gray-400">{it.icon}</span>}
            <span className="flex-1 truncate">{it.label}</span>
            {it.submenu && <ChevronRight className="h-3 w-3 text-gray-400" />}
          </button>
        ),
      )}
      {submenu && (
        <div
          role="menu"
          style={{ top: submenu.top, left: submenu.left }}
          className="fixed z-[91] w-52 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        >
          {submenu.items.map((it) => (
            <button
              key={it.id}
              disabled={it.disabled}
              onClick={() => {
                if (it.disabled) return
                it.onClick?.()
                onClose()
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                it.disabled
                  ? 'cursor-not-allowed text-gray-400'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {it.icon && <span>{it.icon}</span>}
              <span className="flex-1 truncate">{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
