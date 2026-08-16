# Zendesk-like Ticketing POC

A minimal ticketing app that mirrors Zendesk's REST API shape and webhook
behavior, for testing an external AI agent (built in Microsoft Copilot
Studio) that classifies and routes tickets. Swap this app for real Zendesk
later with minimal changes on the Copilot Studio side.

## Tech stack

- **Backend:** Node.js + Express
- **Database:** SQLite via Prisma
- **Frontend:** Static HTML/JS admin dashboard (no build step)

## Project structure

```
prisma/schema.prisma          Ticket + InternalNote data model
server/index.js               Express app entry point
server/db.js                  Prisma client
server/ticketSerializer.js    Shared ticket JSON shaping + field constants
server/middleware/auth.js     Bearer token auth check (admin API)
server/middleware/rateLimit.js  Per-IP rate limit (public widget API)
server/routes/tickets.js      Ticket + note CRUD routes (token-protected)
server/routes/widget.js       Public, unauthenticated ticket-creation route
server/services/webhook.js    Outbound webhook fan-out with retry
public/index.html, ticket.html  Admin dashboard (list + detail views)
public/support.html           Public support site
public/widget.js, widget.css  Chat bot widget (creates tickets)
```

## Setup

```bash
npm install
cp .env.example .env      # then edit values as needed
npx prisma migrate dev --name init
npm run dev
```

The app runs at `http://localhost:3000` (dashboard) and exposes the API
under `http://localhost:3000/api/v2`.

## Environment variables (`.env`)

| Variable             | Purpose                                                        |
|-----------------------|------------------------------------------------------------------|
| `PORT`                | Port the Express server listens on                              |
| `DATABASE_URL`        | SQLite file path, e.g. `file:./ticketing.db`                    |
| `API_TOKEN`           | Token clients must send as `Authorization: Bearer <token>`      |
| `WEBHOOK_TARGET_URL`  | Where outbound ticket-created events are POSTed (Copilot Studio) |
| `WEBHOOK_AUTH_TOKEN`  | Bearer token sent with the outbound webhook request              |

## API

All routes require `Authorization: Bearer <API_TOKEN>` except the dashboard
static files, `/api/v2/health`, `/dashboard-config.json` (used only so
the browser dashboard can pick up the token — see note in Non-goals), and
the public widget route below.

- `POST /api/v2/tickets.json` — create a ticket. Body: `{ "ticket": { "subject", "description", "channel", "requester_name", "requester_email", "type", "priority", ... } }`
- `GET /api/v2/tickets.json` — list tickets. Query params: `status`, `group_name`, `flag_type`
- `GET /api/v2/tickets/:id.json` — get a ticket, including its internal notes
- `PUT /api/v2/tickets/:id.json` — update a ticket (status, type, priority, group_name, assignee, tags, classification_result, confidence_score, compliance_status, flag_type, ...)
- `POST /api/v2/tickets/:id/notes.json` — add an internal note. Body: `{ "note": { "text", "created_by" } }`

**Ticket type** (`type`, nullable): `question | incident | problem | task` — mirrors Zendesk's ticket type field.

**Priority** (`priority`, defaults to `normal`): `low | normal | high | urgent`.

**Groups/departments** (`group_name`, free text but the dashboard's dropdown offers): `IT, HR, Billing, Support, Sales, Compliance, Claims, Policy Services`. Use this field to route a ticket to a department; `assignee` is a free-text field for the individual agent within that department.

Example:

```bash
curl -X POST http://localhost:3000/api/v2/tickets.json \
  -H "Authorization: Bearer changeme-local-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"ticket":{"subject":"Test","description":"Testing","channel":"web_form","requester_name":"Jane Doe","requester_email":"jane@example.invalid"}}'
```

### Public chat widget endpoint

- `POST /api/v2/widget/tickets.json` — **no auth token required.** This is
  the only endpoint meant to be reachable by anonymous site visitors. Body:
  `{ "requester_name", "requester_email", "description" }`. It always
  creates the ticket with `channel: "chat"` and `status: "new"` — it cannot
  read, list, or update tickets, and it's rate-limited to 5 requests/minute
  per IP (in-memory, resets on restart — fine for a POC, not for production).

## Webhook behavior

On every successful ticket creation, the app fires an async `POST` to
`WEBHOOK_TARGET_URL` with:

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

- The webhook call does **not** block the API response — `POST /tickets.json`
  returns immediately after the ticket is saved.
- If the call fails, it retries once after 2 seconds.
- Success/failure is logged to the console with a timestamp.

### Pointing this at Copilot Studio

1. In Copilot Studio, create/open the agent flow you want to trigger from a
   new ticket, and add an HTTP-triggered (webhook-style) trigger to it.
2. Copy the trigger's invocation URL.
3. Set `WEBHOOK_TARGET_URL` in `.env` to that URL, restart the app.
4. If your Copilot Studio trigger expects a bearer token or shared secret,
   set `WEBHOOK_AUTH_TOKEN` accordingly — it's sent as
   `Authorization: Bearer <WEBHOOK_AUTH_TOKEN>` on the outbound call.
5. Have Copilot Studio call back `PUT /api/v2/tickets/:id.json` (with the
   same `API_TOKEN`) to write classification results, group/assignee
   routing, compliance status, and flags back onto the ticket.

## Dashboard

- **Ticket list** (`/`) — table of tickets with status/group filters. Rows
  with any `flag_type` set are highlighted red for compliance visibility.
- **Ticket detail** (`/ticket.html?id=<id>`) — full ticket fields, internal
  notes, and a manual update form (status/group/assignee/etc.) for testing
  without needing Copilot Studio wired up yet.
- **Seed test data** button — creates ~20 synthetic tickets via the real API
  (a mix of normal support tickets and a few with obvious AML/fraud/PII
  keywords, using clearly fake placeholder data) so you have something to
  click through and route immediately.

## Public support site + chat bot

`http://localhost:3000/support.html` is a plain public landing page with a
floating chat bubble (bottom-right). Anyone who opens it can chat with a
small scripted bot (no AI, no external calls) that:

1. Asks for name, then email, then a description of the issue.
2. Validates the email format and requires a non-trivial description.
3. Submits those three fields to `POST /api/v2/widget/tickets.json`, which
   creates a ticket exactly like the admin API does — including firing the
   same outbound webhook to `WEBHOOK_TARGET_URL`.
4. Reports back the new ticket number.

This intentionally has zero classification logic itself — it only collects
enough to file a ticket. Classification/routing still happens downstream in
Copilot Studio via the webhook, same as tickets created any other way.

## Non-goals (by design, for POC scope)

- No login/auth for the dashboard itself. The dashboard fetches the API
  token from an unauthenticated `/dashboard-config.json` endpoint purely so
  its own `fetch()` calls can carry it — fine for local use, not something
  to expose beyond localhost.
- No real email/chat/phone integrations; `channel` is just a stored field.
- No AI/classification logic lives here — that's Copilot Studio's job. This
  app only emits ticket-created events and accepts updates back via `PUT`.
