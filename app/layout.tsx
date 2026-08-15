import type { Metadata, Viewport } from "next";
import { createSiteConfig } from "@/lib/site-config";
import "./globals.css";

const site = createSiteConfig(process.env);

export const metadata: Metadata = {
  metadataBase: new URL(`${site.siteUrl}/`),
  title: { default: "GameAtlas", template: "%s | GameAtlas" },
  description: "A source-aware atlas of Nintendo and PC game catalog entries.",
  applicationName: "GameAtlas",
  category: "games",
  keywords: ["Nintendo games", "PC games", "Nintendo game guide", "video game catalog", "video game list"],
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { colorScheme: "dark", themeColor: "#07111f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
