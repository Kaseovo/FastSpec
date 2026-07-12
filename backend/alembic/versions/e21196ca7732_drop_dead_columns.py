"""drop dead columns: auth_tokens.token (plaintext JWT), users.session_version

Revision ID: e21196ca7732
Revises: 1a1da60e5c18
Create Date: 2026-07-12 00:00:00.000000

Neither column is ever read: revocation works entirely off `jti`, and
`session_version` had no code path that incremented or compared it. Storing
the full JWT in `auth_tokens.token` meant a DB leak was a session-hijack kit
for every active session; dropping it removes that exposure outright.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e21196ca7732'
down_revision: Union[str, None] = '1a1da60e5c18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('auth_tokens', 'token')
    op.drop_column('users', 'session_version')


def downgrade() -> None:
    op.add_column(
        'users',
        sa.Column('session_version', sa.Integer(), server_default='0', nullable=False),
    )
    op.add_column(
        'auth_tokens',
        sa.Column('token', sa.Text(), nullable=False, server_default=''),
    )
