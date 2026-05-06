# Northstar — Feature Backlog

46 issues benchmarking Northstar against Trello, derived from a feature gap analysis (May 2026).

Each `.md` in this directory is a self-contained issue. To push them all to GitHub, run [`./create-issues.sh`](./create-issues.sh) from this directory.

## Already shipped (not in this list)
Workspaces/teams • role-based access (owner/admin/member/viewer) • boards with custom backgrounds • lists with reorder • cards with cross-list drag-and-drop • card title/description/due date/priority/completion • board-scoped labels • comments • assignees • activity log • real-time WebSocket updates • JWT auth with register/login • single-binary deploy with embedded frontend.

## P0 — Must have (15)
| # | Title |
|---|-------|
| 001 | [Add card checklists](./001-card-checklists.md) |
| 002 | [Add card attachments (files + URLs)](./002-card-attachments.md) |
| 003 | [Archive cards and lists with restore](./003-archive-cards-and-lists.md) |
| 004 | [Add global search across cards and boards](./004-global-search.md) |
| 005 | [Add advanced board filters](./005-board-filters.md) |
| 006 | [Add @mentions in comments and descriptions](./006-mentions.md) |
| 007 | [Build a notifications system](./007-notifications-system.md) |
| 008 | [Add board invitations via link or email](./008-board-invitations.md) |
| 009 | [Document and stabilize a public REST API](./009-rest-api.md) |
| 010 | [Render Markdown in descriptions and comments](./010-markdown-rich-text.md) |
| 011 | [Make the app fully mobile responsive](./011-mobile-responsive.md) |
| 012 | [Add dark mode](./012-dark-mode.md) |
| 013 | [User profiles with avatar uploads](./013-user-profiles-avatars.md) |
| 014 | [Add per-board permissions and visibility](./014-board-permissions.md) |
| 015 | [Automated database backups and restore runbook](./015-automated-backups.md) |

## P1 — Should have (21)
| # | Title |
|---|-------|
| 016 | [Card cover images](./016-card-cover-images.md) |
| 017 | [Copy and move cards across lists/boards](./017-copy-move-cards.md) |
| 018 | [Copy lists and boards](./018-copy-lists-boards.md) |
| 019 | [Add emoji reactions on comments](./019-comment-reactions.md) |
| 020 | [Custom fields per board](./020-custom-fields.md) |
| 021 | [Board templates and template gallery](./021-board-templates.md) |
| 022 | [Calendar view](./022-calendar-view.md) |
| 023 | [Automation rules (Trello Butler equivalent)](./023-automation-rules.md) |
| 024 | [Card / list / board watching](./024-card-watching.md) |
| 025 | [Due-date reminders](./025-due-date-reminders.md) |
| 026 | [Outgoing webhooks](./026-webhooks.md) |
| 027 | [Slack integration](./027-slack-integration.md) |
| 028 | [iCalendar feed for due dates](./028-ical-feed.md) |
| 029 | [Keyboard shortcuts](./029-keyboard-shortcuts.md) |
| 030 | [Meet WCAG 2.2 AA accessibility](./030-accessibility-wcag-aa.md) |
| 031 | [Workspace-level audit logs](./031-audit-logs.md) |
| 032 | [Data export per board and per workspace](./032-data-export.md) |
| 033 | [SSO via SAML / OIDC](./033-sso-saml-oidc.md) |
| 034 | [Admin user management](./034-admin-user-management.md) |
| 035 | [Session management and 2FA](./035-sessions-2fa.md) |
| 036 | [Rate limiting and abuse protection](./036-rate-limiting.md) |

## P2 — Nice to have (10)
| # | Title |
|---|-------|
| 037 | [Stale card / age indicator](./037-card-age-indicator.md) |
| 038 | [Saved board views](./038-saved-board-views.md) |
| 039 | [Timeline / Gantt view](./039-timeline-gantt-view.md) |
| 040 | [Dashboard / reports view](./040-dashboard-reports.md) |
| 041 | [Card voting](./041-card-voting.md) |
| 042 | [Card relationships (linked / duplicates)](./042-card-relationships.md) |
| 043 | [Real-time card presence indicators](./043-card-presence.md) |
| 044 | [Typing indicators in comments](./044-typing-indicators.md) |
| 045 | [Email-to-card (inbound email)](./045-email-to-card.md) |
| 046 | [Plugin / Power-Up framework](./046-power-up-framework.md) |

## Suggested first sprint
Pick a slice of P0 that delivers user-visible value end-to-end:

1. **Mobile + dark mode + Markdown** (011, 012, 010) — UX foundations, no new domain models
2. **Search + filters** (004, 005) — instantly useful on day one of having cards
3. **Checklists + archive + attachments** (001, 003, 002) — the three most-noticed missing card features

Then unblock multi-team usage: **invitations + per-board permissions + notifications + mentions + REST API** (008, 014, 007, 006, 009).

## Issue file format
Each file uses this structure so [`create-issues.sh`](./create-issues.sh) can post it to GitHub:

```markdown
# Issue title (used as GitHub title)

Body content...

<!-- labels: P0,feature,backend,frontend -->
```
