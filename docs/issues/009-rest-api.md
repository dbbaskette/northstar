# Document and stabilize a public REST API

## Problem
Northstar already has REST endpoints, but they are undocumented and authenticated only via session JWT. External scripts and integrations can't talk to it without a long-lived token mechanism.

## Acceptance criteria
- [ ] User can create personal API tokens with name + scopes from settings page
- [ ] Tokens stored as SHA-256 hashes; raw token shown only at creation
- [ ] API accepts `Authorization: Bearer <token>` for any user-scoped endpoint
- [ ] OpenAPI 3.1 spec generated/maintained at `/api/openapi.json`
- [ ] Rate limiting per token
- [ ] Token last-used timestamp + revoke action

## Implementation notes
- DB: `api_tokens(id, user_id, name, token_hash, scopes_json, last_used_at, expires_at NULL, created_at)`
- Backend: extend auth middleware to accept tokens; new handler under `/auth/tokens`
- Tooling: generate spec from chi routes via `swaggo/swag` or hand-written

<!-- labels: P0,feature,backend,area:platform -->
