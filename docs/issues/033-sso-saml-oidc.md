# SSO via SAML / OIDC

## Problem
For 50 internal users, IT will often require SSO with the corporate identity provider (Okta, Google Workspace, Azure AD). Without it, password management is a per-user pain.

## Acceptance criteria
- [ ] Admin can configure an OIDC provider (issuer, client id, secret, default role)
- [ ] Admin can configure a SAML provider (metadata URL or XML, default role)
- [ ] Login page offers "Sign in with SSO"
- [ ] First-time login auto-creates the user with the default role
- [ ] Existing users link via email match

## Implementation notes
- DB: `sso_configs(id, workspace_id, provider, config_json, default_role, enabled)`, `users.external_id`, `users.external_provider`
- Backend: standard OIDC client (e.g., `coreos/go-oidc`), SAML lib (e.g., `crewjam/saml`)
- Follow-up: SCIM provisioning is a P2

<!-- labels: P1,feature,backend,area:auth -->
