# FastSpec — Domain Glossary

## Path

A URL template string (e.g. `/users/{id}/posts`) that identifies an API endpoint. A Path may contain one or more **Path Parameter Tokens**.

## Path Parameter Token

A `{name}` segment embedded in a Path string (e.g. `{id}` in `/users/{id}`). Tokens are the **sole source** of Path Parameters — they cannot be created any other way.

## Path Parameter

A Parameter whose location is `in: path`. Created automatically when a Path Parameter Token is added to a Path string. Removed automatically (after user confirmation if it has content) when its corresponding token is removed from the Path string. Never manually created or edited for location.

## Parameter

A named input attached to an Operation. Has a location (`query`, `header`, `cookie`, or — exclusively via Path Parameter Tokens — `path`), a type, and optional constraints. The `path` location is read-only and managed by the Path string.

## Operation

An HTTP method (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD) bound to a Path, carrying a summary, description, operationId, tags, parameters, request body, and responses.

## Route

Synonym for the combination of a Path and one of its Operations (e.g. `GET /users/{id}`). Not used as a distinct domain term — prefer "Path" or "Operation".

## Item Schema

The schema that describes each element of an array-typed Parameter or Property. Represented internally as `_itemSchemas` (a list of per-type sub-schemas) and serialised to the OpenAPI `items` field on output. Must always be present and valid when the parent type is `array` — an absent or malformed Item Schema causes Swagger UI's "Add item" button to silently fail.

## Spec Version Mode

The OpenAPI version declared in the `openapi` field of a Spec (`3.0.x` or `3.1.x`). Determines which form semantics are active: in 3.0 mode, nullability is expressed as `nullable: true` and `exclusiveMinimum`/`exclusiveMaximum` are booleans; in 3.1 mode, nullability is expressed as a type array (e.g. `["string", "null"]`) and `exclusiveMinimum`/`exclusiveMaximum` are numbers. The Form Editor detects the Spec Version Mode from the `openapi` field value and adjusts its UI accordingly.
