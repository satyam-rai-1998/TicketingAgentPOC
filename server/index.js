require("dotenv").config();
const path = require("path");
const express = require("express");
const { requireAuth } = require("./middleware/auth");
const { rateLimit } = require("./middleware/rateLimit");
const ticketsRouter = require("./routes/tickets");
const widgetRouter = require("./routes/widget");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Dashboard (static, unauthenticated — POC only, no login system)
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/v2/health", (req, res) => res.json({ ok: true }));

// Lets the unauthenticated dashboard pick up the API token for its own fetch() calls.
// Fine for a local POC; would need a real session/auth model before this ever left localhost.
app.get("/dashboard-config.json", (req, res) => {
  res.json({ api_token: process.env.API_TOKEN });
});

// Public chat widget: unauthenticated but rate-limited, and can only create
// tickets — registered ahead of the token-gated /api/v2 mount below so it
// isn't shadowed by requireAuth.
app.use(
  "/api/v2/widget",
  rateLimit({ windowMs: 60_000, max: 5 }),
  widgetRouter
);

// API (mirrors Zendesk's /api/v2 convention), token-protected
app.use("/api/v2", requireAuth, ticketsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: { title: "InternalError", message: err.message } });
});

app.listen(PORT, () => {
  console.log(`Zendesk POC ticketing app listening on http://localhost:${PORT}`);
});
