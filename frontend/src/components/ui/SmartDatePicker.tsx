import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Props {
  // ISO YYYY-MM-DD or empty string for none.
  value: string
  onChange: (next: string) => void
  // Short visible label when no value is set.
  placeholder?: string
  // Disabled inputs render greyed out + non-interactive.
  disabled?: boolean
  ariaLabel?: string
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromIso(s: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// "This Friday" — next occurrence of Friday from today (skipping today
// if today is Friday — go a week out so it's never "in 0 days").
function nextFriday(): Date {
  const today = startOfDay(new Date())
  const dayOfWeek = today.getDay() // 0=Sun..6=Sat
  const target = 5 // Fri
  let offset = (target - dayOfWeek + 7) % 7
  if (offset === 0) offset = 7
  return addDays(today, offset)
}

function formatFriendly(d: Date | null): string {
  if (!d) return ''
  const today = startOfDay(new Date())
  const target = startOfDay(d)
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff <= 7) {
    return d.toLocaleDateString(undefined, { weekday: 'long' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: target.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

export default function SmartDatePicker({ value, onChange, placeholder = 'Pick a date', disabled, ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<Date>(() => fromIso(value) || new Date())
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setView(fromIso(value) || new Date())
  }, [value])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const today = startOfDay(new Date())
  const chips = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'This Friday', date: nextFriday() },
    { label: 'Next week', date: addDays(today, 7) },
    { label: 'In 2 weeks', date: addDays(today, 14) },
  ]

  const valueDate = fromIso(value)
  const display = valueDate ? formatFriendly(valueDate) : placeholder

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-label={ariaLabel || 'Pick a date'}
        aria-expanded={open}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm transition hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:border-gray-500 ${
          valueDate ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'
        }`}
      >
        <Calendar className="h-3.5 w-3.5 text-gray-400" />
        <span>{display}</span>
      </button>

      {valueDate && !disabled && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear date"
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-3 flex flex-wrap gap-1">
            {chips.map((c) => (
              <button
                key={c.label}
                onClick={() => {
                  onChange(toIso(c.date))
                  setOpen(false)
                }}
                className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-blue-900/30 dark:hover:text-blue-200"
              >
                {c.label}
              </button>
            ))}
          </div>
          <MonthGrid
            view={view}
            value={valueDate}
            onPrev={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            onNext={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            onPick={(d) => {
              onChange(toIso(d))
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

function MonthGrid({
  view,
  value,
  onPrev,
  onNext,
  onPick,
}: {
  view: Date
  value: Date | null
  onPrev: () => void
  onNext: () => void
  onPick: (d: Date) => void
}) {
  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1)
    // Start the grid on Sunday — handles month starts mid-week with blanks.
    const offset = first.getDay()
    const grid: (Date | null)[] = []
    for (let i = 0; i < offset; i++) grid.push(null)
    const last = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
    for (let d = 1; d <= last; d++) grid.push(new Date(view.getFullYear(), view.getMonth(), d))
    // Pad to a full final row.
    while (grid.length % 7 !== 0) grid.push(null)
    return grid
  }, [view])

  const today = startOfDay(new Date())
  const dow = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous month"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          {view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </div>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next month"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {dow.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {days.map((d, i) =>
          d === null ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => onPick(d)}
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                value && d.toDateString() === value.toDateString()
                  ? 'bg-blue-600 font-semibold text-white'
                  : d.toDateString() === today.toDateString()
                    ? 'font-semibold text-blue-600 ring-1 ring-blue-300 dark:text-blue-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {d.getDate()}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
