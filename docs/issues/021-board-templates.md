# Board templates and template gallery

## Problem
Common board structures (Sprint, Editorial, Retro, Bug Tracker) are recreated by every new team. Templates speed up onboarding and standardize practice.

## Acceptance criteria
- [ ] Save existing board as template (with name and description)
- [ ] Built-in template gallery on the "New Board" flow
- [ ] Templates can include lists, labels, custom fields (no cards by default)
- [ ] Optional: include sample cards from the source board

## Implementation notes
- DB: `boards.is_template BOOLEAN`; seed data for built-in templates
- Backend: extend `POST /teams/:id/boards` to accept `template_id`
- Frontend: gallery component on Create Board modal
- Depends on: issue 018 (board copy mechanism)

<!-- labels: P1,feature,backend,frontend,area:boards -->
