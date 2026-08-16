import json

from .models import Ticket


def _to_list(csv: str | None) -> list[str]:
    if not csv:
        return []
    return [v.strip() for v in csv.split(",") if v.strip()]


def serialize_ticket(ticket: Ticket, include_notes: bool = False) -> dict:
    out = {
        "id": ticket.id,
        "subject": ticket.subject,
        "description": ticket.description,
        "channel": ticket.channel,
        "requester_name": ticket.requester_name,
        "requester_email": ticket.requester_email,
        "status": ticket.status,
        "type": ticket.type,
        "priority": ticket.priority,
        "group_name": ticket.group_name,
        "assignee": ticket.assignee,
        "tags": _to_list(ticket.tags),
        "classification_result": ticket.classification_result,
        "confidence_score": ticket.confidence_score,
        "compliance_status": ticket.compliance_status,
        "flag_type": json.loads(ticket.flag_type or "[]"),
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat(),
    }

    if include_notes:
        out["notes"] = [
            {
                "id": n.id,
                "ticket_id": n.ticket_id,
                "text": n.text,
                "created_by": n.created_by,
                "created_at": n.created_at,
            }
            for n in ticket.notes
        ]

    return out
