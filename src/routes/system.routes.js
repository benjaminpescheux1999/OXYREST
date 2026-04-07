const express = require("express");
const { apiVersions, minSupportedUtilityVersion } = require("../config");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "OxyRest",
    time: new Date().toISOString()
  });
});

router.get("/versions", (_req, res) => {
  res.json({
    apiVersions,
    minSupportedUtilityVersion
  });
});

module.exports = router;

