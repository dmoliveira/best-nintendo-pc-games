import type { MetadataRoute } from "next";

export const dynamic = "force-static";
import { createSiteConfig } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const site = createSiteConfig(process.env);
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: site.publicUrl("sitemap.xml"), host: site.siteUrl };
}
