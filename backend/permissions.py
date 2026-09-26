"""
Permissions and actions definitions for FastSpec API keys and MCP server.

The ACTION_ALL value grants access to all actions, including any added in the future.
"""

from enum import StrEnum


class Action(StrEnum):
    """All possible actions that can be granted via API keys."""

    ALL = "All"
    READ_SPECS = "read:specs"
    WRITE_SPECS = "write:specs"
    DELETE_SPECS = "delete:specs"
    LINT_SPECS = "lint:specs"
    READ_VERSIONS = "read:versions"
    WRITE_VERSIONS = "write:versions"


# Set of all concrete actions (excludes "All")
CONCRETE_ACTIONS: set[str] = {a.value for a in Action if a != Action.ALL}

# Full set of allowed action values (includes "All")
ALLOWED_ACTIONS: set[str] = {a.value for a in Action}


def expand_actions(actions: list[str]) -> set[str]:
    """Expand an action list: if 'All' is present, return all concrete actions."""
    if Action.ALL in actions:
        return CONCRETE_ACTIONS
    return set(actions)


def user_has_action(user_actions: list[str], required_actions: list[str]) -> bool:
    """
    Check if user_actions satisfy the required_actions.
    If user has 'All', they have access to everything.
    Otherwise, user must have at least one of the required actions.
    """
    if Action.ALL in user_actions:
        return True
    return any(action in user_actions for action in required_actions)


def get_actions_metadata() -> list[dict]:
    """Return metadata about all available actions for the frontend."""
    descriptions = {
        Action.ALL: "Grants access to all actions, including any added in the future",
        Action.READ_SPECS: "Read and list OpenAPI specifications",
        Action.WRITE_SPECS: "Create and update OpenAPI specifications",
        Action.DELETE_SPECS: "Delete OpenAPI specifications",
        Action.LINT_SPECS: "Run linting on OpenAPI specifications",
        Action.READ_VERSIONS: "Read and list spec versions",
        Action.WRITE_VERSIONS: "Create and publish spec versions",
    }
    return [{"value": a.value, "description": descriptions.get(a, "")} for a in Action]
