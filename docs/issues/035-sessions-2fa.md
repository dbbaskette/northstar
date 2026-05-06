# Session management and 2FA

## Problem
JWT auth is stateless; users have no way to see active sessions or revoke a stolen token. 2FA is a baseline expectation for any internal tool with meaningful data.

## Acceptance criteria
- [ ] Per-user list of active sessions (device, IP, last seen) with revoke
- [ ] Revoking a session immediately invalidates its access token
- [ ] TOTP-based 2FA setup with QR code and recovery codes
- [ ] Login flow prompts for TOTP if enabled
- [ ] Recovery codes single-use; viewable once at generation

## Implementation notes
- DB: `sessions(id, user_id, jti, ip, user_agent, created_at, last_seen_at, revoked_at NULL)`, `user_2fa(user_id, totp_secret_encrypted, recovery_codes_hashed JSONB, enabled_at)`
- Backend: revocation needs JTI tracking — switch refresh tokens to require valid session row
- Frontend: `SecuritySettings.tsx`

<!-- labels: P1,feature,backend,frontend,area:auth -->
