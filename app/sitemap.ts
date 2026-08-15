import type { MetadataRoute } from "next";
import { getCatalogGames, getGenreHubs, getPlatformHubs } from "@/lib/catalog/site-data";
import { createSiteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = createSiteConfig(process.env);
  const lastModified = new Date("2026-08-15T00:00:00Z");
  return [
    { url: site.canonicalUrl, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: site.publicUrl("catalog/"), lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: site.publicUrl("docs/rights-and-support-policy/"), lastModified, changeFrequency: "monthly", priority: 0.5 },
    ...getPlatformHubs().map((platform) => ({ url: site.publicUrl(`platforms/${platform.id}/`), lastModified, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...getGenreHubs().map((genre) => ({ url: site.publicUrl(`genres/${genre.id}/`), lastModified, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...getCatalogGames().map(({ game }) => ({ url: site.publicUrl(`games/${game.slug}/`), lastModified, changeFrequency: "monthly" as const, priority: 0.7 })),

  ];
}
