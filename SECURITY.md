# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Report them
privately through GitHub instead: go to the repository's **Security** tab
and click **Report a vulnerability**
([direct link](https://github.com/Kaseovo/FastSpec/security/advisories/new)).

Include what you found, how to reproduce it, and the impact you see. You'll
get an acknowledgement within a week. Once a fix is ready, we'll publish a
security advisory and credit you, unless you'd rather stay anonymous.

## Supported versions

Security fixes go into the latest release. Please upgrade before
reporting, if you can.

## Things that are by design

- **Single-user mode (`AUTH_MODE=none`) has no authentication.** Anyone who
  can reach the server has full access; the docs and the startup log say
  so. Use `AUTH_MODE=oidc` for anything others can reach.
- **The allowlist relies on your identity provider**: FastSpec only accepts
  email addresses the provider marks as verified.

Reports about either are still welcome if you find a way around the
documented behaviour — for example, reaching another user's specs in
`oidc` mode.
