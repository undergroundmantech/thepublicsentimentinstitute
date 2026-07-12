"use client";

import { useEffect, useState } from "react";
import SiteIntro from "./SiteIntro";

// Client-side rollout bootstrap — fetches the deploy's flag config and mounts
// whatever the current stage enables. SiteIntro ships in every build and
// stays dark until its flag is on.
type Flags = Record<string, { enabled?: boolean; stage?: string }>;

export default function RolloutGate() {
  const [flags, setFlags] = useState<Flags | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/flags", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.flags) setFlags(d.flags);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!flags?.["site-v2-announcement"]?.enabled) return null;
  return <SiteIntro />;
}
