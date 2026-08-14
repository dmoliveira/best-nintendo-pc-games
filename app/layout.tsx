import type { Metadata, Viewport } from "next";
import { createSiteConfig } from "@/lib/site-config";
import "./globals.css";

const site = createSiteConfig(process.env);

export const metadata: Metadata = {
  metadataBase: new URL(`${site.siteUrl}/`),
  title: { default: "GameAtlas", template: "%s | GameAtlas" },
  description: "A source-aware atlas of the best Nintendo and PC games.",
  applicationName: "GameAtlas",
  category: "games",
  keywords: ["best Nintendo games", "best PC games", "Nintendo game guide", "acclaimed games", "video game list"],
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { colorScheme: "dark", themeColor: "#07111f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
