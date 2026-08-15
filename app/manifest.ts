import type { MetadataRoute } from "next";
import { createSiteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const site = createSiteConfig(process.env);
  return {
    name: "GameAtlas — Nintendo & PC Games",
    short_name: "GameAtlas",
    description: "Find games worth your time.",
    start_url: site.basePath || "/",
    display: "standalone",
    background_color: "#050a12",
    theme_color: "#07111f",
    icons: [{ src: site.assetPath("mark.svg"), sizes: "any", type: "image/svg+xml" }],
  };
}
