# Custom fields per board

## Problem
Different teams track different attributes (story points, customer name, severity). Hard-coded fields force people into a generic shape.

## Acceptance criteria
- [ ] Board admin can define custom fields with type: text, number, date, dropdown, checkbox
- [ ] Each field has a name and optional "show on card front" toggle
- [ ] Fields appear as inputs in the card modal
- [ ] Values are searchable and filterable

## Implementation notes
- DB: `custom_field_defs(id, board_id, name, type, options_json, position, show_on_front)`, `custom_field_values(card_id, field_def_id, value_text, value_number, value_date, value_bool)` with PK on (card_id, field_def_id)
- Backend: routes under `/boards/:id/fields`
- Frontend: `BoardSettings → Custom fields` editor; field rendering in card modal

<!-- labels: P1,feature,backend,frontend,area:cards -->
