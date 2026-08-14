import type { NextConfig } from "next";
import { createSiteConfig } from "./lib/site-config";

const site = createSiteConfig(process.env);

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: site.basePath,
};

export default nextConfig;
