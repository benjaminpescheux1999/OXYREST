function parseSemver(input) {
  const raw = String(input || "").trim();
  const cleaned = raw.startsWith("v") ? raw.slice(1) : raw;
  const [major = "0", minor = "0", patch = "0"] = cleaned.split(".");
  return {
    major: Number(major) || 0,
    minor: Number(minor) || 0,
    patch: Number(patch) || 0
  };
}

function compareSemver(a, b) {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

module.exports = { compareSemver };

