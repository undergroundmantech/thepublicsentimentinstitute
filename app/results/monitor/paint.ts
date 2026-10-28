// A unit with votes counted paints its reported margin; one with none yet carries only its expected margin,
// which the monitor hatches or outlines and never fills like a result.
export type UnitPaint = { kind: "reported"; m: number } | { kind: "expected"; m: number } | { kind: "none" };

export function paintUnit(reported: number | null | undefined, expected: number | null | undefined): UnitPaint {
  if (reported != null) return { kind: "reported", m: reported };
  if (expected != null) return { kind: "expected", m: expected };
  return { kind: "none" };
}

/** The dashed outline of a seat or tile nobody has counted yet: bluer or redder by how sure the forecast is. */
export function leanStroke(pR: number | null | undefined) {
  const p = pR ?? 0.5, d = Math.abs(p - 0.5) * 2;
  if (d < 0.2) return "rgba(231, 179, 65, .85)";
  return p < 0.5 ? `rgba(61, 123, 255, ${0.45 + d * 0.5})` : `rgba(255, 59, 92, ${0.45 + d * 0.5})`;
}
