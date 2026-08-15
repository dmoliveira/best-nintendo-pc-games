import type { SiteConfig } from "./site-config";

export interface BreadcrumbEntry {
  name: string;
  url: string;
}

export interface StructuredGameInput {
  title: string;
  description: string;
  url: string;
  releaseDate?: string;
  platformNames: readonly string[];
  genreNames: readonly string[];
}

export function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function createWebSiteStructuredData(site: SiteConfig): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.canonicalUrl}#website`,
    url: site.canonicalUrl,
    name: "GameAtlas",
    description: "A source-aware atlas of the best Nintendo and PC games.",
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: `${site.canonicalUrl}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function createCollectionPageStructuredData(input: {
  name: string;
  description: string;
  url: string;
  site: SiteConfig;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${input.url}#collection`,
    url: input.url,
    name: input.name,
    description: input.description,
    isPartOf: { "@id": `${input.site.canonicalUrl}#website` },
    inLanguage: "en",
  };
}

export function createVideoGameStructuredData(input: StructuredGameInput): Record<string, unknown> {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "@id": `${input.url}#videogame`,
    url: input.url,
    name: input.title,
    description: input.description,
    gamePlatform: [...input.platformNames],
    genre: [...input.genreNames],
    inLanguage: "en",
  };
  if (input.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(input.releaseDate)) data.datePublished = input.releaseDate;
  return data;
}

export function createBreadcrumbStructuredData(items: readonly BreadcrumbEntry[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
