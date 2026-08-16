(function () {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const STEPS = ["ask_name", "ask_email", "ask_description", "done"];

  let state = {
    step: STEPS[0],
    name: "",
    email: "",
    description: "",
  };

  function resetState() {
    state = { step: STEPS[0], name: "", email: "", description: "" };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildDom() {
    const bubble = document.createElement("button");
    bubble.className = "chat-bubble";
    bubble.setAttribute("aria-label", "Open support chat");
    bubble.textContent = "Chat";
    bubble.style.fontSize = "12px";
    bubble.style.fontWeight = "600";

    const panel = document.createElement("div");
    panel.className = "chat-panel";
    panel.innerHTML = `
      <div class="chat-header">
        <span>Support Chat</span>
        <button type="button" data-action="close" aria-label="Close chat">&times;</button>
      </div>
      <div class="chat-messages" id="chatMessages"></div>
      <form class="chat-input-row" id="chatForm">
        <input type="text" id="chatInput" autocomplete="off" placeholder="Type your reply..." />
        <button type="submit">Send</button>
      </form>
    `;

    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    return { bubble, panel };
  }

  function addMessage(container, text, role) {
    const div = document.createElement("div");
    div.className = `chat-msg ${role}`;
    div.innerHTML = escapeHtml(text);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function botSay(container, text) {
    addMessage(container, text, "bot");
  }

  function startConversation(container) {
    container.innerHTML = "";
    resetState();
    botSay(
      container,
      "Hi there! I'm the support assistant. I can file a ticket for you right now — first, what's your name?"
    );
  }

  async function submitTicket(container, input, sendBtn) {
    botSay(container, "Thanks! Filing your ticket now...");
    sendBtn.disabled = true;
    input.disabled = true;

    try {
      const res = await fetch("/api/v2/widget/tickets.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester_name: state.name,
          requester_email: state.email,
          description: state.description,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error?.message || `Request failed (${res.status})`);
      }

      botSay(
        container,
        `Done — your ticket #${data.ticket.id} has been created. Our team will follow up at ${state.email}.`
      );
      const sys = document.createElement("div");
      sys.className = "chat-msg system";
      sys.textContent = "Conversation ended. Type anything to start a new chat.";
      container.appendChild(sys);
      state.step = "done";
    } catch (err) {
      botSay(container, `Sorry, something went wrong filing your ticket: ${err.message}. Please try again.`);
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  function handleUserInput(container, input, sendBtn, text) {
    addMessage(container, text, "user");

    if (state.step === "ask_name") {
      state.name = text.slice(0, 200);
      state.step = "ask_email";
      botSay(container, `Nice to meet you, ${state.name}. What's your email address?`);
      return;
    }

    if (state.step === "ask_email") {
      if (!EMAIL_RE.test(text)) {
        botSay(container, "That doesn't look like a valid email address — could you try again?");
        return;
      }
      state.email = text;
      state.step = "ask_description";
      botSay(container, "Got it. Please describe the issue you're having, in a sentence or two.");
      return;
    }

    if (state.step === "ask_description") {
      if (text.trim().length < 5) {
        botSay(container, "Could you add a bit more detail so our team knows what to look into?");
        return;
      }
      state.description = text.slice(0, 4000);
      state.step = "submitting";
      submitTicket(container, input, sendBtn);
      return;
    }

    if (state.step === "done") {
      startConversation(container);
      return;
    }
    // state.step === "submitting" — ignore input while the request is in flight
  }

  function init() {
    const { bubble, panel } = buildDom();
    const messages = panel.querySelector("#chatMessages");
    const form = panel.querySelector("#chatForm");
    const input = panel.querySelector("#chatInput");
    const sendBtn = form.querySelector("button[type=submit]");
    const closeBtn = panel.querySelector('[data-action="close"]');

    let started = false;

    bubble.addEventListener("click", () => {
      panel.classList.add("open");
      if (!started) {
        started = true;
        startConversation(messages);
      }
      input.focus();
    });

    closeBtn.addEventListener("click", () => {
      panel.classList.remove("open");
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || state.step === "submitting") return;
      input.value = "";
      handleUserInput(messages, input, sendBtn, text);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
