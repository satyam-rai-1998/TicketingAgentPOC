import json
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..deps import require_auth
from ..models import InternalNote, Ticket
from ..schemas import (
    NoteCreateWrapper,
    TicketCreateWrapper,
    TicketUpdateWrapper,
    normalize_list,
    to_csv,
)
from ..serializers import serialize_ticket
from ..services.webhook import send_ticket_created_webhook

router = APIRouter(prefix="/api/v2", dependencies=[Depends(require_auth)])


def _not_found():
    return HTTPException(status_code=404, detail={"title": "RecordNotFound", "message": "Ticket not found"})


@router.post("/tickets.json", status_code=201)
def create_ticket(
    body: TicketCreateWrapper,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    data = body.ticket
    ticket = Ticket(
        subject=data.subject,
        description=data.description,
        channel=data.channel,
        requester_name=data.requester_name,
        requester_email=data.requester_email,
        status=data.status,
        type=data.type,
        priority=data.priority,
        group_name=data.group_name,
        assignee=data.assignee,
        tags=to_csv(data.tags),
        classification_result=data.classification_result,
        confidence_score=data.confidence_score,
        compliance_status=data.compliance_status,
        flag_type=json.dumps(normalize_list(data.flag_type)),
    )
    session.add(ticket)
    session.commit()
    session.refresh(ticket)

    serialized = serialize_ticket(ticket)
    # Fire-and-forget: scheduled to run after the response is sent, so it
    # never delays this request.
    background_tasks.add_task(send_ticket_created_webhook, serialized)

    return {"ticket": serialized}


@router.get("/tickets.json")
def list_tickets(
    status: str | None = None,
    group_name: str | None = None,
    flag_type: str | None = None,
    session: Session = Depends(get_session),
):
    query = select(Ticket)
    if status:
        query = query.where(Ticket.status == status)
    if group_name:
        query = query.where(Ticket.group_name == group_name)
    if flag_type:
        query = query.where(Ticket.flag_type.contains(f'"{flag_type}"'))
    query = query.order_by(Ticket.created_at.desc())

    tickets = session.exec(query).all()
    return {"count": len(tickets), "tickets": [serialize_ticket(t) for t in tickets]}


@router.get("/tickets/{ticket_id}.json")
def get_ticket(ticket_id: int, session: Session = Depends(get_session)):
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise _not_found()
    return {"ticket": serialize_ticket(ticket, include_notes=True)}


@router.put("/tickets/{ticket_id}.json")
def update_ticket(
    ticket_id: int,
    body: TicketUpdateWrapper,
    session: Session = Depends(get_session),
):
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise _not_found()

    updates = body.ticket.model_dump(exclude_unset=True)

    if "tags" in updates:
        updates["tags"] = to_csv(updates["tags"])
    if "flag_type" in updates:
        updates["flag_type"] = json.dumps(normalize_list(updates["flag_type"]))

    for field, value in updates.items():
        setattr(ticket, field, value)
    ticket.updated_at = datetime.now(timezone.utc)

    session.add(ticket)
    session.commit()
    session.refresh(ticket)

    return {"ticket": serialize_ticket(ticket)}


@router.post("/tickets/{ticket_id}/notes.json", status_code=201)
def add_note(
    ticket_id: int,
    body: NoteCreateWrapper,
    session: Session = Depends(get_session),
):
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise _not_found()

    note = InternalNote(ticket_id=ticket_id, text=body.note.text, created_by=body.note.created_by)
    session.add(note)
    session.commit()
    session.refresh(note)

    return {
        "note": {
            "id": note.id,
            "ticket_id": note.ticket_id,
            "text": note.text,
            "created_by": note.created_by,
            "created_at": note.created_at,
        }
    }
