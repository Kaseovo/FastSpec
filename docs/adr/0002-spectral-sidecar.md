# ADR 0002 — Spectral Sidecar Container

## Status

Accepted

## Context

The backend Docker image currently bundles Python (FastAPI/uvicorn) and Node.js 20 (Spectral CLI) in the same container. Spectral is invoked as a subprocess via `subprocess.run()` in `spectral_linter.py`. The two runtimes are unrelated to each other — Node.js exists solely to run Spectral.

This creates several problems for ECS Fargate deployment:

1. **Image size**: The combined image is ~600–800 MB. ECS pulls the full image on every cold start, increasing task launch time.
2. **Security surface**: Two runtimes, two update tracks, two sets of CVEs to manage in a single image.
3. **Coupling**: Updating the Spectral CLI version requires rebuilding and redeploying the entire backend.
4. **Scaling**: If lint becomes a bottleneck, it cannot be scaled independently from the API.

## Decision

Extract the Spectral CLI invocation into a dedicated **Spectral Sidecar** container:

- A minimal Node.js image running a single Fastify HTTP server.
- Exposes one endpoint: `POST /lint` — accepts `{ spec: object, ruleset: string }`, invokes the Spectral CLI as a subprocess, returns the raw Spectral JSON output.
- Runs as a second container in the same ECS task definition as the backend. Both containers share the task's local network namespace, so the backend calls `http://localhost:<port>/lint`.
- The backend's `_find_spectral()` function in `spectral_linter.py` is replaced by an HTTP call to `SPECTRAL_SIDECAR_URL` (env var, defaulting to `http://localhost:3001`).

### Transport

HTTP (REST). The payload is already JSON/YAML. A single `POST /lint` endpoint is sufficient, trivial to test with `curl`, and carries no additional toolchain overhead.

## Consequences

- The Python backend image becomes lean (`python:3.11-slim` with no Node.js).
- The Spectral sidecar image is a separate ECR repository, versioned and deployed independently.
- The sidecar is included in the floci local environment as a second container in the backend task.
- `spectral_linter.py` loses the `_find_spectral()` / `subprocess.run()` logic and gains an `httpx` call to the sidecar. The existing `build_ruleset_yaml()` and `_parse_result()` functions are unchanged — they remain in the Python layer.

## Alternatives Considered

### Keep the fat image
Rejected. The move to ECS Fargate is the right moment to resolve this. Cold-start latency and image maintenance costs are real, ongoing concerns.

### gRPC transport
Rejected. One endpoint, two inputs, one output. gRPC adds proto definition maintenance for no measurable gain at this scale. HTTP is debuggable with `curl`.

### Lambda for Spectral only
Rejected. Lambda's ephemeral filesystem and cold-start overhead are worse than a long-running sidecar container that stays warm as long as the ECS task is alive.
