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

import yaml

logger = logging.getLogger(__name__)

# Severity mapping: Spectral uses integers 0-3
# 0 = error, 1 = warn, 2 = info, 3 = hint
SEVERITY_MAP = {0: "error", 1: "warn", 2: "info", 3: "hint"}

# Penalty weights for score calculation (deducted per issue)
SEVERITY_PENALTY = {"error": 10, "warn": 3, "info": 1, "hint": 0}

# Built-in Spectral functions supported by the structured rule form
_SPECTRAL_BUILTIN_FUNCTIONS = {
    "truthy",
    "falsy",
    "pattern",
    "enumeration",
    "length",
    "schema",
}


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

    raise RuntimeError("Error with Spectral CLI invocation: SPECTRAL_PATH not set.")


def _build_command(spec_path: str, ruleset_path: str) -> List[str]:
    """Build the Spectral CLI command list.

    Args:
        spec_path:    Path to the temporary OpenAPI JSON file.
        ruleset_path: Path to the ruleset YAML file to use.
    """
    spectral = _find_spectral()
    return [
        spectral,
        "lint",
        spec_path,
        "--ruleset",
        ruleset_path,
        "--format",
        "json",
        "--quiet",
    ]


def build_ruleset_yaml(user_ruleset: Optional[Dict[str, Any]]) -> str:
    """
    Build a Spectral ruleset YAML string from a user's stored ruleset data.

    Strategy:
    - If ``user_ruleset`` is None or empty, fall back to plain ``extends: spectral:oas``.
    - If ``raw_yaml`` is present, it takes precedence: return it as-is, ensuring
      the ``extends: spectral:oas`` directive is present (prepend if missing).
    - Otherwise serialise ``rules_json`` (Structured Rules) into valid Spectral YAML
      alongside ``extends: spectral:oas``.

    Args:
        user_ruleset: Dict with optional keys ``rules_json`` (list) and
                      ``raw_yaml`` (str), as stored in ``UserLintRuleset``.

    Returns:
        A YAML string ready to be written to a ``.spectral.yaml`` temp file.
    """
    if not user_ruleset:
        return "extends: spectral:oas\n"

    raw_yaml: Optional[str] = user_ruleset.get("raw_yaml")
    rules_json: Optional[List[Dict[str, Any]]] = user_ruleset.get("rules_json")

    # --- Raw YAML override takes precedence ---
    if raw_yaml:
        stripped = raw_yaml.strip()
        # Ensure the baseline is always extended
        if "spectral:oas" not in stripped:
            stripped = "extends: spectral:oas\n" + stripped
        return stripped + "\n"

    # --- Structured Rules → generated YAML ---
    if not rules_json:
        return "extends: spectral:oas\n"

    ruleset: Dict[str, Any] = {"extends": "spectral:oas", "rules": {}}
    for rule in rules_json:
        name: str = rule.get("name", "")
        if not name:
            continue

        then_block: Dict[str, Any] = {"function": rule.get("then_function", "truthy")}
        options = rule.get("then_function_options")
        if options:
            then_block["functionOptions"] = options

        rule_def: Dict[str, Any] = {
            "given": rule.get("given", "$"),
            "then": then_block,
            "severity": rule.get("severity", "warn"),
        }
        message = rule.get("message")
        if message:
            rule_def["message"] = message

        ruleset["rules"][name] = rule_def

    return yaml.dump(ruleset, default_flow_style=False, sort_keys=False)


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
    user_ruleset: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Run Spectral CLI on the provided OpenAPI spec dict.

    Writes the spec to a temporary JSON file, builds a temporary ruleset YAML
    file (merging ``user_ruleset`` on top of ``spectral:oas`` when provided),
    invokes the Spectral CLI subprocess, parses the JSON output, and returns
    a structured result.

    Args:
        spec_json:    The parsed OpenAPI spec as a Python dict.
        ruleset:      Legacy parameter kept for backward compatibility (ignored
                      when ``user_ruleset`` is provided).
        timeout:      Maximum seconds to wait for the subprocess.
        user_ruleset: Optional dict with keys ``rules_json`` and/or ``raw_yaml``
                      loaded from the ``UserLintRuleset`` DB row for the
                      authenticated user.

    Returns:
        A dict with keys: score (int), summary (dict), results (list).

    Raises:
        RuntimeError: If Spectral is not found or returns unexpected output.
    """
    tmp_spec_path: Optional[str] = None
    tmp_ruleset_path: Optional[str] = None

    try:
        # Write spec to temp file
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            delete=False,
            encoding="utf-8",
        ) as tmp_spec:
            json.dump(spec_json, tmp_spec, indent=2)
            tmp_spec_path = tmp_spec.name

        # Build ruleset YAML and write to temp file
        ruleset_yaml_content = build_ruleset_yaml(user_ruleset)
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".spectral.yaml",
            delete=False,
            encoding="utf-8",
        ) as tmp_ruleset:
            tmp_ruleset.write(ruleset_yaml_content)
            tmp_ruleset_path = tmp_ruleset.name

        cmd = _build_command(tmp_spec_path, tmp_ruleset_path)
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
            return {
                "score": 100,
                "summary": {"error": 0, "warn": 0, "info": 0, "hint": 0},
                "results": [],
            }

        try:
            raw = json.loads(stdout)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"Failed to parse Spectral output as JSON: {exc}\nOutput: {stdout[:500]}"
            ) from exc

        return _parse_result(raw)

    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Spectral CLI timed out after {timeout} seconds")
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Spectral CLI not found. Ensure Node.js and npx are available in PATH, "
            "or set the SPECTRAL_PATH environment variable."
        ) from exc
    finally:
        for path in (tmp_spec_path, tmp_ruleset_path):
            if path:
                try:
                    os.unlink(path)
                except OSError:
                    pass
