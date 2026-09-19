"""create scams table

Revision ID: 001_create_scams
Revises:
Create Date: 2026-09-19

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_create_scams"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

platform_enum = postgresql.ENUM(
    "phone",
    "sms",
    "web",
    "discord",
    "other",
    name="platform_enum",
    create_type=False,
)
demand_enum = postgresql.ENUM(
    "cash",
    "gift_card",
    "wire",
    "crypto",
    "check",
    "other",
    name="demand_enum",
    create_type=False,
)


def upgrade() -> None:
    platform_enum.create(op.get_bind(), checkfirst=True)
    demand_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "scams",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "platforms",
            postgresql.ARRAY(platform_enum),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
        sa.Column("ai_generated", sa.Boolean(), nullable=True),
        sa.Column(
            "victim_roles",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
        sa.Column(
            "demands",
            postgresql.ARRAY(demand_enum),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("frequency", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(
        "ix_scams_platforms",
        "scams",
        ["platforms"],
        unique=False,
        postgresql_using="gin",
    )
    op.create_index(
        "ix_scams_victim_roles",
        "scams",
        ["victim_roles"],
        unique=False,
        postgresql_using="gin",
    )
    op.create_index(
        "ix_scams_demands",
        "scams",
        ["demands"],
        unique=False,
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_scams_demands", table_name="scams", postgresql_using="gin")
    op.drop_index("ix_scams_victim_roles", table_name="scams", postgresql_using="gin")
    op.drop_index("ix_scams_platforms", table_name="scams", postgresql_using="gin")
    op.drop_table("scams")
    demand_enum.drop(op.get_bind(), checkfirst=True)
    platform_enum.drop(op.get_bind(), checkfirst=True)
