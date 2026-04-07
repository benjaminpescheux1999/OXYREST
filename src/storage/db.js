const fs = require("fs");
const path = require("path");
const { dataDir } = require("../config");

const dbPath = path.join(dataDir, "db.json");

function ensureDb() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    const seed = {
      utilities: [],
      clients: [],
      apiTokens: [],
      apiCompatibility: [
        {
          utilityVersionRange: ">=0.1.0",
          apiVersion: "v1",
          enabledFeatures: ["sync", "proxy"]
        }
      ]
    };
    fs.writeFileSync(dbPath, JSON.stringify(seed, null, 2), "utf8");
  }

  // Simple in-place migration for existing db.json
  const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  let changed = false;
  if (!Array.isArray(db.apiTokens)) {
    db.apiTokens = [];
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(dbPath, "utf8");
  return JSON.parse(raw);
}

function writeDb(next) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(next, null, 2), "utf8");
}

module.exports = { readDb, writeDb, ensureDb };

