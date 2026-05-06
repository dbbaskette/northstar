import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, CheckCircle2, ArrowRight } from 'lucide-react'
import { useSearch, type SearchHit } from '@/api/search'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200)
    return () => clearTimeout(t)
  }, [query])

  const { data, isLoading } = useSearch(debounced)
  const results = data?.results || []

  useEffect(() => {
    setActiveIdx(0)
  }, [debounced])

  // Group by board for display
  const grouped = results.reduce<Record<string, { board: SearchHit; hits: SearchHit[] }>>(
    (acc, hit) => {
      if (!acc[hit.board_id]) acc[hit.board_id] = { board: hit, hits: [] }
      acc[hit.board_id]!.hits.push(hit)
      return acc
    },
    {},
  )

  const handleNavigate = (hit: SearchHit) => {
    onClose()
    navigate(`/boards/${hit.board_id}`)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIdx((i) => Math.min(i + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIdx((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && results[activeIdx]) {
                e.preventDefault()
                handleNavigate(results[activeIdx]!)
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
            placeholder="Search cards across all boards…"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500">
            esc
          </kbd>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {debounced.length < 2 && (
            <div className="p-8 text-center text-sm text-gray-400">
              Type at least 2 characters to search.
            </div>
          )}
          {debounced.length >= 2 && isLoading && (
            <div className="p-6 text-center text-sm text-gray-500">Searching…</div>
          )}
          {debounced.length >= 2 && !isLoading && results.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-400">
              No matches for &ldquo;{debounced}&rdquo;.
            </div>
          )}

          {Object.values(grouped).map((g) => (
            <div key={g.board.board_id} className="border-b border-gray-100 last:border-b-0">
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600">
                <span
                  className="h-3 w-3 rounded"
                  style={{ backgroundColor: g.board.board_background }}
                />
                {g.board.board_name}
                <span className="text-gray-400">·</span>
                <span className="text-gray-400">{g.board.team_name}</span>
              </div>
              {g.hits.map((hit) => {
                const idx = results.indexOf(hit)
                const isActive = idx === activeIdx
                return (
                  <button
                    key={hit.card_id}
                    onClick={() => handleNavigate(hit)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                      isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {hit.is_completed && <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />}
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${hit.is_completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {hit.card_title}
                      </div>
                      {hit.card_description && (
                        <div className="mt-0.5 truncate text-xs text-gray-500">
                          {hit.card_description}
                        </div>
                      )}
                      <div className="mt-0.5 text-xs text-gray-400">in {hit.list_name}</div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-gray-400" />
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-gray-300 bg-white px-1 text-xs">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded border border-gray-300 bg-white px-1 text-xs">↵</kbd> open
            </span>
          </div>
          {results.length > 0 && <div>{results.length} result{results.length === 1 ? '' : 's'}</div>}
        </div>
      </div>
    </div>
  )
}
