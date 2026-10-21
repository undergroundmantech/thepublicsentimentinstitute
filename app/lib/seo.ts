// Search and share metadata for every page: one place for the site's name, URL and the
// structured data that Google, Bing and AI answer engines read.
import type { Metadata } from "next";

export const SITE = {
  url: "https://onpointpolitics.us",
  name: "On Point Politics",
  short: "On Point",
  publisher: "On Point Polling",
  publisherShort: "On Point Polling",
  description:
    "Polling averages, county level forecasts and live election results for the 2026 midterms: the Senate, the House, every governor, every state legislative chamber and every statewide ballot measure.",
  logo: "/icon.png",
  election: "2026-11-03",
} as const;

export const abs = (path: string) => (path.startsWith("http") ? path : `${SITE.url}${path.startsWith("/") ? "" : "/"}${path}`);

export const KEYWORDS = [
  "2026 midterm forecast", "2026 election forecast", "2026 Senate forecast", "2026 House forecast", "2026 governor forecast",
  "state legislature forecast", "ballot measure forecast", "polling average", "generic ballot", "Trump approval rating",
  "election results", "election model", "On Point Politics", "On Point Polling",
];

type SeoInput = {
  title: string;
  description: string;
  path: string;
  /** Keep the title as given, without the site name template. */
  absoluteTitle?: boolean;
  type?: "website" | "article";
  modified?: string;
  published?: string;
  keywords?: string[];
  noindex?: boolean;
  /** The route has its own opengraph-image, so the site card stays off. */
  ownImage?: boolean;
};

/** Title, description, canonical URL and matching Open Graph and X card fields. */
export function seo(i: SeoInput): Metadata {
  const shareTitle = i.absoluteTitle ? i.title : `${i.title} | ${SITE.name}`;
  const og: NonNullable<Metadata["openGraph"]> = {
    title: shareTitle, description: i.description, url: i.path, siteName: SITE.name, locale: "en_US",
    // the site card; a page with its own opengraph-image file replaces it
    ...(i.ownImage ? {} : { images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: SITE.name }] }),
    ...(i.type === "article"
      ? { type: "article", modifiedTime: i.modified, publishedTime: i.published, authors: [SITE.name], section: "Elections" }
      : { type: "website" }),
  };
  return {
    title: i.absoluteTitle ? { absolute: i.title } : i.title,
    description: i.description,
    keywords: i.keywords,
    alternates: { canonical: i.path },
    openGraph: og,
    twitter: { card: "summary_large_image", title: shareTitle, description: i.description },
    ...(i.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Day stamp for "updated" fields, written as an ISO date with the Eastern offset. */
export const isoDay = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T08:00:00-04:00` : d);

// ---------- structured data ----------

type LD = Record<string, unknown>;

export const ORG_ID = `${SITE.url}/#organization`;
export const PUB_ID = `${SITE.url}/#on-point-polling`;
export const SITE_ID = `${SITE.url}/#website`;

export function orgLd(): LD[] {
  return [
    {
      "@type": "NewsMediaOrganization",
      "@id": ORG_ID,
      name: SITE.name,
      alternateName: ["On Point", "OnPoint Politics", "onpointpolitics.us", "onpointpolitics.com"],
      url: SITE.url,
      logo: { "@type": "ImageObject", url: abs(SITE.logo), width: 900, height: 900 },
      description: SITE.description,
      parentOrganization: { "@id": PUB_ID },
      publishingPrinciples: abs("/forecast/methodology"),
      actionableFeedbackPolicy: abs("/contact"),
      knowsAbout: ["Elections", "Public opinion polling", "Election forecasting", "United States Congress", "State legislatures", "Ballot measures"],
    },
    {
      "@type": "ResearchOrganization",
      "@id": PUB_ID,
      name: SITE.publisher,
      url: abs("/on-point-polling"),
      description: "On Point Polling is the polling and research arm behind On Point Politics: survey fieldwork, the DSMeridian likely voter model and dual panel surveys.",
    },
    {
      "@type": "WebSite",
      "@id": SITE_ID,
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      inLanguage: "en-US",
      publisher: { "@id": ORG_ID },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

/** Breadcrumb trail from [name, path] pairs, home first. */
export function crumbsLd(items: [string, string][]): LD {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
  };
}

type DatasetInput = {
  name: string;
  description: string;
  path: string;
  modified: string;
  keywords?: string[];
  measured?: string[];
  place?: string;
  file?: string;
};

/** A forecast or polling average as a Dataset, so dataset search and AI engines can cite it. */
export function datasetLd(d: DatasetInput): LD {
  return {
    "@type": "Dataset",
    "@id": `${abs(d.path)}#dataset`,
    name: d.name,
    description: d.description.length >= 50 ? d.description : `${d.description} Built and updated daily by ${SITE.name}.`,
    url: abs(d.path),
    creator: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    dateModified: isoDay(d.modified),
    isAccessibleForFree: true,
    inLanguage: "en-US",
    license: abs("/terms"),
    temporalCoverage: `2025-01-01/${SITE.election}`,
    spatialCoverage: { "@type": "Place", name: d.place ? `${d.place}, United States` : "United States" },
    keywords: d.keywords,
    variableMeasured: d.measured,
    measurementTechnique: "Polling average and Monte Carlo election simulation",
    ...(d.file ? { distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: abs(d.file) }] } : {}),
  };
}

/** The page itself, tied to the site and to the dataset or article it carries. */
export function pageLd(p: { name: string; description: string; path: string; modified?: string; about?: string; type?: string }): LD {
  return {
    "@type": p.type ?? "WebPage",
    "@id": `${abs(p.path)}#page`,
    url: abs(p.path),
    name: p.name,
    description: p.description,
    isPartOf: { "@id": SITE_ID },
    publisher: { "@id": ORG_ID },
    inLanguage: "en-US",
    ...(p.modified ? { dateModified: isoDay(p.modified) } : {}),
    ...(p.about ? { mainEntity: { "@id": `${abs(p.path)}#dataset` } } : {}),
  };
}

export const graph = (...nodes: (LD | LD[])[]) => ({ "@context": "https://schema.org", "@graph": nodes.flat() });
