const express = require("express");
const { port } = require("./config");
const { ensureDb } = require("./storage/db");
const systemRoutes = require("./routes/system.routes");
const utilityRoutes = require("./routes/utility.routes");
const clientRoutes = require("./routes/client.routes");
const adminRoutes = require("./routes/admin.routes");

ensureDb();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use((req, _res, next) => {
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/system", systemRoutes);
app.use("/utility", utilityRoutes);
app.use("/client", clientRoutes);
app.use("/admin", adminRoutes);

app.use((err, req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(`[${new Date().toISOString()}] ERROR ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`OxyRest listening on http://localhost:${port}`);
});

