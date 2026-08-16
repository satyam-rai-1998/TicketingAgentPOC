# Zendesk-like Ticketing POC (FastAPI edition)

A minimal ticketing app built on Python/FastAPI, mirroring Zendesk's REST
API shape and webhook behavior, for testing an external AI agent (built in
Microsoft Copilot Studio) that classifies and routes tickets. Built for
deployment on PythonAnywhere.

## Tech stack

- **Backend:** FastAPI + Uvicorn
- **Database:** SQLite via SQLModel (SQLAlchemy + Pydantic)
- **Frontend:** the same static HTML/JS dashboard/widget from the Node
  version, copied into `public/` unchanged — it only talks to the API over
  HTTP and doesn't care what's behind it.

## Project structure

```
app/main.py                FastAPI app: routes, static mount, error shaping
app/config.py               Settings loaded from .env
app/database.py              SQLModel engine/session
app/models.py                Ticket + InternalNote table models
app/schemas.py                Request schemas, validation constants
app/serializers.py            Ticket -> Zendesk-shaped JSON dict
app/deps.py                  Bearer token auth dependency
app/rate_limit.py             Per-IP rate limit (public widget)
app/routers/tickets.py        Ticket + note CRUD (token-protected)
app/routers/widget.py         Public, unauthenticated ticket creation
app/services/webhook.py       Outbound webhook fan-out with retry
public/                      Dashboard + public support site + chat widget
wsgi.py                      PythonAnywhere entrypoint (ASGI->WSGI adapter)
```

## Local setup

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows; use .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # then edit values as needed
uvicorn app.main:app --reload --port 8000
```

The app runs at `http://localhost:8000` (dashboard) and exposes the API
under `http://localhost:8000/api/v2`. The database file and its tables are
created automatically on startup — no separate migration step (SQLModel
just calls `create_all`, so there's no migration history the way Prisma
had; if you need real migrations later, add Alembic).

**Python version note:** built and tested on Python 3.14. If you hit a
`pydantic-core` build failure on install, it means your Python is newer than
the prebuilt wheels available for the pinned versions — try a slightly
older/newer Python, or `pip install -U pydantic pydantic-core sqlmodel`
before falling back to source builds.

## Environment variables (`.env`)

| Variable             | Purpose                                                        |
|-----------------------|------------------------------------------------------------------|
| `PORT`                | Port for local `uvicorn` runs (not used once deployed on PythonAnywhere) |
| `DATABASE_URL`        | SQLAlchemy URL, e.g. `sqlite:///./ticketing.db`                 |
| `API_TOKEN`           | Token clients must send as `Authorization: Bearer <token>`      |
| `WEBHOOK_TARGET_URL`  | Where outbound ticket-created events are POSTed (Copilot Studio) |
| `WEBHOOK_AUTH_TOKEN`  | Bearer token sent with the outbound webhook request              |

## API

Identical shape to the Node version, with one deliberate tightening: the
request body must always use the Zendesk-style wrapper key (`{"ticket": {...}}`,
`{"note": {...}}`) — this version doesn't accept an unwrapped body as a
fallback.

All routes require `Authorization: Bearer <API_TOKEN>` except the dashboard
static files, `/api/v2/health`, `/dashboard-config.json`, and the public
widget route.

- `POST /api/v2/tickets.json` — create a ticket. Body: `{ "ticket": { "subject", "description", "channel", "requester_name", "requester_email", "type", "priority", ... } }`
- `GET /api/v2/tickets.json` — list tickets. Query params: `status`, `group_name`, `flag_type`
- `GET /api/v2/tickets/{id}.json` — get a ticket, including its internal notes
- `PUT /api/v2/tickets/{id}.json` — update a ticket (status, type, priority, group_name, assignee, tags, classification_result, confidence_score, compliance_status, flag_type, ...)
- `POST /api/v2/tickets/{id}/notes.json` — add an internal note. Body: `{ "note": { "text", "created_by" } }`

**Ticket type** (`type`, nullable): `question | incident | problem | task`.
**Priority** (`priority`, defaults to `normal`): `low | normal | high | urgent`.
**Groups/departments** (`group_name`, free text; dashboard dropdown offers): `IT, HR, Billing, Support, Sales, Compliance, Claims, Policy Services`.

Example:

```bash
curl -X POST http://localhost:8000/api/v2/tickets.json \
  -H "Authorization: Bearer changeme-local-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"ticket":{"subject":"Test","description":"Testing","channel":"web_form","requester_name":"Jane Doe","requester_email":"jane@example.invalid"}}'
```

### Public chat widget endpoint

- `POST /api/v2/widget/tickets.json` — **no auth token required.** Body:
  `{ "requester_name", "requester_email", "description" }`. Always creates
  the ticket with `channel: "chat"`, cannot read/list/update anything, and
  is rate-limited to 5 requests/minute per IP (in-memory — resets on
  restart, and doesn't share state across multiple worker processes).

## Webhook behavior

On every successful ticket creation (admin API or public widget), the app
schedules an async `POST` to `WEBHOOK_TARGET_URL` via FastAPI's
`BackgroundTasks`, so it runs **after** the response is sent under normal
ASGI hosting (`uvicorn`). Payload:

```json
{
  "event": "ticket.created",
  "ticket": {
    "id": 1,
    "subject": "...",
    "description": "...",
    "channel": "web_form",
    "requester_email": "...",
    "created_at": "..."
  }
}
```

- If the call fails, it retries once after 2 seconds.
- Success/failure is logged to stdout with a timestamp.
- **PythonAnywhere caveat:** PythonAnywhere's standard web app hosting only
  serves WSGI, so this app is deployed there through an ASGI→WSGI adapter
  (see below). Under that adapter, `BackgroundTasks` must finish *before*
  the WSGI response can return — so on PythonAnywhere, ticket creation
  requests will actually wait out the webhook call (and its 2s retry delay
  on failure), typically adding 0.1–4s to the response. This was measured
  directly against the adapter (`wsgi.py`) during development. It still
  works correctly, it's just not truly non-blocking there — only true under
  `uvicorn`/other ASGI hosting.

## Dashboard, public support site, chat widget

Unchanged from the Node version — same pages, same behavior, copied as-is
into `public/`:

- **Ticket list** (`/`) — filters, red-highlighted flagged rows, Priority
  column, "Seed test data" button.
- **Ticket detail** (`/ticket.html?id=<id>`) — full fields including Type
  and Priority dropdowns, internal notes, manual update form.
- **Public support site** (`/support.html`) — floating chat bubble; a
  small scripted bot (no AI — that's Copilot Studio's job) collects name,
  email, and issue description, then files a ticket via the widget
  endpoint above.

## Deploying to PythonAnywhere

PythonAnywhere's free/standard "Web app" hosting serves **WSGI** apps.
FastAPI is ASGI, so `wsgi.py` wraps the FastAPI app with `a2wsgi.ASGIMiddleware`
to produce a WSGI-compatible callable.

1. **Upload the code.** Easiest: from a PythonAnywhere Bash console,
   `git clone` your repo, or upload the `fastapi-app/` folder via the Files
   tab.
2. **Create a virtualenv** (PythonAnywhere Bash console):
   ```bash
   cd ~/TicketingAgentPOC/fastapi-app
   python3.10 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
   Use whichever Python version is available on your plan; check
   compatibility if `pydantic-core` fails to install (see the Python
   version note above — PythonAnywhere's available interpreters are
   usually a version or two behind bleeding-edge Python, which is exactly
   what you want here for smoother wheel availability).
3. **Create the `.env` file** on the server (`cp .env.example .env`, then
   edit it — set `DATABASE_URL` to an absolute path, e.g.
   `sqlite:////home/yourusername/TicketingAgentPOC/fastapi-app/ticketing.db`,
   since relative paths depend on the WSGI worker's working directory,
   which PythonAnywhere doesn't guarantee matches this folder).
4. **Web tab → Add a new web app → Manual configuration** (pick the same
   Python version as your virtualenv).
5. Set the **virtualenv path** to `/home/yourusername/TicketingAgentPOC/fastapi-app/.venv`.
6. Edit the **WSGI configuration file** PythonAnywhere generates so it
   points at this app's `wsgi.py`:
   ```python
   import sys
   path = '/home/yourusername/TicketingAgentPOC/fastapi-app'
   if path not in sys.path:
       sys.path.insert(0, path)

   from wsgi import application
   ```
7. **Reload** the web app from the Web tab.
8. **Outbound requests on PythonAnywhere's free tier:** the free plan only
   allows outbound HTTP(S) requests to an allowlist of sites. Copilot
   Studio's trigger URL will very likely be blocked from a free account —
   this only affects the outbound webhook call (ticket creation and every
   other endpoint work fine either way, since they don't require internet
   access). Confirm your plan allows it, or upgrade, before relying on the
   webhook actually reaching Copilot Studio from PythonAnywhere.

## Non-goals (by design, for POC scope)

Same as the Node version:

- No login/auth for the dashboard itself.
- No real email/chat/phone integrations; `channel` is just a stored field.
- No AI/classification logic lives here — that's Copilot Studio's job. This
  app only emits ticket-created events and accepts updates back via `PUT`.
- No Alembic/migration history — `create_all` on startup is enough for a
  POC's SQLite file; add real migrations if this grows past that.
