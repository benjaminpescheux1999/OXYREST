export function parseSemver(input: string): [number, number, number, number] {
  const cleaned = input.trim().replace(/^v/i, "");
  const parts = cleaned.split(".").map((x) => Number(x) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts[3] || 0];
}

export function compareSemver(a: string, b: string): number {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  for (let i = 0; i < 4; i++) {
    if (va[i] !== vb[i]) return va[i] - vb[i];
  }
  return 0;
}

