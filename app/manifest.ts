import type { MetadataRoute } from "next";
import { createSiteConfig, type SiteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

export function createManifest(site: SiteConfig): MetadataRoute.Manifest {
  return {
    name: "GameAtlas — Nintendo & PC Games",
    short_name: "GameAtlas",
    description: "Browse a source-aware Nintendo and PC game catalog.",
    start_url: `${site.basePath}/`,
    display: "standalone",
    background_color: "#050a12",
    theme_color: "#07111f",
    icons: [{ src: site.assetPath("mark.svg"), sizes: "any", type: "image/svg+xml" }],
  };
}

export default function manifest(): MetadataRoute.Manifest {
  return createManifest(createSiteConfig(process.env));
}
