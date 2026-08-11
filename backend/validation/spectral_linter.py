"""
Spectral CLI integration for OpenAPI linting.

Runs @stoplight/spectral-cli as a subprocess and parses its JSON output
into a structured response with a quality score.
"""

import logging
from typing import Any, Dict, List, Optional

import yaml

from config import settings

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
    "casing",
    "alphabetical",
    "xor",
    "unreferencedReusableObject",
}


def _find_spectral() -> str:
    """
    Return the command to invoke Spectral CLI.

    Preference order:
    1. SPECTRAL_PATH env var (allows pinning a pre-installed binary)
    2. npx @stoplight/spectral-cli (always available if Node.js is present)
    """
    logger.debug("SPECTRAL_PATH env: %s", settings.spectral_path)
    if settings.spectral_path:
        return settings.spectral_path

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


class RulesetSecurityError(ValueError):
    """Raised when a user-supplied raw_yaml ruleset contains disallowed keys."""


# Spectral rulesets support `functions`/`functionsDir` (arbitrary JS loaded
# from disk) and `extends` (which can point at an arbitrary URL, an SSRF
# vector, since Spectral will fetch it at lint time). Since raw_yaml is
# attacker-controlled and gets written straight to a file the Spectral CLI
# executes against, both classes of directive are rejected outright rather
# than sandboxed.
_DISALLOWED_RULESET_KEYS = {"functions", "functionsDir"}
_ALLOWED_EXTENDS_VALUES = {"spectral:oas", "spectral:asyncapi"}


def validate_ruleset_yaml_is_safe(raw_yaml: str) -> None:
    """Reject a user-supplied raw_yaml ruleset that could cause the Spectral
    CLI to load arbitrary code from disk (functions/functionsDir) or make an
    SSRF-capable outbound request (extends pointing at a URL/file path).

    Raises RulesetSecurityError if the ruleset is unsafe. Callers should have
    already confirmed the YAML parses (yaml.safe_load) before calling this.
    """
    parsed = yaml.safe_load(raw_yaml)
    if not isinstance(parsed, dict):
        return

    disallowed = _DISALLOWED_RULESET_KEYS & parsed.keys()
    if disallowed:
        raise RulesetSecurityError(
            f"Ruleset key(s) not allowed: {', '.join(sorted(disallowed))}"
        )

    extends = parsed.get("extends")
    if extends is not None:
        values = extends if isinstance(extends, list) else [extends]
        for value in values:
            # Spectral's `extends` accepts a bare name or [name, "all"/"recommended"]
            name = value[0] if isinstance(value, list) and value else value
            if name not in _ALLOWED_EXTENDS_VALUES:
                raise RulesetSecurityError(
                    f"'extends' may only reference {sorted(_ALLOWED_EXTENDS_VALUES)}, "
                    f"got: {name!r}"
                )


def build_ruleset_yaml(
    user_ruleset: Optional[Dict[str, Any]], extend_oas: bool = True
) -> str:
    """
    Build a Spectral ruleset YAML string from a user's stored ruleset data.

    Strategy:
    - If ``user_ruleset`` is None or empty, fall back to plain ``extends: spectral:oas``
      (or an empty ruleset when ``extend_oas`` is False).
    - If ``raw_yaml`` is present, it takes precedence: return it as-is, ensuring
      the ``extends: spectral:oas`` directive is present (prepend if missing).
    - Otherwise serialise ``rules_json`` (Structured Rules) into valid Spectral YAML
      alongside ``extends: spectral:oas`` (when requested).

    Args:
        user_ruleset: Dict with optional keys ``rules_json`` (list) and
                      ``raw_yaml`` (str), as stored in ``LintRuleset``.
        extend_oas: Whether to prepend ``extends: spectral:oas``. Set False
                    for single-rule previews, where the built-in OAS ruleset
                    would drown the one rule being tested in unrelated results.

    Returns:
        A YAML string ready to be written to a ``.spectral.yaml`` temp file.
    """
    base: Dict[str, Any] = {"extends": "spectral:oas"} if extend_oas else {}

    if not user_ruleset:
        return yaml.dump(base, default_flow_style=False, sort_keys=False) or "{}\n"

    raw_yaml: Optional[str] = user_ruleset.get("raw_yaml")
    rules_json: Optional[List[Dict[str, Any]]] = user_ruleset.get("rules_json")

    # --- Raw YAML override takes precedence ---
    if raw_yaml:
        stripped = raw_yaml.strip()
        # Ensure the baseline is always extended. A plain substring check for
        # "spectral:oas" would wrongly re-prepend it onto a ruleset that
        # already extends the other allowed baseline, spectral:asyncapi (see
        # _ALLOWED_EXTENDS_VALUES) -- that string never appears in
        # "spectral:asyncapi", so it would gain a second, conflicting
        # top-level `extends:` key. Parse instead and only prepend when
        # there's genuinely no `extends` key yet; anything already present
        # is guaranteed to be spectral:oas or spectral:asyncapi by
        # validate_ruleset_yaml_is_safe, which every raw_yaml value passes
        # through before it can be saved.
        already_extends = False
        try:
            parsed = yaml.safe_load(stripped)
            already_extends = isinstance(parsed, dict) and "extends" in parsed
        except yaml.YAMLError:
            pass
        if extend_oas and not already_extends:
            stripped = "extends: spectral:oas\n" + stripped
        return stripped + "\n"

    # --- Structured Rules → generated YAML ---
    if not rules_json:
        return yaml.dump(base, default_flow_style=False, sort_keys=False) or "{}\n"

    ruleset: Dict[str, Any] = {**base, "rules": {}}
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



