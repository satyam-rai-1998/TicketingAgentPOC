const express = require("express");
const prisma = require("../db");
const { sendTicketCreatedWebhook } = require("../services/webhook");
const {
  VALID_CHANNELS,
  VALID_STATUSES,
  VALID_COMPLIANCE_STATUSES,
  VALID_TYPES,
  VALID_PRIORITIES,
  toArray,
  serializeTicket,
} = require("../ticketSerializer");

const router = express.Router();

function badRequest(res, message) {
  return res.status(400).json({ error: { title: "InvalidRecord", message } });
}

// POST /api/v2/tickets.json
router.post("/tickets.json", async (req, res, next) => {
  try {
    const body = req.body.ticket || req.body;

    if (!body || !body.subject || !body.description) {
      return badRequest(res, "subject and description are required");
    }
    if (!body.requester_email || !body.requester_name) {
      return badRequest(res, "requester_name and requester_email are required");
    }
    const channel = body.channel || "web_form";
    if (!VALID_CHANNELS.includes(channel)) {
      return badRequest(res, `channel must be one of ${VALID_CHANNELS.join(", ")}`);
    }
    if (body.type !== undefined && body.type !== null && !VALID_TYPES.includes(body.type)) {
      return badRequest(res, `type must be one of ${VALID_TYPES.join(", ")}`);
    }
    if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
      return badRequest(res, `priority must be one of ${VALID_PRIORITIES.join(", ")}`);
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject: body.subject,
        description: body.description,
        channel,
        requesterName: body.requester_name,
        requesterEmail: body.requester_email,
        status: VALID_STATUSES.includes(body.status) ? body.status : "new",
        type: body.type ?? null,
        priority: VALID_PRIORITIES.includes(body.priority) ? body.priority : "normal",
        groupName: body.group_name ?? null,
        assignee: body.assignee ?? null,
        tags: toArray(body.tags).join(","),
        classificationResult: body.classification_result ?? null,
        confidenceScore: body.confidence_score ?? null,
        complianceStatus: VALID_COMPLIANCE_STATUSES.includes(body.compliance_status)
          ? body.compliance_status
          : "none",
        flagType: JSON.stringify(toArray(body.flag_type)),
      },
    });

    // Fire-and-forget: do not block the response on webhook delivery.
    sendTicketCreatedWebhook(ticket).catch(() => {});

    res.status(201).json({ ticket: serializeTicket(ticket) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v2/tickets.json
router.get("/tickets.json", async (req, res, next) => {
  try {
    const { status, group_name, flag_type } = req.query;
    const where = {};

    if (status) where.status = status;
    if (group_name) where.groupName = group_name;
    if (flag_type) where.flagType = { contains: `"${flag_type}"` };

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json({ count: tickets.length, tickets: tickets.map((t) => serializeTicket(t)) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v2/tickets/:id.json
router.get("/tickets/:id.json", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { notes: { orderBy: { createdAt: "asc" } } },
    });

    if (!ticket) {
      return res.status(404).json({ error: { title: "RecordNotFound", message: "Ticket not found" } });
    }

    res.json({ ticket: serializeTicket(ticket, { includeNotes: true }) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v2/tickets/:id.json
router.put("/tickets/:id.json", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: { title: "RecordNotFound", message: "Ticket not found" } });
    }

    const body = req.body.ticket || req.body;
    const data = {};

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return badRequest(res, `status must be one of ${VALID_STATUSES.join(", ")}`);
      }
      data.status = body.status;
    }
    if (body.type !== undefined) {
      if (body.type !== null && !VALID_TYPES.includes(body.type)) {
        return badRequest(res, `type must be one of ${VALID_TYPES.join(", ")}`);
      }
      data.type = body.type;
    }
    if (body.priority !== undefined) {
      if (!VALID_PRIORITIES.includes(body.priority)) {
        return badRequest(res, `priority must be one of ${VALID_PRIORITIES.join(", ")}`);
      }
      data.priority = body.priority;
    }
    if (body.group_name !== undefined) data.groupName = body.group_name;
    if (body.assignee !== undefined) data.assignee = body.assignee;
    if (body.tags !== undefined) data.tags = toArray(body.tags).join(",");
    if (body.classification_result !== undefined) data.classificationResult = body.classification_result;
    if (body.confidence_score !== undefined) data.confidenceScore = body.confidence_score;
    if (body.compliance_status !== undefined) {
      if (!VALID_COMPLIANCE_STATUSES.includes(body.compliance_status)) {
        return badRequest(res, `compliance_status must be one of ${VALID_COMPLIANCE_STATUSES.join(", ")}`);
      }
      data.complianceStatus = body.compliance_status;
    }
    if (body.flag_type !== undefined) data.flagType = JSON.stringify(toArray(body.flag_type));
    if (body.subject !== undefined) data.subject = body.subject;
    if (body.description !== undefined) data.description = body.description;

    const ticket = await prisma.ticket.update({ where: { id }, data });

    res.json({ ticket: serializeTicket(ticket) });
  } catch (err) {
    next(err);
  }
});

// POST /api/v2/tickets/:id/notes.json
router.post("/tickets/:id/notes.json", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ error: { title: "RecordNotFound", message: "Ticket not found" } });
    }

    const body = req.body.note || req.body;
    if (!body || !body.text) {
      return badRequest(res, "text is required");
    }

    const note = await prisma.internalNote.create({
      data: {
        ticketId: id,
        text: body.text,
        createdBy: body.created_by || "system",
      },
    });

    res.status(201).json({
      note: {
        id: note.id,
        ticket_id: note.ticketId,
        text: note.text,
        created_by: note.createdBy,
        created_at: note.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
