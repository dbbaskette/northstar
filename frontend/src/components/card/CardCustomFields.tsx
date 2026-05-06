import { useState } from 'react'
import { Settings, Plus, Trash2, X } from 'lucide-react'
import {
  useCustomFields,
  useCreateCustomField,
  useDeleteCustomField,
  useSetCardCustomValue,
  type CustomFieldType,
} from '@/api/customFields'
import type { CardDetail } from '@/api/cards'

interface Props {
  boardId: string
  cardId: string
  card: CardDetail
}

interface CardValue {
  field_def_id: string
  value_text?: string
  value_number?: number
  value_date?: string
  value_bool?: boolean
}

export default function CardCustomFields({ boardId, cardId, card }: Props) {
  const { data: defs = [] } = useCustomFields(boardId)
  const setVal = useSetCardCustomValue(boardId, cardId)
  const createDef = useCreateCustomField(boardId)
  const deleteDef = useDeleteCustomField(boardId)

  const [showManage, setShowManage] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CustomFieldType>('text')
  const [newOptions, setNewOptions] = useState('')

  const valueByField = new Map<string, CardValue>()
  for (const v of (card as unknown as { custom_fields?: CardValue[] }).custom_fields ?? []) {
    valueByField.set(v.field_def_id, v)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const opts = newType === 'dropdown'
      ? newOptions.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined
    await createDef.mutateAsync({ name: newName.trim(), type: newType, options: opts })
    setNewName('')
    setNewOptions('')
  }

  if (defs.length === 0 && !showManage) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Settings className="h-4 w-4" />
            Custom fields
          </div>
          <button
            onClick={() => setShowManage(true)}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            Add field
          </button>
        </div>
        <div className="text-xs text-gray-400">No custom fields on this board yet.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Settings className="h-4 w-4" />
          Custom fields
        </div>
        <button
          onClick={() => setShowManage(!showManage)}
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          {showManage ? 'Done' : 'Manage'}
        </button>
      </div>

      {defs.length > 0 && (
        <div className="space-y-2">
          {defs.map((def) => {
            const v = valueByField.get(def.id)
            return (
              <div
                key={def.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <div className="w-32 shrink-0 truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                  {def.name}
                </div>
                <div className="flex-1">
                  {def.type === 'text' && (
                    <input
                      type="text"
                      defaultValue={v?.value_text || ''}
                      onBlur={(e) =>
                        setVal.mutate({ fieldId: def.id, value: e.target.value })
                      }
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                  )}
                  {def.type === 'number' && (
                    <input
                      type="number"
                      defaultValue={v?.value_number ?? ''}
                      onBlur={(e) =>
                        setVal.mutate({
                          fieldId: def.id,
                          value: e.target.value === '' ? 0 : parseFloat(e.target.value),
                        })
                      }
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                  )}
                  {def.type === 'date' && (
                    <input
                      type="date"
                      defaultValue={v?.value_date ? v.value_date.split('T')[0] : ''}
                      onChange={(e) =>
                        setVal.mutate({
                          fieldId: def.id,
                          value: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : '',
                        })
                      }
                      className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                  )}
                  {def.type === 'checkbox' && (
                    <input
                      type="checkbox"
                      defaultChecked={!!v?.value_bool}
                      onChange={(e) =>
                        setVal.mutate({ fieldId: def.id, value: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  )}
                  {def.type === 'dropdown' && (
                    <select
                      defaultValue={v?.value_text || ''}
                      onChange={(e) =>
                        setVal.mutate({ fieldId: def.id, value: e.target.value })
                      }
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="">—</option>
                      {(def.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {showManage && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete custom field "${def.name}"? Values on all cards will be lost.`)) {
                        deleteDef.mutate(def.id)
                      }
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showManage && (
        <form
          onSubmit={handleAdd}
          className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600"
        >
          <div className="flex-1 min-w-32">
            <label className="mb-0.5 block text-xs text-gray-600 dark:text-gray-400">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              required
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-gray-600 dark:text-gray-400">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as CustomFieldType)}
              className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="checkbox">Checkbox</option>
              <option value="dropdown">Dropdown</option>
            </select>
          </div>
          {newType === 'dropdown' && (
            <div className="flex-1 min-w-40">
              <label className="mb-0.5 block text-xs text-gray-600 dark:text-gray-400">
                Options (comma-separated)
              </label>
              <input
                type="text"
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
                placeholder="low, medium, high"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          )}
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add field
          </button>
        </form>
      )}
    </div>
  )
}

void X
