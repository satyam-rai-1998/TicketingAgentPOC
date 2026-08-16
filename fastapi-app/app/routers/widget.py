import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlmodel import Session

from ..database import get_session
from ..models import Ticket
from ..rate_limit import rate_limit
from ..schemas import WidgetTicketCreate
from ..serializers import serialize_ticket
from ..services.webhook import send_ticket_created_webhook

router = APIRouter(prefix="/api/v2/widget", dependencies=[Depends(rate_limit(window_seconds=60, max_requests=5))])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MAX_LEN = 4000


# Unauthenticated, rate-limited endpoint the public chat widget uses to file
# a ticket on a visitor's behalf. Deliberately narrower than the agent API
# in routers/tickets.py — it can only create a "chat" ticket, nothing else.
@router.post("/tickets.json", status_code=201)
def create_widget_ticket(
    body: WidgetTicketCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    name = body.requester_name.strip()
    email = body.requester_email.strip()
    description = body.description.strip()

    if not name or not email or not description:
        raise HTTPException(
            status_code=400,
            detail={"title": "InvalidRecord", "message": "requester_name, requester_email, and description are required"},
        )
    if not EMAIL_RE.match(email):
        raise HTTPException(
            status_code=400,
            detail={"title": "InvalidRecord", "message": "requester_email must be a valid email address"},
        )
    if len(description) > MAX_LEN or len(name) > 200:
        raise HTTPException(status_code=400, detail={"title": "InvalidRecord", "message": "input too long"})

    subject = f"{description[:77]}..." if len(description) > 80 else description

    ticket = Ticket(
        subject=subject,
        description=description,
        channel="chat",
        requester_name=name,
        requester_email=email,
        status="new",
        tags="chat-widget",
        flag_type="[]",
    )
    session.add(ticket)
    session.commit()
    session.refresh(ticket)

    serialized = serialize_ticket(ticket)
    background_tasks.add_task(send_ticket_created_webhook, serialized)

    return {"ticket": serialized}
