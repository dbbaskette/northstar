import { useState } from 'react'
import { Plug, ChevronDown, ChevronUp } from 'lucide-react'
import { useBoardPlugins } from '@/api/plugins'

interface Props {
  boardId: string
}

// Renders enabled plugins as sandboxed iframes in a stack. The
// sandbox attribute is intentionally restrictive (only allow scripts
// + same-origin denied) until a real postMessage protocol exists.
export default function BoardPluginsPanel({ boardId }: Props) {
  const { data: plugins = [] } = useBoardPlugins(boardId)
  const [openId, setOpenId] = useState<string | null>(null)

  if (plugins.length === 0) return null

  return (
    <div className="space-y-2 border-t border-black/10 bg-white/95 p-3 backdrop-blur dark:bg-gray-800/95">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
        <Plug className="h-3.5 w-3.5" />
        Plugins
      </div>
      {plugins.map((bp) => {
        const p = bp.plugin
        if (!p) return null
        const open = openId === p.id
        return (
          <div
            key={p.id}
            className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <button
              onClick={() => setOpenId(open ? null : p.id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between bg-gray-50 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <span>{p.name}</span>
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {open && (
              <iframe
                title={p.name}
                src={p.iframe_url}
                sandbox="allow-scripts"
                className="block h-72 w-full border-0 bg-white dark:bg-gray-900"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
