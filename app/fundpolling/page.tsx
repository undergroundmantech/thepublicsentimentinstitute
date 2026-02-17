// app/projects/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

type ProjectStatus =
  | "draft"
  | "fundraising"
  | "fielding"
  | "analyzing"
  | "published"
  | "closed";

type PollProject = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  targetPopulation: string;
  sampleSizeTarget: number;
  budgetGoalCents: number;
  fundedCents: number;
  deadlineISO: string; // ISO string
  status: ProjectStatus;
  tags?: string[];
  updatedISO?: string;
};

function formatMoney(cents: number) {
  const dollars = cents / 100;
  return dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function daysLeft(deadlineISO: string) {
  const now = new Date();
  const end = new Date(deadlineISO);
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function statusMeta(status: ProjectStatus) {
  switch (status) {
    case "fundraising":
      return { label: "Fundraising", icon: Wallet, tone: "psi-chip-gradient" };
    case "fielding":
      return { label: "Fielding", icon: Clock, tone: "" };
    case "analyzing":
      return { label: "Analyzing", icon: Sparkles, tone: "" };
    case "published":
      return { label: "Published", icon: CheckCircle2, tone: "" };
    case "closed":
      return { label: "Closed", icon: Lock, tone: "" };
    case "draft":
    default:
      return { label: "Draft", icon: FileText, tone: "" };
  }
}

const DEMO_PROJECTS: PollProject[] = [
  {
    id: "p1",
    slug: "national-sentiment-poll",
    title: "National Sentiment Poll - 2026 Midterm Elections",
    summary:
      "National benchmark measuring head-to-heads, approval, issue salience, and turnout cues across key regions and demographics.",
    targetPopulation: "U.S. Adults, Registered, & Likely Voters",
    sampleSizeTarget: 5000,
    budgetGoalCents: 750000, // $9,500
    fundedCents: 0, // 0
    deadlineISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString(),
    status: "fundraising",
    tags: ["Nationwide", "Likely Voter", "[Public Opinion]"],
    updatedISO: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
];

type SortKey = "deadline" | "progress" | "updated";
type FilterKey = "all" | "fundraising" | "fielding" | "published";

export default function ProjectsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("deadline");

  const projects = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = DEMO_PROJECTS.filter((p) => {
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.targetPopulation.toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q));

      const matchesFilter = filter === "all" ? true : p.status === filter;

      return matchesQuery && matchesFilter;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "progress") {
        const ap = a.budgetGoalCents ? a.fundedCents / a.budgetGoalCents : 0;
        const bp = b.budgetGoalCents ? b.fundedCents / b.budgetGoalCents : 0;
        return bp - ap;
      }
      if (sort === "updated") {
        const ad = a.updatedISO ? new Date(a.updatedISO).getTime() : 0;
        const bd = b.updatedISO ? new Date(b.updatedISO).getTime() : 0;
        return bd - ad;
      }
      // default: deadline soonest
      return (
        new Date(a.deadlineISO).getTime() - new Date(b.deadlineISO).getTime()
      );
    });

    return sorted;
  }, [query, filter, sort]);

  return (
    <div className="psi-animate-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl leading-tight">
              Public Polling Projects
            </h1>
            <p className="mt-2 max-w-2xl">
              Sponsor transparent, methodologically sound research. Funding is
              processed securely and project totals are updated only after
              payment verification.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="psi-chip psi-chip-gradient">
                <ShieldCheck className="h-4 w-4" />
                Secure funding
              </span>
              <span className="psi-chip">
                <CheckCircle2 className="h-4 w-4" />
                Audit-ready totals
              </span>
              <span className="psi-chip">
                <Lock className="h-4 w-4" />
                Server-verified updates
              </span>
            </div>
          </div>

          <div className="psi-panel p-3 sm:p-4 w-full sm:w-[360px]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm m-0 text-[color:var(--foreground)]">
                How it works
              </p>
            </div>
            <p className="text-sm mt-2">
              Contributions go through a secure checkout flow. Funding progress
              is updated from verified payment events only.
            </p>
          </div>
        </div>

        <div className="psi-divider" />

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="psi-panel px-3 py-2 flex items-center gap-2">
              <FileText className="h-4 w-4 opacity-80" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, topics, tags..."
                className="bg-transparent outline-none text-sm w-full sm:w-[320px] placeholder:text-[color:var(--muted2)]"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {(
                [
                  ["all", "All"],
                  ["fundraising", "Fundraising"],
                  ["fielding", "Fielding"],
                  ["published", "Published"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`psi-chip ${
                    filter === key ? "psi-chip-gradient" : ""
                  }`}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="psi-chip">
              <ArrowRight className="h-4 w-4" />
              Sort
            </span>
            <div className="psi-panel px-2 py-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="bg-transparent text-sm outline-none"
              >
                <option value="deadline">Deadline</option>
                <option value="progress">Funding progress</option>
                <option value="updated">Recently updated</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {projects.map((p, idx) => {
          const prog = p.budgetGoalCents
            ? clamp(p.fundedCents / p.budgetGoalCents, 0, 1)
            : 0;

          const left = daysLeft(p.deadlineISO);
          const meta = statusMeta(p.status);
          const StatusIcon = meta.icon;

          const isFundraising = p.status === "fundraising";
          const isFullyFunded =
            p.fundedCents >= p.budgetGoalCents && p.budgetGoalCents > 0;

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.03 }}
              className="psi-card p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`psi-chip ${meta.tone}`}>
                      <StatusIcon className="h-4 w-4" />
                      {meta.label}
                    </span>

                    <span className="psi-chip">
                      <Calendar className="h-4 w-4" />
                      {left >= 0 ? `${left} days left` : "Deadline passed"}
                    </span>

                    {isFundraising && (
                      <span className="psi-chip">
                        <ShieldCheck className="h-4 w-4" />
                        Verified payments
                      </span>
                    )}
                  </div>

                  <h2 className="mt-3 text-xl sm:text-2xl leading-snug">
                    {p.title}
                  </h2>

                  <p className="mt-2 text-sm">{p.summary}</p>

                  {p.tags?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.tags.slice(0, 4).map((t) => (
                        <span key={t} className="psi-chip">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Stats */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="psi-panel p-3">
                  <p className="text-xs m-0">Target</p>
                  <p className="mt-1 text-sm text-[color:var(--foreground)]">
                    {p.targetPopulation}
                  </p>
                </div>
                <div className="psi-panel p-3">
                  <p className="text-xs m-0">Sample</p>
                  <p className="mt-1 text-sm text-[color:var(--foreground)] psi-mono">
                    n = {p.sampleSizeTarget.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Funding */}
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 opacity-80" />
                    <p className="text-sm m-0 text-[color:var(--foreground)]">
                      Funding
                    </p>
                  </div>
                  <p className="text-sm m-0 psi-mono text-[color:var(--foreground)]">
                    {formatMoney(p.fundedCents)} / {formatMoney(p.budgetGoalCents)}
                  </p>
                </div>

                <div className="mt-2 psi-panel p-2">
                  <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(prog * 100)}%`,
                        background:
                          "linear-gradient(90deg, rgba(192,38,61,0.9), rgba(139,44,139,0.9), rgba(91,43,214,0.9))",
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="psi-mono">{Math.round(prog * 100)}%</span>
                    <span className="opacity-80">
                      {isFullyFunded ? "Goal reached" : "In progress"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/projects/${p.slug}`}
                  className="psi-chip psi-lift justify-center"
                >
                  <FileText className="h-4 w-4" />
                  View details
                  <ArrowRight className="h-4 w-4" />
                </Link>

                {isFundraising ? (
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/checkout/create", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          projectId: p.id,
                          amountCents: 2500, // $25 default for now
                        }),
                      });

                      const data = await res.json().catch(() => ({}));

                      if (!res.ok || !data?.url) {
                        alert(data?.error || "Checkout failed.");
                        return;
                      }

                      window.location.href = data.url;
                    }}
                    className="psi-chip psi-chip-gradient justify-center"
                    type="button"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Fund this project
                  </button>
                ) : (
                  <span className="psi-chip justify-center">
                    <Lock className="h-4 w-4" />
                    Funding closed
                  </span>
                )}
              </div>

              {/* Security note */}
              <div className="mt-4 text-xs">
                <span className="inline-flex items-center gap-2 opacity-80">
                  <ShieldCheck className="h-4 w-4" />
                  Totals update after verified payment events.
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty */}
      {projects.length === 0 ? (
        <div className="mt-8 psi-panel p-6 text-center">
          <p className="m-0 text-[color:var(--foreground)]">
            No projects match your search.
          </p>
          <p className="mt-2 text-sm">Try a different keyword or switch filters.</p>
        </div>
      ) : null}

      {/* Footer note */}
      <div className="mt-10 psi-panel p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 mt-0.5" />
          <div>
            <p className="m-0 text-[color:var(--foreground)]">
              Secure system design (recommended)
            </p>
            <p className="mt-2 text-sm">
              Payments should be processed via Stripe Checkout. Funding totals
              should be updated only from Stripe webhook events (server-verified),
              never from the client.
            </p>
            <p className="mt-2 text-sm">
              Next step: I can generate the exact <span className="psi-mono">/api/checkout/create</span>{" "}
              and <span className="psi-mono">/api/stripe/webhook</span> route handlers, plus a
              Supabase schema + RLS policy set that matches this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
