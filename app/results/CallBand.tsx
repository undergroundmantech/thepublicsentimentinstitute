import React from "react";
import { callCopy, type CallKind } from "./callStatus";
import "./callStatus.css";

/** The band above reported results: a solid check for an official call, a dashed, hatched band for a projection. */
export default function CallBand({ kind, name, contest, calledBy, detail }: {
  kind: CallKind; name: string; contest?: string; calledBy?: string; detail: React.ReactNode;
}) {
  const t = callCopy(kind, name, contest, calledBy);
  if (kind === "official") {
    return (
      <div className="winner-band">
        <span className="winner-badge" aria-hidden>{t.mark}</span>
        <div className="winner-copy"><span>{t.eyebrow}</span><strong>{t.headline}</strong><small>{detail}</small></div>
      </div>
    );
  }
  return (
    <div className="proj-band">
      <span className="proj-badge" aria-hidden />
      <div className="proj-copy"><span>{t.eyebrow}</span><strong>{t.headline}</strong><small>{detail}</small></div>
    </div>
  );
}
