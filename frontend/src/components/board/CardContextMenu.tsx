import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  Copy as CopyIcon,
  ExternalLink,
  Eye,
  Flag,
  MoveRight,
  Square,
  Tag,
} from 'lucide-react'
import api from '@/api/client'
import type { Board, BoardCard, CardPriority } from '@/api/boards'
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu'
import { confirmDialog } from '../ui/ConfirmDialog'
import { toast } from '@/lib/toast'
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/cardHelpers'

interface Props {
  card: BoardCard
  board: Board
  pos: { x: number; y: number }
  onOpenCard: () => void
  onClose: () => void
}

export default function CardContextMenu({ card, board, pos, onOpenCard, onClose }: Props) {
  const qc = useQueryClient()

  const refresh = () => qc.invalidateQueries({ queryKey: ['board', board.id] })

  const items = useMemo<ContextMenuItem[]>(() => {
    const cardUrl = `${window.location.origin}/boards/${board.id}?card=${card.id}`

    const moveSubmenu: ContextMenuItem[] = (board.lists || []).map((l) => ({
      id: 'mv:' + l.id,
      label: l.name,
      disabled: l.id === card.list_id,
      onClick: async () => {
        try {
          await api.post(`/cards/${card.id}/move-to`, { target_list_id: l.id })
          toast.success(`Moved to "${l.name}"`)
          refresh()
        } catch {
          toast.error('Could not move card')
        }
      },
    }))

    const prioritySubmenu: ContextMenuItem[] = [
      {
        id: 'p:none',
        label: 'None',
        icon: <Square className="h-3 w-3 text-gray-300" />,
        onClick: async () => {
          await api.patch(`/cards/${card.id}/priority`, { priority: '' })
          toast.success('Priority cleared')
          refresh()
        },
      },
      ...PRIORITY_ORDER.map<ContextMenuItem>((p: CardPriority) => ({
        id: 'p:' + p,
        label: PRIORITY_LABELS[p],
        icon: (
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p] }} />
        ),
        onClick: async () => {
          await api.patch(`/cards/${card.id}/priority`, { priority: p })
          toast.success(`Priority: ${PRIORITY_LABELS[p]}`)
          refresh()
        },
      })),
    ]

    const labelSubmenu: ContextMenuItem[] = (board.labels || []).map((l) => ({
      id: 'lbl:' + l.id,
      label: l.name,
      icon: <span className="h-3 w-3 rounded" style={{ backgroundColor: l.color }} />,
      onClick: async () => {
        try {
          await api.post(`/cards/${card.id}/labels`, { label_id: l.id })
          toast.success(`Added "${l.name}"`)
          refresh()
        } catch {
          toast.error('Could not add label')
        }
      },
    }))

    const out: ContextMenuItem[] = [
      { id: 'open', label: 'Open card', icon: <Eye className="h-3.5 w-3.5" />, onClick: onOpenCard },
      {
        id: 'newtab',
        label: 'Open in new tab',
        icon: <ExternalLink className="h-3.5 w-3.5" />,
        onClick: () => window.open(cardUrl, '_blank', 'noopener,noreferrer'),
      },
      {
        id: 'copy',
        label: 'Copy link',
        icon: <CopyIcon className="h-3.5 w-3.5" />,
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(cardUrl)
            toast.success('Link copied')
          } catch {
            toast.error('Clipboard unavailable')
          }
        },
      },
      { id: 'sep:1', label: '' },
      {
        id: 'move',
        label: 'Move to list',
        icon: <MoveRight className="h-3.5 w-3.5" />,
        submenu: moveSubmenu,
      },
      {
        id: 'prio',
        label: 'Set priority',
        icon: <Flag className="h-3.5 w-3.5" />,
        submenu: prioritySubmenu,
      },
    ]

    if (labelSubmenu.length > 0) {
      out.push({
        id: 'label',
        label: 'Add label',
        icon: <Tag className="h-3.5 w-3.5" />,
        submenu: labelSubmenu,
      })
    }

    out.push({ id: 'sep:2', label: '' })
    out.push({
      id: 'arch',
      label: 'Archive card',
      icon: <Archive className="h-3.5 w-3.5" />,
      danger: true,
      onClick: async () => {
        const ok = await confirmDialog({
          title: `Archive "${card.title}"?`,
          body: 'You can restore from the Archived panel.',
          confirmLabel: 'Archive',
          danger: true,
        })
        if (!ok) return
        try {
          await api.delete(`/cards/${card.id}`)
          toast.success('Card archived')
          refresh()
        } catch {
          toast.error('Could not archive')
        }
      },
    })

    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, card.title, card.list_id, board.id, board.lists, board.labels])

  return <ContextMenu x={pos.x} y={pos.y} items={items} onClose={onClose} />
}
