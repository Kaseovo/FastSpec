"""
LintRulesetRepository — ADR-0005.

Owns persistence of LintRuleset rows (``lint_rulesets`` table): a user may
own several named rulesets, exactly one of which is flagged ``is_default``
at a time. "Exactly one default" and "block delete while in use" are
enforced here rather than via DB constraints, since portable partial-unique
indexes and cross-table delete guards don't map cleanly onto Alembic/SQLite
compatibility.

Returns ORM objects; schema conversion stays in the router.
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import LintRuleset, OpenAPISpec


class LintRulesetRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list(self, user_id: int) -> list[LintRuleset]:
        """Return all rulesets owned by *user_id*, newest first."""
        return (
            self._db.query(LintRuleset)
            .filter(LintRuleset.user_id == user_id)
            .order_by(LintRuleset.created_at.desc())
            .all()
        )

    def get(self, user_id: int, ruleset_id: str) -> LintRuleset | None:
        """Return one ruleset owned by *user_id*, or None if absent/not owned."""
        return (
            self._db.query(LintRuleset)
            .filter(LintRuleset.id == ruleset_id, LintRuleset.user_id == user_id)
            .first()
        )

    def get_default(self, user_id: int) -> LintRuleset | None:
        """Return *user_id*'s is_default ruleset, or None if they have none."""
        return (
            self._db.query(LintRuleset)
            .filter(LintRuleset.user_id == user_id, LintRuleset.is_default.is_(True))
            .first()
        )

    def _unset_current_default(self, user_id: int) -> None:
        self._db.query(LintRuleset).filter(
            LintRuleset.user_id == user_id, LintRuleset.is_default.is_(True)
        ).update({LintRuleset.is_default: False})

    def create(
        self,
        user_id: int,
        name: str,
        rules_json,
        raw_yaml: str | None,
    ) -> LintRuleset:
        """Create a new named ruleset for *user_id*.

        The first ruleset a user creates is automatically flagged default,
        since a spec falling back to "no default ruleset" would otherwise be
        indistinguishable from "user has no rulesets at all".

        Raises:
            HTTPException 409: if the user already has a ruleset with this name.
        """
        existing = (
            self._db.query(LintRuleset)
            .filter(LintRuleset.user_id == user_id, LintRuleset.name == name)
            .first()
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A ruleset named '{name}' already exists.",
            )

        is_first = self.get_default(user_id) is None
        row = LintRuleset(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            is_default=is_first,
            rules_json=rules_json,
            raw_yaml=raw_yaml,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def update(
        self,
        user_id: int,
        ruleset_id: str,
        name: str | None,
        rules_json,
        raw_yaml: str | None,
        rules_provided: bool,
        raw_yaml_provided: bool,
    ) -> LintRuleset:
        """Update an existing ruleset's name and/or rule content.

        Args:
            rules_provided / raw_yaml_provided: distinguish "field omitted"
            (leave as-is) from "field explicitly set to null/empty" (clear it),
            since rules_json/raw_yaml are both Optional.

        Raises:
            HTTPException 404: if no such ruleset exists for this user.
            HTTPException 409: if renaming collides with another ruleset's name.
        """
        row = self.get(user_id, ruleset_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ruleset not found.",
            )

        if name is not None and name != row.name:
            collision = (
                self._db.query(LintRuleset)
                .filter(
                    LintRuleset.user_id == user_id,
                    LintRuleset.name == name,
                    LintRuleset.id != ruleset_id,
                )
                .first()
            )
            if collision is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A ruleset named '{name}' already exists.",
                )
            row.name = name

        if rules_provided:
            row.rules_json = rules_json
        if raw_yaml_provided:
            row.raw_yaml = raw_yaml

        self._db.commit()
        self._db.refresh(row)
        return row

    def set_default(self, user_id: int, ruleset_id: str) -> LintRuleset:
        """Flag *ruleset_id* as the user's default, unflagging the previous one.

        Raises:
            HTTPException 404: if no such ruleset exists for this user.
        """
        row = self.get(user_id, ruleset_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ruleset not found.",
            )
        self._unset_current_default(user_id)
        row.is_default = True
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete(self, user_id: int, ruleset_id: str) -> None:
        """Delete a ruleset owned by *user_id*.

        Raises:
            HTTPException 404: if no such ruleset exists for this user.
            HTTPException 409: if the ruleset is pinned to one or more specs
                (list them so the user knows what to reassign first), or if
                it's the default and other rulesets exist (a new default must
                be chosen explicitly rather than silently picked for the user).
        """
        row = self.get(user_id, ruleset_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ruleset not found.",
            )

        specs_in_use = (
            self._db.query(OpenAPISpec)
            .filter(OpenAPISpec.active_ruleset_id == ruleset_id)
            .all()
        )
        if specs_in_use:
            names = ", ".join(s.name for s in specs_in_use)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Ruleset is assigned to one or more specs and can't be "
                    f"deleted until they're reassigned: {names}"
                ),
            )

        if row.is_default:
            other_count = (
                self._db.query(LintRuleset)
                .filter(LintRuleset.user_id == user_id, LintRuleset.id != ruleset_id)
                .count()
            )
            if other_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "This is your default ruleset. Set a different ruleset "
                        "as default before deleting it."
                    ),
                )

        self._db.delete(row)
        self._db.commit()
