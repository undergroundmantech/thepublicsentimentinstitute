// Server side loader for the Brazil runoff forecast file, and the Portuguese search metadata for every Brasil page.
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { SITE, abs, ORG_ID } from "@/app/lib/seo";
import type { BrData } from "./lib";
let cache: BrData | null = null;
export function getBr(): BrData {
  return (cache ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/brasil/br.json"), "utf8")) as BrData);
}
export const brStates = () => Object.values(getBr().states).filter((s) => s.uf !== "ZZ");

export const BR_KEYWORDS = [
  "segundo turno 2026", "eleição 2026", "eleições 2026", "pesquisa segundo turno", "Lula x Flávio Bolsonaro", "Flávio Bolsonaro x Lula",
  "previsão eleição 2026", "quem vai ganhar a eleição", "resultado eleição 2026", "apuração ao vivo", "resultado por estado", "resultado por município",
  "média das pesquisas", "chance de vitória", "On Point Politics",
];

export function brSeo(i: { title: string; description: string; path: string; keywords?: string[] }): Metadata {
  const t = `${i.title} | On Point Politics`;
  return {
    title: { absolute: t },
    description: i.description,
    keywords: [...(i.keywords ?? []), ...BR_KEYWORDS],
    alternates: { canonical: i.path, languages: { "pt-BR": i.path, "x-default": i.path } },
    openGraph: { title: t, description: i.description, url: i.path, siteName: SITE.name, locale: "pt_BR", type: "website",
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "On Point Politics: Brasil 2026" }] },
    twitter: { card: "summary_large_image", title: t, description: i.description },
  };
}

export function brPageLd(i: { name: string; description: string; path: string; crumbs: [string, string][]; faq?: [string, string][]; updated?: string }) {
  const g: Record<string, unknown>[] = [
    { "@type": "WebPage", "@id": abs(i.path) + "#page", url: abs(i.path), name: i.name, description: i.description, inLanguage: "pt-BR",
      isPartOf: { "@id": `${SITE.url}/#website` }, publisher: { "@id": ORG_ID }, dateModified: i.updated ?? getBr().updated,
      about: { "@type": "Event", name: "Eleição presidencial no Brasil, 2º turno", startDate: "2026-10-25T08:00:00-03:00", endDate: "2026-10-25T17:00:00-03:00",
        eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: { "@type": "Country", name: "Brasil" } } },
    { "@type": "BreadcrumbList", itemListElement: i.crumbs.map(([n, p], k) => ({ "@type": "ListItem", position: k + 1, name: n, item: abs(p) })) },
  ];
  if (i.faq?.length) g.push({ "@type": "FAQPage", inLanguage: "pt-BR", mainEntity: i.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
  return { "@context": "https://schema.org", "@graph": g };
}
