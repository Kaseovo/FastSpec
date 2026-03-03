"""
Spectral CLI integration for OpenAPI linting.

Runs @stoplight/spectral-cli as a subprocess and parses its JSON output
into a structured response with a quality score.
"""

import json
import logging
import os
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Severity mapping: Spectral uses integers 0-3
# 0 = error, 1 = warn, 2 = info, 3 = hint
SEVERITY_MAP = {0: "error", 1: "warn", 2: "info", 3: "hint"}

# Penalty weights for score calculation (deducted per issue)
SEVERITY_PENALTY = {"error": 10, "warn": 3, "info": 1, "hint": 0}


def _find_spectral() -> str:
    """
    Return the command to invoke Spectral CLI.

    Preference order:
    1. SPECTRAL_PATH env var (allows pinning a pre-installed binary)
    2. npx @stoplight/spectral-cli (always available if Node.js is present)
    """
    logger.debug("SPECTRAL_PATH env: %s", os.environ.get("SPECTRAL_PATH"))
    custom = os.environ.get("SPECTRAL_PATH")
    if custom:
        return custom
    
    raise RuntimeError(
        "Error with Spectral CLI invocation: SPECTRAL_PATH not set."
    )


def _build_command(spec_path: str, ruleset: str) -> List[str]:
    """Build the Spectral CLI command list."""
    spectral = _find_spectral()      
    if ruleset == "spectral:oas":
        return [
            spectral,
            "lint",
            spec_path,
            "--ruleset",
            "./spectral.oas.yaml",
            "--format",
            "json",
        ]
    else:
         logger.warning(
            "Custom SPECTRAL_PATH detected; ignoring ruleset argument (only supported with npx)"
        )


def _parse_result(raw: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Convert the raw Spectral JSON output into the FastSpec lint response shape.

    Spectral JSON output is a list of result objects, each with:
        code, message, severity (int), path (list), range (start/end)
    """
    results: List[Dict[str, Any]] = []
    summary = {"error": 0, "warn": 0, "info": 0, "hint": 0}

    for item in raw:
        severity_int = item.get("severity", 1)
        severity = SEVERITY_MAP.get(severity_int, "warn")
        summary[severity] += 1

        result = {
            "code": item.get("code", "unknown"),
            "message": item.get("message", ""),
            "severity": severity,
            "path": item.get("path", []),
            "range": item.get("range", {}),
        }
        results.append(result)

    # Score: start at 100, subtract weighted penalties (floor 0)
    penalty = (
        summary["error"] * SEVERITY_PENALTY["error"]
        + summary["warn"] * SEVERITY_PENALTY["warn"]
        + summary["info"] * SEVERITY_PENALTY["info"]
        + summary["hint"] * SEVERITY_PENALTY["hint"]
    )
    score = max(0, 100 - penalty)

    return {
        "score": score,
        "summary": summary,
        "results": results,
    }


def run_spectral(
    spec_json: Dict[str, Any],
    ruleset: str = "spectral:oas",
    timeout: int = 60,
) -> Dict[str, Any]:
    """
    Run Spectral CLI on the provided OpenAPI spec dict.

    Writes the spec to a temporary JSON file, invokes the Spectral CLI
    subprocess, parses the JSON output, and returns a structured result.

    Args:
        spec_json:  The parsed OpenAPI spec as a Python dict.
        ruleset:    The Spectral ruleset to use (default: spectral:oas).
        timeout:    Maximum seconds to wait for the subprocess.

    Returns:
        A dict with keys: score (int), summary (dict), results (list).

    Raises:
        RuntimeError: If Spectral is not found or returns unexpected output.
    """
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".json",
        delete=False,
        encoding="utf-8",
    ) as tmp:
        json.dump(spec_json, tmp, indent=2)
        tmp_path = tmp.name

    try:
        cmd = _build_command(tmp_path, ruleset)
        logger.debug("Running Spectral: %s", " ".join(cmd))
        logger.debug("Environment PATH: %s", os.environ.get("PATH"))

        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        # Spectral exits with code 1 when lint issues are found — that's normal.
        # It exits with code 2+ for actual failures (e.g. ruleset not found).
        if proc.returncode >= 2:
            stderr = proc.stderr.strip()
            raise RuntimeError(
                f"Spectral CLI failed (exit {proc.returncode}): {stderr}"
            )

        stdout = proc.stdout.strip()
        if not stdout:
            # No output = zero issues (perfect spec)
            return {"score": 100, "summary": {"error": 0, "warn": 0, "info": 0, "hint": 0}, "results": []}

        try:
            raw = json.loads(stdout)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"Failed to parse Spectral output as JSON: {exc}\nOutput: {stdout[:500]}"
            ) from exc

        return _parse_result(raw)

    except subprocess.TimeoutExpired:
        raise RuntimeError(
            f"Spectral CLI timed out after {timeout} seconds"
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Spectral CLI not found. Ensure Node.js and npx are available in PATH, "
            "or set the SPECTRAL_PATH environment variable."
        ) from exc
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
