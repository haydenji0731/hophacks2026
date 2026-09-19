from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Platform(str, enum.Enum):
    phone = "phone"
    sms = "sms"
    web = "web"
    discord = "discord"
    other = "other"


class Demand(str, enum.Enum):
    cash = "cash"
    gift_card = "gift_card"
    wire = "wire"
    crypto = "crypto"
    check = "check"
    other = "other"


class Base(DeclarativeBase):
    pass


platform_enum = ENUM(Platform, name="platform_enum", create_type=True)
demand_enum = ENUM(Demand, name="demand_enum", create_type=True)


class Scam(Base):
    """One row = one known scam type / pattern (not a single incident)."""

    __tablename__ = "scams"
    __table_args__ = (
        Index("ix_scams_platforms", "platforms", postgresql_using="gin"),
        Index("ix_scams_victim_roles", "victim_roles", postgresql_using="gin"),
        Index("ix_scams_demands", "demands", postgresql_using="gin"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    platforms: Mapped[list[Platform]] = mapped_column(
        ARRAY(platform_enum),
        nullable=False,
        server_default="{}",
    )
    ai_generated: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    victim_roles: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        server_default="{}",
    )
    demands: Mapped[list[Demand]] = mapped_column(
        ARRAY(demand_enum),
        nullable=False,
        server_default="{}",
    )
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    frequency: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return f"<Scam id={self.id!s} name={self.name!r} frequency={self.frequency}>"
