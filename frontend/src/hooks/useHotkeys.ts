import { useEffect, useRef } from 'react'

type Handler = (e: KeyboardEvent) => void

interface Options {
  enabled?: boolean
  // When true, also fire while the user is inside an input/textarea/contenteditable.
  // Default is false — text fields swallow shortcuts so typing isn't hijacked.
  allowInInputs?: boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

function chordKey(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.metaKey) parts.push('meta')
  if (e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

// Single-key (or chord) handler. Combo strings use "+" — e.g. "?", "meta+k",
// "ctrl+k", "shift+/". The raw event key is lowercased, so "/" with shift
// matches "shift+/" (not "?"). For "?" specifically we accept e.key === '?'.
export function useHotkey(combo: string, handler: Handler, opts: Options = {}) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (opts.enabled === false) return
    const want = combo.toLowerCase()
    const onKey = (e: KeyboardEvent) => {
      if (!opts.allowInInputs && isEditableTarget(e.target)) return
      // Special case: "?" — many keyboards require shift+/, so accept either.
      if (want === '?' && e.key === '?') {
        handlerRef.current(e)
        return
      }
      if (chordKey(e) === want) {
        handlerRef.current(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [combo, opts.enabled, opts.allowInInputs])
}

// Two-key sequence (e.g. "g d"). Second key must arrive within `windowMs`
// (default 1500) of the first. Modifier keys reset the buffer so plain
// chords don't accidentally match.
export function useHotkeySequence(
  sequence: [string, string],
  handler: Handler,
  opts: Options & { windowMs?: number } = {},
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (opts.enabled === false) return
    const [first, second] = sequence.map((s) => s.toLowerCase())
    const windowMs = opts.windowMs ?? 1500
    let armedAt: number | null = null

    const onKey = (e: KeyboardEvent) => {
      if (!opts.allowInInputs && isEditableTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) {
        armedAt = null
        return
      }
      const key = e.key.toLowerCase()
      const now = Date.now()
      if (armedAt && now - armedAt <= windowMs && key === second) {
        handlerRef.current(e)
        armedAt = null
        return
      }
      armedAt = key === first ? now : null
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sequence[0], sequence[1], opts.enabled, opts.allowInInputs, opts.windowMs])
}

export const hotkeysBus = {
  emit(name: string, detail?: unknown) {
    window.dispatchEvent(new CustomEvent(`northstar:${name}`, { detail }))
  },
  on<T = unknown>(name: string, fn: (detail: T) => void) {
    const handler = (e: Event) => fn((e as CustomEvent).detail as T)
    window.addEventListener(`northstar:${name}`, handler)
    return () => window.removeEventListener(`northstar:${name}`, handler)
  },
}
