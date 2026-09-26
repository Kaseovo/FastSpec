# ADR-0006: Auth modes — single-user `none` and generic OIDC

**Status:** Accepted, implemented
**Date:** 2026-09-26

## Context

FastSpec is being open-sourced (see `docs/ROADMAP.md`). Until now the only
way to sign in was Google OAuth, which forces every self-hoster to create a
Google Cloud project, configure a consent screen and register redirect URIs
before seeing the app. That is the single biggest barrier to "run it
locally in one command".

Two audiences need different things:

- **One developer on a laptop** wants no sign-in at all.
- **Teams** usually already have an identity provider (Keycloak, Authentik,
  Okta, Microsoft Entra, GitLab, Google Workspace…) and want to use it.

The hosted version (`fastspec.kaseovo.com`) keeps signing people in with
Google.

## Decision

`AUTH_MODE` selects one of two modes:

- **`none`** (default): single-user mode. The server lazily creates one
  implicit local user (`provider="local"`). `POST /auth/local/session` hands
  the SPA a normal FastSpec JWT for that user, so everything downstream —
  per-user scoping, `get_current_user`, API keys — is unchanged. The SPA
  calls it automatically and silently renews it on 401.
- **`oidc`**: Authorization Code flow with PKCE against any provider that
  publishes discovery metadata (`backend/auth/oidc.py`). Google is just
  `OIDC_ISSUER=https://accounts.google.com`. The provider-specific Google
  code and `POST /auth/google/verify` are removed.

`GET /auth/config` tells the SPA which mode is active.

### Safety rules

1. **No silent fallback to open access.** The server refuses to start when
   the configuration contradicts itself: OIDC_* set while `AUTH_MODE=none`,
   an email allowlist in `none` mode, or `AUTH_MODE=oidc` with missing
   provider settings (`config.py::Settings.validate_auth`). A forgotten
   `AUTH_MODE=oidc` can therefore never leave a public server open.
2. **Accounts are keyed on `(provider, sub)`, never on email.** Email is
   mutable at many providers (the "nOAuth" class of account takeovers), so
   an OIDC sign-in whose email matches an existing account with a different
   `sub` is rejected rather than linked. Existing Google accounts keep
   matching because they were stored with `provider="google"` and the Google
   `sub` — `Settings.oidc_provider_key` keeps the `"google"` key for Google's
   issuer.
3. **ID tokens are fully verified**: signature against the provider's JWKS
   (refetched once on unknown `kid` for key rotation), `iss`, `aud`, `exp`,
   `iat`, `nonce`; only asymmetric algorithms the provider advertises
   (rejecting `none` and `HS*` rules out algorithm confusion).
4. **Allowlist** (`ALLOWED_EMAILS`, `ALLOWED_EMAIL_DOMAINS`): optional, and
   only honoured for emails the provider marks `email_verified: true`.
   Tokens with `email_verified: false` are rejected in every case.
5. `none` mode logs a warning at startup, and the shipped compose file and
   `docker run` examples bind to `127.0.0.1`.

### Sign-in hand-off

The provider redirects to `/auth/oidc/callback`; the backend then redirects
to the SPA route `/specs/auth/callback#token=…` (or `#error=…`). The token
stays in the URL fragment, so it never reaches server logs. The SPA handles
it before vue-router is created, because the router would otherwise put the
callback URL (with the token) back into the address bar.

State, nonce and PKCE verifier travel in one signed, HttpOnly,
`SameSite=Lax`, 10-minute cookie scoped to `/auth`.

### Moving from `none` to `oidc`

`python cli.py transfer-local-data --to EMAIL` (or
`make transfer-local-data EMAIL=…`) moves the local user's specs and lint
rulesets to an account that has signed in once, renaming clashing ruleset
names and revoking the local user's API keys.

## Consequences

- Self-hosters get a working app with zero configuration; teams configure
  three variables for their identity provider.
- The hosted deployment sets `AUTH_MODE=oidc` and
  `OIDC_ISSUER=https://accounts.google.com`. **Its Google OAuth client must
  list `https://<domain>/auth/oidc/callback` as an authorized redirect URI**
  (the old `/auth/google/callback` path no longer exists).
- One provider at a time. The settings shape leaves room for a list later.
- GitHub sign-in isn't covered: GitHub doesn't support OIDC for user
  sign-in, so it would need a dedicated OAuth2 provider (backlog).
- Built-in email/password accounts remain out of scope — OIDC covers teams
  without FastSpec storing passwords.

## Alternatives considered

- **Keep Google-only and add `none`**: would build provider-specific code
  now and generalize it later — the same work twice.
- **Built-in email/password**: sign-up control, password reset (needs SMTP
  or admin tooling) and brute-force protection, all security-sensitive, for
  an audience OIDC already serves.
- **Trusted reverse-proxy header** (oauth2-proxy, Authelia): cheap, but
  anyone reaching the app without the proxy could forge the header. Deferred
  until requested.
