# Rate limiting and abuse protection

## Problem
There is no rate limiting on auth endpoints, comment creation, or API tokens. Even for an internal tool, a misconfigured script can hammer the server.

## Acceptance criteria
- [ ] Rate limit on `/auth/login` and `/auth/register`: 10/min per IP, 5/min per email
- [ ] Account lockout after 10 consecutive failed logins (5-minute window)
- [ ] Per-API-token rate limit (default 600 req/min, configurable per token)
- [ ] Standard `X-RateLimit-*` response headers

## Implementation notes
- Backend: middleware using a sliding-window counter; Postgres for low-traffic, Redis if scaled
- DB optional: `rate_limit_buckets(key, window_start, count)`
- Lockout state in `users.locked_until`

<!-- labels: P1,feature,backend,area:platform -->
