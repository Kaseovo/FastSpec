#!/usr/bin/env python3
"""Smoke-test the Lambda image through the runtime emulator in AWS's base image.

    docker build -f backend/Dockerfile.lambda -t fastspec-lambda .
    docker run -d --name fastspec-lambda -p 9000:8080 --read-only --tmpfs /tmp \\
        -e AUTH_MODE=none -e FASTSPEC_DATA_DIR=/tmp/data fastspec-lambda
    python3 scripts/smoke-lambda-image.py

Sends the events a Lambda Function URL sends: migrate, open a session, list
specs, lint one. Linting runs the Spectral CLI — the step a wrong
SPECTRAL_PATH breaks, and which nothing else exercises in this image.
Exits non-zero, printing the response, at the first thing that's off.
"""

import json
import sys
import time
import urllib.error
import urllib.request

INVOKE_URL = "http://localhost:9000/2015-03-31/functions/function/invocations"
SPEC = {
    "openapi": "3.0.3",
    "info": {"title": "Pets", "version": "1.0.0"},
    "paths": {"/pets": {"get": {"responses": {"200": {"description": "ok"}}}}},
}


def invoke(event: dict) -> dict:
    request = urllib.request.Request(
        INVOKE_URL, data=json.dumps(event).encode(), headers={"Content-Type": "application/json"}
    )
    for attempt in range(30):  # the emulator takes a moment to listen
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.load(response)
        except (urllib.error.URLError, ConnectionError):
            if attempt == 29:
                raise
            time.sleep(1)
    raise AssertionError("unreachable")


def http(method: str, path: str, body=None, token: str | None = None):
    """Invoke with an HTTP request shaped like a Function URL event."""
    headers = {"host": "localhost", "content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    response = invoke(
        {
            "version": "2.0",
            "routeKey": "$default",
            "rawPath": path,
            "rawQueryString": "",
            "headers": headers,
            "requestContext": {
                "http": {
                    "method": method,
                    "path": path,
                    "protocol": "HTTP/1.1",
                    "sourceIp": "127.0.0.1",
                    "userAgent": "smoke-test",
                },
                "domainName": "localhost",
                "stage": "$default",
                "requestId": "smoke",
                "timeEpoch": 0,
            },
            "body": json.dumps(body) if body is not None else None,
            "isBase64Encoded": False,
        }
    )
    payload = json.loads(response["body"]) if response.get("body") else None
    return response.get("statusCode"), payload


def check(what: str, ok: bool, detail) -> None:
    print(f"{'ok  ' if ok else 'FAIL'} {what}")
    if not ok:
        print(json.dumps(detail, indent=2)[:2000])
        sys.exit(1)


migrated = invoke({"migrate": True})
check("migrations", migrated == {"statusCode": 200}, migrated)

status, session = http("POST", "/auth/local/session")
check("local session", status == 200 and "access_token" in (session or {}), [status, session])
token = session["access_token"]

# Function URLs strip the trailing slash; both forms must reach the route.
for path in ("/api/specs", "/api/specs/"):
    status, specs = http("GET", path, token=token)
    check(f"GET {path}", status == 200 and specs == [], [status, specs])

status, lint = http("POST", "/api/lint", {"spec_json": SPEC}, token=token)
check("lint (Spectral CLI)", status == 200 and "score" in (lint or {}), [status, lint])
print(f"lint score: {lint['score']}")
