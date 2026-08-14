import type { MetadataRoute } from "next";

export const dynamic = "force-static";
import { createSiteConfig } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = createSiteConfig(process.env);
  return [
    { url: site.canonicalUrl, lastModified: new Date("2026-08-15T00:00:00Z"), changeFrequency: "weekly", priority: 1 },
    { url: site.publicUrl("docs/rights-and-support-policy/"), lastModified: new Date("2026-08-15T00:00:00Z"), changeFrequency: "monthly", priority: 0.5 },
  ];
}
