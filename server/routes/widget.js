const express = require("express");
const prisma = require("../db");
const { sendTicketCreatedWebhook } = require("../services/webhook");
const { serializeTicket } = require("../ticketSerializer");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = 4000;

function badRequest(res, message) {
  return res.status(400).json({ error: { title: "InvalidRecord", message } });
}

// POST /api/v2/widget/tickets.json
// Unauthenticated, rate-limited endpoint the public chat widget uses to file
// a ticket on a visitor's behalf. Deliberately narrower than the agent API
// in routes/tickets.js — it can only create a "chat" ticket, nothing else.
router.post("/tickets.json", async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = (body.requester_name || "").trim();
    const email = (body.requester_email || "").trim();
    const description = (body.description || "").trim();

    if (!name || !email || !description) {
      return badRequest(res, "requester_name, requester_email, and description are required");
    }
    if (!EMAIL_RE.test(email)) {
      return badRequest(res, "requester_email must be a valid email address");
    }
    if (description.length > MAX_LEN || name.length > 200) {
      return badRequest(res, "input too long");
    }

    const subject = description.length > 80 ? `${description.slice(0, 77)}...` : description;

    const ticket = await prisma.ticket.create({
      data: {
        subject,
        description,
        channel: "chat",
        requesterName: name,
        requesterEmail: email,
        status: "new",
        tags: "chat-widget",
        flagType: "[]",
      },
    });

    sendTicketCreatedWebhook(ticket).catch(() => {});

    res.status(201).json({ ticket: serializeTicket(ticket) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
