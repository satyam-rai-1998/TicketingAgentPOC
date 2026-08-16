function requireAuth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token || token !== process.env.API_TOKEN) {
    return res.status(401).json({
      error: {
        title: "Unauthorized",
        message: "Missing or invalid Authorization: Bearer <token> header",
      },
    });
  }

  next();
}

module.exports = { requireAuth };
