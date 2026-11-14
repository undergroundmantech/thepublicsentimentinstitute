// ONE call policy for every election-night page. Pure.
//
// Three different things, never merged:
//   provider call     the results provider (civicAPI) marks a winner. Shown as an official call, sourced to the provider.
//   model estimate    On Point's probability that a candidate finishes ahead. A probability is NOT a call, at any size.
//   editorial call    a decision a named person at On Point makes and records. Not implemented yet: the type is here so
//                     that nothing else can pose as one.
//
// The pages used to turn a model estimate into an "OnPoint Projection" on their own once the estimate said 50% of the
// vote was counted and the chance was 99.5% or more, each page with its own copy of the rule (and not the same copy).
// That rule is now in one place and is OFF unless an operator sets NEXT_PUBLIC_ONPOINT_AUTO_PROJECTION=on. Even then
// it is a labelled model suggestion, never an official or editorial call.
import { FLAGS } from "../flags";

export type ProviderCall = { origin: "provider"; source: string; winner: { name: string; party: string | null } };
export type EditorialCall = { origin: "editorial"; winner: { name: string; party: string | null }; decidedBy: string; decidedAt: string; reason: string; snapshotId: string | null; withdrawn?: boolean };
export type ModelSuggestion = { origin: "model"; side: "A" | "B"; leadProbPct: number; pctIn: number };

/** The old automatic rule's thresholds, kept so the flag reproduces it exactly. */
export const AUTO_PROJECTION_RULE = { minPctIn: 50, minLeadProbPct: 99.5 } as const;

export type SuggestionInput = {
  /** a published forecast stands behind the estimate (no forecast, no prior, no suggestion) */
  hasForecast: boolean;
  /** the provider has already called it: the provider's call stands and nothing is suggested */
  providerCalled: boolean;
  /** counted votes in the estimate */
  countedVotes: number;
  /** the estimate's share of the expected vote counted, 0 to 100 */
  pctIn: number;
  /** the model's chance for whoever it has ahead, 0 to 100 */
  leadProbPct: number;
};

/** Whether the model alone may label this race a projection. False for everything unless the operator flag is on. */
export function modelSuggestionAllowed(i: SuggestionInput, enabled: boolean = FLAGS.autoProjection): boolean {
  if (!enabled) return false;
  if (!i.hasForecast || i.providerCalled) return false;
  if (!(i.countedVotes > 0) || !Number.isFinite(i.pctIn) || !Number.isFinite(i.leadProbPct)) return false;
  return i.pctIn >= AUTO_PROJECTION_RULE.minPctIn && i.leadProbPct >= AUTO_PROJECTION_RULE.minLeadProbPct;
}
/** True when model suggestions are switched on at all, so a page can skip the work when they are not. */
export const modelSuggestionsEnabled = (enabled: boolean = FLAGS.autoProjection) => enabled;
