# FastSpec — Domain Glossary

The words FastSpec's code, UI and docs use, and what they mean. How the
system is built is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Specs

### Spec

An OpenAPI document a user keeps in FastSpec, identified by a UUID and a
name unique per user. Its content lives in its **Spec Versions**; the Spec
records which version is current.

### Spec Version

A saved snapshot of a Spec's content under a version label (e.g. `1.2.0`),
unique per Spec. Versions can be compared, published (made current) and
deleted.

### Spec Version Mode

The OpenAPI version declared in the `openapi` field of a Spec (`3.0.x` or
`3.1.x`). Determines which form semantics are active: in 3.0 mode,
nullability is expressed as `nullable: true` and
`exclusiveMinimum`/`exclusiveMaximum` are booleans; in 3.1 mode,
nullability is expressed as a type array (e.g. `["string", "null"]`) and
`exclusiveMinimum`/`exclusiveMaximum` are numbers. The Form Editor detects
the Spec Version Mode from the `openapi` field and adjusts its UI.

### Path

A URL template string (e.g. `/users/{id}/posts`) that identifies an API
endpoint. A Path may contain one or more **Path Parameter Tokens**.

### Path Parameter Token

A `{name}` segment embedded in a Path string (e.g. `{id}` in
`/users/{id}`). Tokens are the **sole source** of Path Parameters — they
cannot be created any other way.

### Path Parameter

A Parameter whose location is `in: path`. Created automatically when a Path
Parameter Token is added to a Path string. Removed automatically (after
user confirmation if it has content) when its token is removed from the
Path string. Never manually created or edited for location.

### Parameter

A named input attached to an Operation. Has a location (`query`, `header`,
`cookie`, or — exclusively via Path Parameter Tokens — `path`), a type, and
optional constraints. The `path` location is read-only and managed by the
Path string.

### Operation

An HTTP method (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD) bound to a
Path, carrying a summary, description, operationId, tags, parameters,
request body, and responses.

### Route

Synonym for a Path and one of its Operations (e.g. `GET /users/{id}`). Not
used as a distinct domain term — prefer "Path" or "Operation".

### Response

An HTTP status code entry under an Operation's `responses` map. Each
Response has a status code key (numeric string or `"default"`), a
description, an optional content type, and an optional **Response Schema**.
An Operation may have several Responses with distinct status codes (e.g.
`200`, `201`, `409`). Status codes are picked in two steps (category →
code), with the standard name and a hint for each (e.g. `409 Conflict —
State conflict (e.g. duplicate)`). A Response's status code can be changed
without losing its definition.

### Response Schema

The schema attached to a Response's content type. Supports the same three
modes as the Request Body Schema: **reference** (a `$ref` to a Component
Schema), **inline object** (a property builder with `$ref`-capable
properties, array item types, and constraints), and **inline
primitive/array** (type selector with constraints). Inline Response Schemas
go through the same `_itemSchemas` / `cleanRefsForOutput` pipeline as
Request Body Schemas.

### Item Schema

The schema that describes each element of an array-typed Parameter or
Property. Represented internally as `_itemSchemas` (a list of per-type
sub-schemas) and serialised to the OpenAPI `items` field on output. Must
always be present and valid when the parent type is `array` — an absent or
malformed Item Schema makes Swagger UI's "Add item" button fail silently.

## Linting

### Lint Ruleset

A named set of Spectral rules a user owns. Always extends the
`spectral:oas` baseline, adding rules and/or changing the severity of
default ones. A user may have several; exactly one is their **default**,
and a Spec can **pin** another. At lint time the Spec's pinned ruleset
applies, else the user's default, else the plain baseline. Composed of
optional **Structured Rules** and an optional **Raw Ruleset Override**.
See [ADR-0005](docs/adr/0005-multi-ruleset-lint.md).

### Structured Rules

Lint rule definitions built with the rule form. Each rule has a unique
name, a severity (`error` | `warn` | `info` | `hint` | `off`), a JSONPath
selector (`given`), an optional message, and a `then` block using one of
the supported built-in Spectral functions (`truthy`, `falsy`, `pattern`,
`enumeration`, `length`, `schema`, `casing`, `alphabetical`, `xor`,
`unreferencedReusableObject`) with its options.

### Raw Ruleset Override

A user-authored Spectral ruleset in YAML. When present, it takes precedence
over the Structured Rules. Validated at save time: well-formed YAML, no
`functions`/`functionsDir`, and no `extends` outside the built-in rulesets.

## Access

### Auth Mode

How people sign in to a FastSpec instance: **none** (single-user mode, no
sign-in — everything belongs to the **Local User**) or **oidc** (sign-in
with an OpenID Connect provider). See
[ADR-0006](docs/adr/0006-auth-modes.md).

### Local User

The implicit single user of an instance running with Auth Mode `none`.
Its data can be handed to a real account with `transfer-local-data`.

### Session

What the web app authenticates with: a JWT issued at sign-in, recorded by
its `jti` so it can be revoked on logout.

### API Key

A long-lived credential a user creates for MCP clients and scripts. Stored
as a PBKDF2 hash; the raw value is shown once, at creation. Carries a set
of **Actions** that bound what its holder may do. Has an optional display
**name** (not unique); without one, the UI shows the truncated UUID. Can be
exchanged for a **Short JWT**.

### Short JWT

A token valid for a few minutes, obtained by exchanging an API Key, and
carrying that key's Actions. Revoking the key invalidates it.

### Action

A permission granted to an API Key (e.g. `read:specs`, `write:specs`,
`lint:specs`). Controls which MCP tools the key may call. `All` grants every
action, including future ones.

## Running FastSpec

### Instance

One running FastSpec: the Docker image (self-hosted, SQLite or Postgres) or
the AWS serverless deployment. See [SELF_HOSTING.md](docs/SELF_HOSTING.md)
and [DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Front Door

The single-origin routing in front of the API, the MCP server and the web
app (`backend/frontdoor.py`; CloudFront on AWS). See
[ADR-0008](docs/adr/0008-single-image-self-hosting.md).
