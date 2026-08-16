const VALID_CHANNELS = ["email", "chat", "phone", "web_form"];
const VALID_STATUSES = ["new", "open", "pending", "solved", "closed"];
const VALID_COMPLIANCE_STATUSES = ["none", "pending_review", "cleared", "actioned"];
const VALID_TYPES = ["question", "incident", "problem", "task"];
const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];
const GROUPS = ["IT", "HR", "Billing", "Support", "Sales", "Compliance", "Claims", "Policy Services"];

function toArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function serializeTicket(ticket, { includeNotes = false } = {}) {
  const out = {
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    channel: ticket.channel,
    requester_name: ticket.requesterName,
    requester_email: ticket.requesterEmail,
    status: ticket.status,
    type: ticket.type,
    priority: ticket.priority,
    group_name: ticket.groupName,
    assignee: ticket.assignee,
    tags: toArray(ticket.tags),
    classification_result: ticket.classificationResult,
    confidence_score: ticket.confidenceScore,
    compliance_status: ticket.complianceStatus,
    flag_type: JSON.parse(ticket.flagType || "[]"),
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
  };

  if (includeNotes) {
    out.notes = (ticket.notes || []).map((n) => ({
      id: n.id,
      ticket_id: n.ticketId,
      text: n.text,
      created_by: n.createdBy,
      created_at: n.createdAt,
    }));
  }

  return out;
}

module.exports = {
  VALID_CHANNELS,
  VALID_STATUSES,
  VALID_COMPLIANCE_STATUSES,
  VALID_TYPES,
  VALID_PRIORITIES,
  GROUPS,
  toArray,
  serializeTicket,
};
