"""
Unit tests for build_ruleset_yaml() in spectral_linter.py.

These tests exercise the pure YAML-generation logic without invoking
the Spectral CLI binary.
"""

import yaml

from validation.spectral_linter import build_ruleset_yaml

# ---------------------------------------------------------------------------
# Baseline / empty input
# ---------------------------------------------------------------------------


def test_no_ruleset_returns_oas_baseline():
    result = build_ruleset_yaml(None)
    assert result == "extends: spectral:oas\n"


def test_empty_dict_returns_oas_baseline():
    result = build_ruleset_yaml({})
    assert result == "extends: spectral:oas\n"


def test_rules_json_none_and_raw_yaml_none_returns_baseline():
    result = build_ruleset_yaml({"rules_json": None, "raw_yaml": None})
    assert result == "extends: spectral:oas\n"


# ---------------------------------------------------------------------------
# raw_yaml path
# ---------------------------------------------------------------------------


def test_raw_yaml_takes_precedence_over_rules_json():
    """When both raw_yaml and rules_json are present, raw_yaml wins."""
    result = build_ruleset_yaml(
        {
            "raw_yaml": "extends: spectral:oas\nrules:\n  my-rule:\n    severity: warn\n",
            "rules_json": [
                {
                    "name": "ignored-rule",
                    "severity": "error",
                    "given": "$",
                    "then_function": "truthy",
                }
            ],
        }
    )
    assert "my-rule" in result
    assert "ignored-rule" not in result


def test_raw_yaml_without_extends_gets_prepended():
    """raw_yaml missing extends: spectral:oas should have it prepended."""
    result = build_ruleset_yaml(
        {"raw_yaml": "rules:\n  my-rule:\n    severity: warn\n"}
    )
    assert result.startswith("extends: spectral:oas")
    assert "my-rule" in result


def test_raw_yaml_with_extends_not_duplicated():
    """raw_yaml that already contains spectral:oas should not get it duplicated."""
    raw = "extends: spectral:oas\nrules:\n  my-rule:\n    severity: warn\n"
    result = build_ruleset_yaml({"raw_yaml": raw})
    assert result.count("spectral:oas") == 1


def test_raw_yaml_extending_asyncapi_is_not_given_a_conflicting_second_extends():
    """A ruleset that legitimately extends spectral:asyncapi (the other
    _ALLOWED_EXTENDS_VALUES entry) must not get `extends: spectral:oas`
    prepended on top of it -- the old substring check ("spectral:oas" not in
    text) missed that "spectral:oas" is not a substring of "spectral:asyncapi",
    so it prepended a second, conflicting top-level extends: key every time."""
    raw = "extends: spectral:asyncapi\nrules:\n  my-rule:\n    severity: warn\n"
    result = build_ruleset_yaml({"raw_yaml": raw})
    parsed = yaml.safe_load(result)
    assert parsed["extends"] == "spectral:asyncapi"
    assert result.count("extends:") == 1


def test_raw_yaml_extending_asyncapi_with_extend_oas_false_is_unchanged():
    raw = "extends: spectral:asyncapi\nrules:\n  my-rule:\n    severity: warn"
    result = build_ruleset_yaml({"raw_yaml": raw}, extend_oas=False)
    assert result == raw + "\n"


def test_raw_yaml_can_override_default_rule_severity():
    """A raw_yaml block that sets an existing spectral:oas rule to 'off' survives intact.

    Note: YAML parses bare 'off' as the boolean False, so the assertion checks for False.
    To keep it as a string, the YAML must quote it: severity: 'off'.
    """
    raw = "extends: spectral:oas\nrules:\n  info-contact: off\n"
    result = build_ruleset_yaml({"raw_yaml": raw})
    parsed = yaml.safe_load(result)
    # YAML 1.1 treats bare 'off' as boolean False
    assert parsed["rules"]["info-contact"] is False


# ---------------------------------------------------------------------------
# Structured rules (rules_json) path
# ---------------------------------------------------------------------------


def test_structured_rules_generates_valid_yaml():
    """A single structured rule produces parseable YAML with extends + rules."""
    ruleset = build_ruleset_yaml(
        {
            "rules_json": [
                {
                    "name": "require-summary",
                    "severity": "warn",
                    "given": "$.paths[*][*]",
                    "then_function": "truthy",
                }
            ]
        }
    )
    parsed = yaml.safe_load(ruleset)
    assert parsed["extends"] == "spectral:oas"
    rule = parsed["rules"]["require-summary"]
    assert rule["severity"] == "warn"
    assert rule["given"] == "$.paths[*][*]"
    assert rule["then"]["function"] == "truthy"


def test_structured_rule_with_pattern_function():
    """Pattern function with options serialises functionOptions correctly."""
    ruleset = build_ruleset_yaml(
        {
            "rules_json": [
                {
                    "name": "path-kebab-case",
                    "severity": "error",
                    "given": "$.paths[*]~",
                    "then_function": "pattern",
                    "then_function_options": {"match": "^(/[a-z0-9-]+)+$"},
                }
            ]
        }
    )
    parsed = yaml.safe_load(ruleset)
    rule = parsed["rules"]["path-kebab-case"]
    assert rule["then"]["function"] == "pattern"
    assert rule["then"]["functionOptions"]["match"] == "^(/[a-z0-9-]+)+$"


def test_structured_rule_message_optional():
    """A rule without a message should not emit a message key."""
    ruleset = build_ruleset_yaml(
        {
            "rules_json": [
                {
                    "name": "no-message-rule",
                    "severity": "info",
                    "given": "$",
                    "then_function": "truthy",
                }
            ]
        }
    )
    parsed = yaml.safe_load(ruleset)
    rule = parsed["rules"]["no-message-rule"]
    assert "message" not in rule


def test_structured_rule_with_message():
    """A rule with a message includes it in the YAML output."""
    ruleset = build_ruleset_yaml(
        {
            "rules_json": [
                {
                    "name": "has-message-rule",
                    "severity": "warn",
                    "given": "$",
                    "then_function": "truthy",
                    "message": "Field {{property}} is required.",
                }
            ]
        }
    )
    parsed = yaml.safe_load(ruleset)
    assert (
        parsed["rules"]["has-message-rule"]["message"]
        == "Field {{property}} is required."
    )


def test_rule_without_name_is_skipped():
    """Rules missing a name key are silently dropped from the output."""
    ruleset = build_ruleset_yaml(
        {
            "rules_json": [
                {
                    "severity": "warn",
                    "given": "$",
                    "then_function": "truthy",
                },  # no name
                {
                    "name": "valid-rule",
                    "severity": "warn",
                    "given": "$",
                    "then_function": "truthy",
                },
            ]
        }
    )
    parsed = yaml.safe_load(ruleset)
    assert "valid-rule" in parsed["rules"]
    assert len(parsed["rules"]) == 1


def test_structured_rules_can_override_default_rule_by_name():
    """
    A structured rule whose name matches an existing spectral:oas rule
    (e.g. 'info-contact') will appear in the generated YAML — Spectral
    will merge it with the baseline, effectively overriding severity.

    NOTE: structured rules always require a `given` and `then` block;
    severity-only overrides are only expressible via raw_yaml.
    """
    ruleset = build_ruleset_yaml(
        {
            "rules_json": [
                {
                    "name": "info-contact",
                    "severity": "off",
                    "given": "$.info",
                    "then_function": "truthy",
                }
            ]
        }
    )
    parsed = yaml.safe_load(ruleset)
    assert "info-contact" in parsed["rules"]
    assert parsed["rules"]["info-contact"]["severity"] == "off"


# ---------------------------------------------------------------------------
# Score calculation (_parse_result)
# ---------------------------------------------------------------------------


def test_score_calculation_floors_at_zero():
    from validation.spectral_linter import _parse_result

    # 11 errors × 10 = 110 penalty → score should be 0, not negative
    many_errors = [
        {"code": "err", "message": "e", "severity": 0, "path": [], "range": {}}
        for _ in range(11)
    ]
    result = _parse_result(many_errors)
    assert result["score"] == 0


def test_score_calculation_mixed():
    from validation.spectral_linter import _parse_result

    issues = [
        {"code": "e1", "message": "m", "severity": 0, "path": [], "range": {}},  # error -10
        {"code": "w1", "message": "m", "severity": 1, "path": [], "range": {}},  # warn  -3
        {"code": "i1", "message": "m", "severity": 2, "path": [], "range": {}},  # info  -1
        {"code": "h1", "message": "m", "severity": 3, "path": [], "range": {}},  # hint  -0
    ]
    result = _parse_result(issues)
    assert result["score"] == 100 - 10 - 3 - 1
    assert result["summary"] == {"error": 1, "warn": 1, "info": 1, "hint": 1}
