// Minimal in-memory per-IP rate limiter for the unauthenticated public
// widget endpoint. Good enough for a POC; not meant to survive a restart
// or run across multiple server instances.
function rateLimit({ windowMs, max }) {
  const hits = new Map(); // ip -> array of request timestamps

  return function (req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((ts) => now - ts < windowMs);

    if (recent.length >= max) {
      return res.status(429).json({
        error: { title: "TooManyRequests", message: "Please wait a moment before submitting again." },
      });
    }

    recent.push(now);
    hits.set(ip, recent);
    next();
  };
}

module.exports = { rateLimit };
