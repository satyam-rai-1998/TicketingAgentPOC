from datetime import datetime
from typing import Optional, List

from sqlmodel import SQLModel, Field, Relationship


class Ticket(SQLModel, table=True):
    __tablename__ = "tickets"

    id: Optional[int] = Field(default=None, primary_key=True)
    subject: str
    description: str
    channel: str  # email | chat | phone | web_form
    requester_name: str
    requester_email: str
    status: str = Field(default="new")  # new | open | pending | solved | closed
    type: Optional[str] = None  # question | incident | problem | task
    priority: str = Field(default="normal")  # low | normal | high | urgent
    group_name: Optional[str] = None
    assignee: Optional[str] = None
    tags: Optional[str] = None  # comma-separated string
    classification_result: Optional[str] = None
    confidence_score: Optional[float] = None
    compliance_status: str = Field(default="none")  # none | pending_review | cleared | actioned
    flag_type: str = Field(default="[]")  # JSON array string, e.g. ["aml","fraud"]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    notes: List["InternalNote"] = Relationship(
        back_populates="ticket",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "order_by": "InternalNote.created_at"},
    )


class InternalNote(SQLModel, table=True):
    __tablename__ = "internal_notes"

    id: Optional[int] = Field(default=None, primary_key=True)
    ticket_id: int = Field(foreign_key="tickets.id")
    text: str
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    ticket: Optional[Ticket] = Relationship(back_populates="notes")
