"""
LintRulesetRepository — ADR-0004.

Owns persistence of the User Lint Ruleset (``user_lint_rulesets`` table).
Returns ORM objects; schema conversion stays in the router.
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import UserLintRuleset


class LintRulesetRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get(self, user_id: int) -> UserLintRuleset | None:
        """Return the UserLintRuleset row for *user_id*, or None if absent."""
        return (
            self._db.query(UserLintRuleset)
            .filter(UserLintRuleset.user_id == user_id)
            .first()
        )

    def upsert(
        self,
        user_id: int,
        rules_json,
        raw_yaml: str | None,
    ) -> UserLintRuleset:
        """Create or replace the UserLintRuleset for *user_id*."""
        row = self.get(user_id)
        if row is None:
            row = UserLintRuleset(
                id=str(uuid.uuid4()),
                user_id=user_id,
                rules_json=rules_json,
                raw_yaml=raw_yaml,
            )
            self._db.add(row)
        else:
            row.rules_json = rules_json
            row.raw_yaml = raw_yaml
        self._db.commit()
        self._db.refresh(row)
        return row

    def delete(self, user_id: int) -> None:
        """Delete the UserLintRuleset for *user_id*.

        Raises:
            HTTPException 404: if no ruleset exists for this user.
        """
        row = self.get(user_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No custom ruleset configured for this user.",
            )
        self._db.delete(row)
        self._db.commit()
