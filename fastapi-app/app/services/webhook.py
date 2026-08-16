import asyncio
from datetime import datetime, timezone

import httpx

from ..config import settings

RETRY_DELAY_SECONDS = 2


def _log(message: str) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    print(f"[webhook {ts}] {message}")


async def _post_webhook(payload: dict) -> None:
    headers = {"Content-Type": "application/json"}
    if settings.webhook_auth_token:
        headers["Authorization"] = f"Bearer {settings.webhook_auth_token}"

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(settings.webhook_target_url, headers=headers, json=payload)
        response.raise_for_status()


async def send_ticket_created_webhook(ticket: dict) -> None:
    """Fire-and-forget: scheduled via BackgroundTasks so it never delays the
    API response. Retries once, 2 seconds after a failed attempt."""
    if not settings.webhook_target_url:
        _log("skipped — WEBHOOK_TARGET_URL is not configured")
        return

    payload = {
        "event": "ticket.created",
        "ticket": {
            "id": ticket["id"],
            "subject": ticket["subject"],
            "description": ticket["description"],
            "channel": ticket["channel"],
            "requester_email": ticket["requester_email"],
            "created_at": ticket["created_at"],
        },
    }

    try:
        await _post_webhook(payload)
        _log(f"success — ticket #{ticket['id']} delivered to {settings.webhook_target_url}")
        return
    except Exception as err:  # noqa: BLE001 — POC: log and retry regardless of failure kind
        _log(f"failed (attempt 1) for ticket #{ticket['id']} — {err}, retrying in {RETRY_DELAY_SECONDS}s")

    await asyncio.sleep(RETRY_DELAY_SECONDS)

    try:
        await _post_webhook(payload)
        _log(f"success on retry — ticket #{ticket['id']} delivered to {settings.webhook_target_url}")
    except Exception as err:  # noqa: BLE001
        _log(f"failed (attempt 2, final) for ticket #{ticket['id']} — {err}")
