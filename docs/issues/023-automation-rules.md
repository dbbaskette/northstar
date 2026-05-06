# Automation rules (Trello Butler equivalent)

## Problem
Repetitive board management (move card to Done → mark complete + add label, archive cards completed >30 days ago) is manual. Automation rules eliminate this drudgery.

## Acceptance criteria
- [ ] Per-board rules editor with trigger / conditions / actions
- [ ] Triggers: card moved, label added, due date arrives, scheduled (daily / weekly), card created
- [ ] Actions: move card, add/remove label, mark complete, post comment, set priority, archive
- [ ] Rules can be enabled/disabled
- [ ] Run log visible to board admin with success/failure per execution

## Implementation notes
- DB: `automation_rules(id, board_id, name, trigger_json, conditions_json, actions_json, enabled, created_by, created_at)`, `automation_runs(id, rule_id, status, log_json, ran_at)`
- Backend: rule engine triggered from `service/events.go` for event-based rules; cron worker for scheduled rules
- Frontend: rule editor with structured form (no DSL initially)

<!-- labels: P1,feature,backend,frontend,area:platform -->
