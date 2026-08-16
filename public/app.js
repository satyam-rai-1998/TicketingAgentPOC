let apiToken = null;

async function getApiToken() {
  if (apiToken) return apiToken;
  const res = await fetch("/dashboard-config.json");
  const config = await res.json();
  apiToken = config.api_token;
  return apiToken;
}

async function api(path, options = {}) {
  const token = await getApiToken();
  const res = await fetch(`/api/v2${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`);
  }
  return data;
}

function showToast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Synthetic seed data -------------------------------------------------

const SEED_GROUPS = ["IT", "HR", "Billing", "Support", "Sales", "Claims", "Policy Services"];
const SEED_CHANNELS = ["email", "chat", "phone", "web_form"];
const SEED_TYPES = ["question", "incident", "problem", "task"];
const SEED_PRIORITIES = ["low", "normal", "normal", "high"];

function seedTicketTemplates() {
  const normal = [
    {
      subject: "Unable to update billing address",
      description: "I moved recently and can't find where to update my billing address on the portal. Can someone help?",
    },
    {
      subject: "Question about policy renewal date",
      description: "My policy is up for renewal soon and I want to confirm the exact date and whether my premium is changing.",
    },
    {
      subject: "Claim status inquiry",
      description: "I submitted a claim last week (claim ref TEST-1042) and haven't heard back. Can you give me a status update?",
    },
    {
      subject: "Website login not working",
      description: "I keep getting an 'invalid credentials' error even after resetting my password twice today.",
    },
    {
      subject: "Request for duplicate invoice",
      description: "Could you please resend the invoice for last month? I misplaced the copy that was emailed to me.",
    },
    {
      subject: "Change of beneficiary request",
      description: "I'd like to change the beneficiary listed on my policy. What form do I need to submit?",
    },
    {
      subject: "Coverage question for new vehicle",
      description: "I just bought a second car and want to know how to add it to my existing auto policy.",
    },
    {
      subject: "Autopay setup help",
      description: "I tried setting up autopay from my checking account but the form keeps rejecting my routing number.",
    },
    {
      subject: "General feedback on mobile app",
      description: "Loving the new mobile app so far, just wanted to say the claims photo upload feature is really smooth.",
    },
    {
      subject: "Cancel policy request",
      description: "I sold the insured property and would like to cancel my homeowner's policy effective end of month.",
    },
    {
      subject: "Documents not loading in portal",
      description: "The 'My Documents' tab has been spinning forever and never loads my policy PDF.",
    },
    {
      subject: "Premium payment confirmation",
      description: "Just want to confirm you received my payment from yesterday, the confirmation email never arrived.",
    },
    {
      subject: "Update phone number on file",
      description: "My phone number changed, please update my contact info so I don't miss any notifications.",
    },
    {
      subject: "Question about deductible",
      description: "Can you clarify what my deductible would be for a windshield-only claim under my current plan?",
    },
  ];

  const flagged = [
    {
      subject: "Suspicious large wire transfer request on account",
      description:
        "Customer is requesting an unusually large wire transfer to a third-party account not previously on file, and is pressuring the agent to skip verification steps. Possible AML concern — flagging for review.",
      flag_type: ["aml"],
      compliance_status: "pending_review",
    },
    {
      subject: "Claim submitted with mismatched documents, possible fraud",
      description:
        "The submitted claim photos appear to be reused stock images and the incident date conflicts with the policy start date. Requesting fraud review before any payout is processed.",
      flag_type: ["fraud"],
      compliance_status: "pending_review",
    },
    {
      subject: "Customer accidentally pasted full SSN and card number in chat",
      description:
        "During a routine support chat, the customer pasted what appears to be a full SSN (test value 000-12-3456) and a card number (test value 4111-1111-1111-1111) into the message box. Flagging for PII handling review.",
      flag_type: ["pii"],
      compliance_status: "pending_review",
    },
    {
      subject: "Structuring pattern suspected across multiple small deposits",
      description:
        "Account shows several deposits just under the reporting threshold within a short window, which may indicate structuring. Escalating for AML review per policy.",
      flag_type: ["aml", "fraud"],
      compliance_status: "pending_review",
    },
    {
      subject: "Request to change payout account minutes before claim approval",
      description:
        "Customer called asking to redirect claim payout to a newly added, unverified bank account just before final approval. This pattern is consistent with known fraud attempts — needs compliance sign-off.",
      flag_type: ["fraud"],
      compliance_status: "pending_review",
    },
  ];

  const templates = [];
  normal.forEach((t, i) => templates.push({ ...t, _flagged: false, _i: i }));
  flagged.forEach((t, i) => templates.push({ ...t, _flagged: true, _i: i }));

  return templates.map((t, idx) => {
    const channel = SEED_CHANNELS[idx % SEED_CHANNELS.length];
    const group = t.flag_type ? "Compliance" : SEED_GROUPS[idx % SEED_GROUPS.length];
    const type = t.flag_type ? "incident" : SEED_TYPES[idx % SEED_TYPES.length];
    const priority = t.flag_type ? "urgent" : SEED_PRIORITIES[idx % SEED_PRIORITIES.length];
    return {
      subject: t.subject,
      description: t.description,
      channel,
      requester_name: `Test User ${idx + 1}`,
      requester_email: `test.user${idx + 1}@example.invalid`,
      group_name: group,
      type,
      priority,
      flag_type: t.flag_type || [],
      compliance_status: t.compliance_status || "none",
      tags: t.flag_type ? ["seed", ...t.flag_type] : ["seed"],
    };
  });
}

async function seedTestData(onProgress) {
  const templates = seedTicketTemplates();
  let created = 0;
  for (const ticket of templates) {
    await api("/tickets.json", { method: "POST", body: JSON.stringify({ ticket }) });
    created += 1;
    if (onProgress) onProgress(created, templates.length);
  }
  return created;
}
