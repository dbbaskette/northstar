import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({
  gfm: true,
  breaks: true,
})

interface Props {
  source: string
  className?: string
}

// Allowlist of HTML tags + attributes the Markdown renderer may produce.
// DOMPurify strips everything else, including <script>, on:* event attrs,
// and javascript: URIs, so card descriptions and comments cannot inject
// arbitrary HTML.
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr', 'strong', 'em', 'del', 's', 'u',
    'a', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'input',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'span', 'div',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'class', 'type', 'checked', 'disabled'],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel|#):/i,
}

// Highlight @username tokens before Markdown parsing so they survive
// through `marked` and `DOMPurify`.
const MENTION_RE = /(^|[^\w@])@([a-zA-Z0-9_]+)/g

function highlightMentions(source: string): string {
  return source.replace(MENTION_RE, (_match, prefix, username) => {
    return `${prefix}<span class="northstar-mention">@${username}</span>`
  })
}

export default function Markdown({ source, className }: Props) {
  const safeHtml = useMemo(() => {
    if (!source) return ''
    const withMentions = highlightMentions(source)
    const raw = marked.parse(withMentions, { async: false }) as string
    return DOMPurify.sanitize(raw, PURIFY_CONFIG)
  }, [source])

  if (!source) return null

  return (
    <div
      className={`prose-northstar ${className || ''}`}
      // Sanitized above with DOMPurify — see PURIFY_CONFIG
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}
