import Modal from './Modal'

interface Props {
  open: boolean
  onClose: () => void
}

interface Shortcut {
  keys: string[]
  label: string
}

const GLOBAL: Shortcut[] = [
  { keys: ['?'], label: 'Show this cheat sheet' },
  { keys: ['g', 'd'], label: 'Go to dashboard' },
  { keys: ['Esc'], label: 'Close modal / cancel' },
]

const BOARD: Shortcut[] = [
  { keys: ['f'], label: 'Open filters' },
  { keys: ['⌘', 'K'], label: 'Focus search box (filters)' },
  { keys: ['n'], label: 'New card on hovered list' },
  { keys: ['c'], label: 'Archive hovered card' },
]

const CARD: Shortcut[] = [
  { keys: ['e'], label: 'Edit description' },
  { keys: ['d'], label: 'Focus due date' },
  { keys: ['l'], label: 'Toggle labels picker' },
  { keys: ['Enter'], label: 'Confirm in form fields' },
]

function Section({ title, items }: { title: string; items: Shortcut[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700 dark:text-gray-200">{s.label}</span>
            <span className="flex items-center gap-1">
              {s.keys.map((k, i) => (
                <kbd
                  key={i}
                  className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function KeyboardShortcutsHelp({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <div className="space-y-5">
        <Section title="Global" items={GLOBAL} />
        <Section title="Board" items={BOARD} />
        <Section title="Card" items={CARD} />
        <p className="border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Shortcuts pause while you're typing in a text field.
        </p>
      </div>
    </Modal>
  )
}
