"""replace per-user UserLintRuleset with named, multi-ruleset LintRuleset model

Revision ID: f3a9c2d1b7e4
Revises: b6f1d8c4a9e2
Create Date: 2026-07-20 00:00:00.000000

Custom lint rulesets move from "exactly one global ruleset per user" to
"multiple named rulesets per user, one flagged is_default, each spec may
pin a specific ruleset via active_ruleset_id". No real users exist yet
(pre-launch), so this is a hard cutover rather than a data migration.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f3a9c2d1b7e4"
down_revision: Union[str, None] = "b6f1d8c4a9e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lint_rulesets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("rules_json", sa.JSON(), nullable=True),
        sa.Column("raw_yaml", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.UniqueConstraint("user_id", "name", name="uix_lint_rulesets_user_id_name"),
    )
    op.create_index(
        "ix_lint_rulesets_id", "lint_rulesets", ["id"], unique=False
    )
    op.create_index(
        "ix_lint_rulesets_user_id", "lint_rulesets", ["user_id"], unique=False
    )

    op.add_column(
        "openapi_specs",
        sa.Column(
            "active_ruleset_id",
            sa.String(length=36),
            sa.ForeignKey("lint_rulesets.id"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_openapi_specs_active_ruleset_id",
        "openapi_specs",
        ["active_ruleset_id"],
        unique=False,
    )

    op.drop_table("user_lint_rulesets")


def downgrade() -> None:
    op.create_table(
        "user_lint_rulesets",
        sa.Column("id", sa.String(length=36), primary_key=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            unique=True,
            nullable=False,
            index=True,
        ),
        sa.Column("rules_json", sa.JSON(), nullable=True),
        sa.Column("raw_yaml", sa.Text(), nullable=True),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    op.drop_index("ix_openapi_specs_active_ruleset_id", table_name="openapi_specs")
    op.drop_column("openapi_specs", "active_ruleset_id")

    op.drop_index("ix_lint_rulesets_user_id", table_name="lint_rulesets")
    op.drop_index("ix_lint_rulesets_id", table_name="lint_rulesets")
    op.drop_table("lint_rulesets")
