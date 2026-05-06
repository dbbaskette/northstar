# Render Markdown in descriptions and comments

## Problem
Today, descriptions and comments are plain text. Users want headings, lists, code blocks, links, and inline images — without learning a custom syntax.

## Acceptance criteria
- [ ] Card descriptions and comments accept GitHub-flavored Markdown
- [ ] Rendered output is sanitized (no script injection)
- [ ] Editor offers a preview tab and basic formatting toolbar
- [ ] Code blocks have language-aware highlighting
- [ ] Links are auto-linkified
- [ ] @mentions (issue 006) render as styled pills inside Markdown

## Implementation notes
- Frontend: TipTap or Lexical with markdown serializer + `rehype-sanitize`
- Backend: stores raw Markdown; frontend renders. No DB change.
- Consider: image paste paste-and-upload (depends on issue 002 attachments)

<!-- labels: P0,feature,frontend,area:cards -->
