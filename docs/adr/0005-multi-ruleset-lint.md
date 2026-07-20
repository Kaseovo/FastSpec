# ADR-0005: Multi-ruleset lint model, expanded functions, per-rule preview, sidecar

**Status:** Accepted (phases 1–3 implemented; phase 4 sidecar not yet built)
**Date:** 2026-07-20

## Context

The custom lint ruleset feature (`LintService`, `LintRulesetRepository`,
`spectral_linter.py`) was, per `docs/CODE_REVIEW.md`, "the best code in the
repo" — clean seams, DI'd `SpectralClient`, solid tests. But it had four
real gaps, surfaced by walking the feature area systematically rather than
chasing a specific bug (there are no production users yet, so this was a
build-it-right pass, not incident response):

1. **Ruleset scope**: exactly one `UserLintRuleset` per user, applied to
   every spec they own. No way to have a stricter ruleset for a public API
   and a looser one for an internal API without hand-editing YAML each time.
2. **Structured rule expressiveness**: the form only exposed 6 of Spectral's
   built-in functions (`truthy`, `falsy`, `pattern`, `enumeration`, `length`,
   `schema`), even though Spectral ships more (`casing`, `alphabetical`,
   `xor`, `unreferencedReusableObject`) that carry no additional security
   risk — they're all built into the pinned Spectral binary already.
3. **Authoring feedback loop**: no way to see what a draft rule actually
   matches without saving the whole ruleset and running a full lint.
4. **Performance**: lint runs a Node + Spectral CLI subprocess per call
   (cold start every time). A `SpectralClient` HTTP-sidecar transport
   *seam* already existed (`HttpSpectralClient`, `SPECTRAL_MODE=http`), but
   no sidecar server implementing it was ever built.

## Decision

### 1. Ruleset scope: `LintRuleset` replaces `UserLintRuleset`

`UserLintRuleset` (`user_id` UNIQUE) is replaced by `LintRuleset` — many
rows per user, each with `name` (unique per user), `is_default` (exactly one
enforced in `LintRulesetRepository`, not a DB constraint — a portable
partial-unique index isn't worth the migration complexity for this), plus
the existing `rules_json`/`raw_yaml`.

`OpenAPISpec` gains a nullable `active_ruleset_id` FK. Ruleset resolution
(`LintService._resolve_ruleset`): spec's pinned ruleset if set → else the
user's default ruleset → else bare `extends: spectral:oas`.

No data migration — pre-launch, no real users, so the Alembic migration
(`f3a9c2d1b7e4`) is a hard cutover: drop `user_lint_rulesets`, create
`lint_rulesets`, add `openapi_specs.active_ruleset_id`.

Business rules enforced in `LintRulesetRepository`, not the DB, because they
involve cross-table checks a foreign key can't express on its own:

- Deleting a ruleset pinned to any spec is blocked (409, lists the specs).
- Deleting the default ruleset while other rulesets exist is blocked (409)
  — the caller must explicitly promote a new default rather than one being
  silently picked for them.
- The first ruleset a user creates becomes default automatically, since
  "user has zero rulesets" and "user's one ruleset isn't flagged default"
  would otherwise be indistinguishable states with different fallback
  behavior.

### 2. Expressiveness: more built-in functions, not custom JS

`casing`, `alphabetical`, `xor`, `unreferencedReusableObject` are added to
`SPECTRAL_FUNCTIONS`/`_SPECTRAL_BUILTIN_FUNCTIONS` and the structured-rule
form. `xor` isn't form-configurable (it needs two field names, not a single
`given` target) — Raw YAML Override covers it, same treatment as `schema`.

Sandboxed custom JS functions (`functions`/`functionsDir`) were considered
and explicitly rejected, not deferred-as-an-oversight. `spectral_linter.py`
already rejects `functions`/`functionsDir` in `raw_yaml` outright, because
Spectral loads and executes them from disk — accepting user-authored JS here
would mean arbitrary code execution in the lint process. That security
posture holds: **Spectral built-ins only, ever.**

### 3. Feedback loop: `POST /lint/preview-rule`

A new endpoint runs one draft `StructuredRule` — not a saved ruleset —
against spec JSON in the request body, with **no** `spectral:oas` extension
(`build_ruleset_yaml(..., extend_oas=False)`), so only this rule's matches
come back, not the entire baseline ruleset's noise. Nothing is persisted.
`LintPanel` already had the currently-open spec's content in the editor
buffer, so the "Test against current spec" button in the rule editor needed
no new spec-fetching plumbing — just threading `specContent` down as a prop.

### 4. Performance: sidecar deferred, not built in this pass

Switching `SPECTRAL_MODE` to `http` requires an actual sidecar server (a
long-lived Node/Express process wrapping the Spectral CLI, serving
`POST /lint`) — `HttpSpectralClient` is a client-only stub with nothing on
the other end. That's real infra work (new service, local dev wiring, prod
deployment) requiring its own scoping pass; not implemented in this change.
Tracked as follow-up work, along with result caching keyed on
content-hash + ruleset-hash (lower priority once the sidecar removes
cold-start, but still worth doing — avoids redundant subprocess runs on
identical repeated lints).

## Consequences

- Breaking API change: `GET/PUT/DELETE /lint/ruleset` (singular) is gone,
  replaced by `GET/POST /lint/rulesets`, `GET/PUT/DELETE
  /lint/rulesets/{id}`, `POST /lint/rulesets/{id}/set-default`, and
  `PUT /lint/spec/{spec_id}/ruleset`. Acceptable pre-launch; would need a
  deprecation path with real users.
- `POST /lint/{spec_id}`, `POST /lint`, and `POST /lint/{spec_id}/lint-draft`
  no longer accept a `ruleset` query param / body field — it was already a
  dead/ignored input before this change (see `docs/CODE_REVIEW.md`), so
  removing it from the docs doesn't change runtime behavior, only stops
  documenting a no-op.
- Route registration order in `backend/routers/lint.py` is now
  load-bearing: every static-path route (`""`, `/preview-rule`,
  `/rulesets*`, `/spec/{spec_id}/ruleset`) must be registered *before*
  the catch-all `/{spec_id}` and `/{spec_id}/lint-draft` routes, or FastAPI
  matches the catch-all first (e.g. `POST /rulesets` would hit
  `lint_spec_by_id` with `spec_id="rulesets"`). Documented inline at the
  top of the lint-endpoints section of the router.
- Frontend `LintRulesetDialog.vue` changed from a single-ruleset editor to a
  ruleset picker + editor (select/new/rename/delete/set-default), and
  `LintPanel.vue` gained a per-spec ruleset-assignment dropdown, both
  requiring `specId`/`specContent` props to be threaded down from
  `EditorView.vue`.
- Sidecar server (item 4) and rule-level caching remain open follow-up work,
  not shipped here.
