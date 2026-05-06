import { useState } from 'react'
import { Link2, Link, X } from 'lucide-react'
import {
  useCardLinks,
  useCreateCardLink,
  useDeleteCardLink,
  type CardLink as CardLinkRow,
  type RelationType,
} from '@/api/cardLinks'
import { useSearch } from '@/api/search'

interface Props {
  cardId: string
}

const RELATION_LABEL: Record<RelationType, { outgoing: string; incoming: string }> = {
  related: { outgoing: 'related to', incoming: 'related to' },
  duplicate: { outgoing: 'duplicate of', incoming: 'duplicated by' },
  blocks: { outgoing: 'blocks', incoming: 'blocked by' },
}

export default function CardLinks({ cardId }: Props) {
  const { data: links = [] } = useCardLinks(cardId)
  const createLink = useCreateCardLink(cardId)
  const deleteLink = useDeleteCardLink(cardId)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [relation, setRelation] = useState<RelationType>('related')
  const { data: searchResults } = useSearch(query)

  const addLink = async (toCardId: string) => {
    await createLink.mutateAsync({ to_card_id: toCardId, relation_type: relation })
    setQuery('')
    setAdding(false)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Link2 className="h-4 w-4" />
          Linked cards
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          {adding ? 'Cancel' : 'Add link'}
        </button>
      </div>

      {adding && (
        <div className="mb-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
          <div className="flex items-center gap-2">
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value as RelationType)}
              aria-label="Relation type"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="related">Related to</option>
              <option value="duplicate">Duplicate of</option>
              <option value="blocks">Blocks</option>
            </select>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards by title…"
              aria-label="Search for a card to link"
              className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
          {query.trim().length >= 2 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 text-xs dark:border-gray-700 dark:bg-gray-800">
              {(searchResults?.results || [])
                .filter((r) => r.card_id !== cardId)
                .slice(0, 12)
                .map((r) => (
                  <li key={r.card_id}>
                    <button
                      onClick={() => addLink(r.card_id)}
                      className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {r.card_title}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {r.board_name} → {r.list_name}
                      </span>
                    </button>
                  </li>
                ))}
              {(searchResults?.results || []).filter((r) => r.card_id !== cardId).length === 0 && (
                <li className="px-2 py-1.5 text-gray-500">No matches.</li>
              )}
            </ul>
          )}
        </div>
      )}

      {links.length === 0 ? (
        <div className="text-xs text-gray-400">No linked cards yet.</div>
      ) : (
        <ul className="space-y-1.5">
          {links.map((l: CardLinkRow) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-center gap-2 truncate">
                <Link className="h-3 w-3 flex-shrink-0 text-gray-400" />
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {RELATION_LABEL[l.relation_type][l.direction]}
                </span>
                <a
                  href={`/boards/${l.other_board_id}`}
                  className="truncate font-medium text-gray-900 hover:underline dark:text-gray-100"
                  title={`${l.other_board_name} → ${l.other_card_title}`}
                >
                  {l.other_card_title}
                </a>
                <span className="truncate text-gray-500">in {l.other_board_name}</span>
              </div>
              <button
                onClick={() => deleteLink.mutate(l.id)}
                aria-label="Remove link"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
