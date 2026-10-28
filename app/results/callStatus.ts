// Only an official call earns the check and "wins"; an On Point projection is always labelled as ours.
export type CallKind = "official" | "projected";

export const callKind = (official: boolean, projected: boolean): CallKind | null =>
  official ? "official" : projected ? "projected" : null;

export function callCopy(kind: CallKind, name: string, contest = "", calledBy = "") {
  const what = contest ? ` ${contest}` : "";
  return kind === "official"
    ? { mark: "✓", eyebrow: `Winner · race called${calledBy ? ` by ${calledBy}` : ""}`, headline: `${name} wins${what}`, chip: "Race called" }
    : { mark: "", eyebrow: "OnPoint Projection · not an official call", headline: `${name} projected to win${what}`, chip: "OnPoint Projection" };
}
