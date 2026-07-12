"use client";

import { useEffect, useState } from "react";
import SiteIntro from "./SiteIntro";

// Client-side rollout bootstrap — fetches the deploy's flag config, applies
// local overrides, and mounts what the evaluation enables. The console API
// mirrors hosted flag SDKs:
//
//   tpsi.flags.list()
//   tpsi.flags.override("site-v2-announcement", true)
//   tpsi.flags.clearOverrides()
//
// Overrides persist in localStorage under "tpsi.flag-overrides" and apply
// live — no reload. Server-evaluated stages still come from /api/flags.

type Flag = { enabled?: boolean; stage?: string };
type Flags = Record<string, Flag>;
type Overrides = Record<string, boolean>;

const OVERRIDE_KEY = "tpsi.flag-overrides";

function readOverrides(): Overrides {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? "{}");
    if (!raw || typeof raw !== "object") return {};
    const out: Overrides = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "boolean") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function evaluate(remote: Flags, overrides: Overrides): Flags {
  const out: Flags = { ...remote };
  for (const [k, v] of Object.entries(overrides)) {
    out[k] = { ...(out[k] ?? {}), enabled: v, stage: "override" };
  }
  return out;
}

export default function RolloutGate() {
  const [remote, setRemote] = useState<Flags>({});
  const [overrides, setOverrides] = useState<Overrides>({});

  useEffect(() => {
    let alive = true;
    setOverrides(readOverrides());
    fetch("/api/flags", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.flags) setRemote(d.flags);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const api = {
      list: () => evaluate(remote, overrides),
      override: (flag: string, enabled: boolean) => {
        const next = { ...readOverrides(), [flag]: !!enabled };
        try {
          localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next));
        } catch {}
        setOverrides(next);
        return `${flag} → ${!!enabled} (local override)`;
      },
      clearOverrides: () => {
        try {
          localStorage.removeItem(OVERRIDE_KEY);
        } catch {}
        setOverrides({});
        return "overrides cleared";
      },
    };
    const w = window as unknown as { tpsi?: Record<string, unknown> };
    w.tpsi = { ...w.tpsi, flags: api };
  }, [remote, overrides]);

  const flags = evaluate(remote, overrides);
  if (!flags["site-v2-announcement"]?.enabled) return null;
  return <SiteIntro />;
}
