from typing import Optional, List, Union

from pydantic import BaseModel, field_validator

VALID_CHANNELS = ["email", "chat", "phone", "web_form"]
VALID_STATUSES = ["new", "open", "pending", "solved", "closed"]
VALID_COMPLIANCE_STATUSES = ["none", "pending_review", "cleared", "actioned"]
VALID_TYPES = ["question", "incident", "problem", "task"]
VALID_PRIORITIES = ["low", "normal", "high", "urgent"]
GROUPS = ["IT", "HR", "Billing", "Support", "Sales", "Compliance", "Claims", "Policy Services"]


def to_csv(value: Union[str, List[str], None]) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, list):
        return ",".join(v.strip() for v in value if v and v.strip())
    return value


def normalize_list(value: Union[str, List[str], None]) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [v.strip() for v in value if v and v.strip()]
    return [v.strip() for v in value.split(",") if v.strip()]


class TicketCreate(BaseModel):
    subject: str
    description: str
    channel: str = "web_form"
    requester_name: str
    requester_email: str
    status: str = "new"
    type: Optional[str] = None
    priority: str = "normal"
    group_name: Optional[str] = None
    assignee: Optional[str] = None
    tags: Union[str, List[str], None] = None
    classification_result: Optional[str] = None
    confidence_score: Optional[float] = None
    compliance_status: str = "none"
    flag_type: Union[str, List[str], None] = None

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v):
        if v not in VALID_CHANNELS:
            raise ValueError(f"channel must be one of {', '.join(VALID_CHANNELS)}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        return v if v in VALID_STATUSES else "new"

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        if v is not None and v not in VALID_TYPES:
            raise ValueError(f"type must be one of {', '.join(VALID_TYPES)}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of {', '.join(VALID_PRIORITIES)}")
        return v

    @field_validator("compliance_status")
    @classmethod
    def validate_compliance_status(cls, v):
        return v if v in VALID_COMPLIANCE_STATUSES else "none"


class TicketCreateWrapper(BaseModel):
    ticket: TicketCreate


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[str] = None
    group_name: Optional[str] = None
    assignee: Optional[str] = None
    tags: Union[str, List[str], None] = None
    classification_result: Optional[str] = None
    confidence_score: Optional[float] = None
    compliance_status: Optional[str] = None
    flag_type: Union[str, List[str], None] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {', '.join(VALID_STATUSES)}")
        return v

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        if v is not None and v not in VALID_TYPES:
            raise ValueError(f"type must be one of {', '.join(VALID_TYPES)}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v is not None and v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of {', '.join(VALID_PRIORITIES)}")
        return v

    @field_validator("compliance_status")
    @classmethod
    def validate_compliance_status(cls, v):
        if v is not None and v not in VALID_COMPLIANCE_STATUSES:
            raise ValueError(f"compliance_status must be one of {', '.join(VALID_COMPLIANCE_STATUSES)}")
        return v


class TicketUpdateWrapper(BaseModel):
    ticket: TicketUpdate


class NoteCreate(BaseModel):
    text: str
    created_by: str = "system"


class NoteCreateWrapper(BaseModel):
    note: NoteCreate


class WidgetTicketCreate(BaseModel):
    requester_name: str
    requester_email: str
    description: str
