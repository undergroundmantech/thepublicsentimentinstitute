// Server side loader for the Brazil runoff forecast file, and the search metadata for every Brazil page: English titles
// and descriptions, with the Portuguese terms Brazilian readers search for kept in the keywords and the Portuguese title.
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
  "Brazil election 2026", "Brazil runoff", "Brazil presidential election", "Lula vs Flavio Bolsonaro", "Brazil election forecast", "Brazil election results",
  "segundo turno 2026", "eleição 2026", "eleições 2026", "pesquisa segundo turno", "Lula x Flávio Bolsonaro", "Flávio Bolsonaro x Lula",
  "previsão eleição 2026", "quem ganhou a eleição", "resultado eleição 2026", "resultado segundo turno 2026", "resultado por estado", "resultado por município",
  "média das pesquisas", "chance de vitória", "On Point Politics",
];
/** the day these pages became an archive and the provider's count was saved (see scripts/brasil/archive-results.ts) */
export const BR_ARCHIVED = "2026-10-31";

export function brSeo(i: { title: string; description: string; path: string; keywords?: string[]; pt?: string }): Metadata {
  const t = `${i.title}${i.pt ? ` · ${i.pt}` : ""} | On Point Politics`;
  return {
    title: { absolute: t },
    description: i.description,
    keywords: [...(i.keywords ?? []), ...BR_KEYWORDS],
    alternates: { canonical: i.path },
    openGraph: { title: t, description: i.description, url: i.path, siteName: SITE.name, locale: "en_US", alternateLocale: ["pt_BR"], type: "website",
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "On Point Politics: Brazil 2026" }] },
    twitter: { card: "summary_large_image", title: t, description: i.description },
  };
}

export function brPageLd(i: { name: string; description: string; path: string; crumbs: [string, string][]; faq?: [string, string][] }) {
  // an archive: the runoff took place on October 25, 2026; the forecast is dated by its own publication date
  const g: Record<string, unknown>[] = [
    { "@type": "WebPage", "@id": abs(i.path) + "#page", url: abs(i.path), name: i.name, description: i.description, inLanguage: ["en", "pt-BR"],
      isPartOf: { "@id": `${SITE.url}/#website` }, publisher: { "@id": ORG_ID }, datePublished: getBr().updated, dateModified: BR_ARCHIVED,
      about: { "@type": "Event", name: "Brazil presidential election runoff", alternateName: "Eleição presidencial no Brasil, 2º turno", startDate: "2026-10-25T08:00:00-03:00", endDate: "2026-10-25T17:00:00-03:00",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: { "@type": "Country", name: "Brazil" } } },
    { "@type": "BreadcrumbList", itemListElement: i.crumbs.map(([n, p], k) => ({ "@type": "ListItem", position: k + 1, name: n, item: abs(p) })) },
  ];
  if (i.faq?.length) g.push({ "@type": "FAQPage", inLanguage: "en", mainEntity: i.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
  return { "@context": "https://schema.org", "@graph": g };
}
