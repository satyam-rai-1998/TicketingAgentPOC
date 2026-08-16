const RETRY_DELAY_MS = 2000;

function log(message) {
  console.log(`[webhook ${new Date().toISOString()}] ${message}`);
}

async function postWebhook(url, token, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Webhook target responded with status ${res.status}`);
  }

  return res;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fires the ticket-created webhook asynchronously. Does not block the caller —
// callers should not await this in the request/response path.
async function sendTicketCreatedWebhook(ticket) {
  const url = process.env.WEBHOOK_TARGET_URL;
  const token = process.env.WEBHOOK_AUTH_TOKEN;

  if (!url) {
    log("skipped — WEBHOOK_TARGET_URL is not configured");
    return;
  }

  const payload = {
    event: "ticket.created",
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      channel: ticket.channel,
      requester_email: ticket.requesterEmail,
      created_at: ticket.createdAt,
    },
  };

  try {
    await postWebhook(url, token, payload);
    log(`success — ticket #${ticket.id} delivered to ${url}`);
    return;
  } catch (err) {
    log(`failed (attempt 1) for ticket #${ticket.id} — ${err.message}, retrying in ${RETRY_DELAY_MS}ms`);
  }

  await sleep(RETRY_DELAY_MS);

  try {
    await postWebhook(url, token, payload);
    log(`success on retry — ticket #${ticket.id} delivered to ${url}`);
  } catch (err) {
    log(`failed (attempt 2, final) for ticket #${ticket.id} — ${err.message}`);
  }
}

module.exports = { sendTicketCreatedWebhook };
