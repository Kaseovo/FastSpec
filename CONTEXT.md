# FastSpec — Domain Glossary

## Deployment Environment

One of four named runtime targets: **local** (`http://localhost`, floci only), **dev** (`dev.fastspec.kaseovo.com`), **staging** (`staging.fastspec.kaseovo.com`), or **prod** (`fastspec.kaseovo.com`). Each environment is an independent CDK stack driven by `--context env=local|dev|staging|prod`. The `local` environment runs entirely inside floci with no real AWS resources.

## Deployment Stack

The full set of AWS resources that together run FastSpec in a given Deployment Environment: an ECS Fargate service (backend), S3 buckets (frontend, landing-page), a CloudFront distribution (public entry point), an internal ALB (ingress from CloudFront to backend), RDS (PostgreSQL), ElastiCache (Redis), ACM certificates, and Route53 records. CloudFront is the sole public entry point: a single distribution routes `/api*` and `/auth*` to the ALB, `/specs*` to the frontend S3 bucket, and `/*` to the landing-page S3 bucket. The ALB is internal (not internet-facing) and is accessible only from the CloudFront distribution.

## floci Environment

A local replica of the Deployment Stack running on a developer's machine or in CI, powered by floci. Replaces `docker-compose`. Consumes the same CDK IaC definitions as a real AWS Deployment Stack, ensuring local and production behaviour are identical. Secret values are seeded into floci's SSM Parameter Store from the local `.env` file before the stacks are deployed. Frontend and landing-page are excluded from the floci Environment and run as plain local processes (Vite dev server).

## DataStack

The CDK stack responsible for stateful infrastructure: an RDS instance (PostgreSQL) and an ElastiCache cluster (Redis). Exports connection endpoints consumed by the ComputeStack. Deployed independently so the compute layer can be updated without risking data-layer replacement.

## ComputeStack

The CDK stack responsible for compute and ingress: the ECS Fargate service (backend), the ALB with listener rules, and SSM secret references wired into the ECS task definition. Imports connection endpoints from the DataStack. Fargate tasks run in public subnets with `assignPublicIp: true`. The ALB is `internetFacing: false` and is accessible only from the CloudFront distribution. For the `local` Deployment Environment, ALB listener rules are scoped to backend routes only (`/api`, `/auth`); frontend and landing-page routes are added for `dev`, `staging`, and `prod`.

## Spectral CLI

A Spectral CLI binary installed into the backend Docker image. Invoked in-process by the backend to lint a Spec against a Lint Ruleset. No inter-process communication is involved — Spectral runs as a child process within the backend container, not as a separate sidecar container or HTTP service.

## Migration Task

An ECS Run Task (one-off, short-lived) that executes `alembic upgrade head` against the target RDS instance before each new service version is rolled out. Ensures the database schema matches the current SQLAlchemy models. Replaces the former `Base.metadata.create_all()` startup call. The CDK construct for the Migration Task is defined from the start; the task is a no-op stub until Alembic is bootstrapped in the backend.


## Lint Ruleset

The set of Spectral rules applied when linting a Spec. Always extends the `spectral:oas` baseline. A user may have one optional **User Lint Ruleset** that layers on top of the baseline — adding new rules and/or overriding the severity of default rules.

## User Lint Ruleset

A per-user, globally-scoped Lint Ruleset stored in the `user_lint_rulesets` table. When present, it is merged with `spectral:oas` at lint time by generating a temporary ruleset file. When absent, only the `spectral:oas` baseline runs. Composed of two optional parts: **Structured Rules** and a **Raw Ruleset Override**.

## Structured Rules

An array of lint rule definitions built via the rule-form UI. Each rule has: a unique name (key), severity (`error` | `warn` | `info` | `hint` | `off`), a JSONPath selector (`given`), an optional message template, and a `then` block specifying one of the built-in Spectral functions (`truthy`, `falsy`, `pattern`, `enumeration`, `length`, `schema`) with its options. Stored as JSON in `user_lint_rulesets.rules_json`.

## Raw Ruleset Override

A user-authored YAML text block containing a valid Spectral ruleset. When present, it takes precedence over Structured Rules for linting — the Raw Ruleset Override is written directly to the temporary ruleset file instead of the generated YAML. Validated as well-formed YAML at save time. Stored in `user_lint_rulesets.raw_yaml`.

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

## Response

An HTTP status code entry under an Operation's `responses` map. Each Response has a status code key (numeric string or `"default"`), a description, an optional content type, and an optional Response Schema. A single Operation may have multiple Responses with distinct status codes (e.g. `200`, `201`, `409`). Status codes are selected via a two-step picker (category → code) that surfaces the standard name and a contextual hint for each code (e.g. `409 Conflict — State conflict (e.g. duplicate)`). The status code of an existing Response can be changed without losing its definition.

## API Key

A long-lived credential issued to a user that authenticates MCP tool calls. Stored as a bcrypt hash; the raw value is shown once at creation and never again. Carries a set of **Actions** that bound what operations the holder may perform. Has an optional user-defined **name** — a short display label with no uniqueness constraint. When no name is set, the UI falls back to displaying the truncated UUID. Identified internally by a UUID `id`.

## Action

A permission string that can be granted to an API Key (e.g. `read:specs`, `write:specs`). Controls which MCP tool calls the key is authorised to make. The special value `All` grants every available action.



The schema attached to a Response's content type. Supports the same three modes as the Request Body Schema: **reference** (a `$ref` to a Component Schema), **inline object** (a property builder with `$ref`-capable properties, array item types, and constraints), and **inline primitive/array** (type selector with constraints). Inline Response Schemas are normalised through the same `_itemSchemas` / `cleanRefsForOutput` pipeline as Request Body Schemas.
