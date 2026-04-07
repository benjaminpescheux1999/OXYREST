const { adminApiKey } = require("../config");

function requireAdminApiKey(req, res, next) {
  const incoming = String(req.headers["x-admin-key"] || "");
  if (!incoming || incoming !== adminApiKey) {
    return res.status(401).json({ error: "unauthorized_admin" });
  }
  return next();
}

module.exports = { requireAdminApiKey };

