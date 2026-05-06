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

export default function Markdown({ source, className }: Props) {
  const safeHtml = useMemo(() => {
    if (!source) return ''
    const raw = marked.parse(source, { async: false }) as string
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
