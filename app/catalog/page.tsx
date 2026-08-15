import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "../site-footer";
import SiteHeader from "../site-header";
import { getPlatformDisplayLabel } from "@/lib/catalog/display";
import { getCatalogGames } from "@/lib/catalog/site-data";
import { createSiteConfig } from "@/lib/site-config";

const site = createSiteConfig(process.env);

export const metadata: Metadata = {
  title: "Every game",
  description: "A lightweight alphabetical index of every GameAtlas catalog entry.",
  alternates: { canonical: site.publicUrl("catalog/") },
};

export default function CatalogIndexPage() {
  const games = getCatalogGames();
  return <div className="site-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <SiteHeader active="browse" />
    <main className="catalog-index-page" id="main-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">GameAtlas</Link><span aria-hidden="true">/</span><span>Every game</span></nav>
      <section className="catalog-index-hero" aria-labelledby="catalog-index-heading"><p className="eyebrow">No-JavaScript catalog</p><h1 id="catalog-index-heading">Browse every game.</h1><p>All {games.length} source-aware catalog entries, listed alphabetically with their documented platform paths.</p><Link className="text-link" href="/#games">Return to interactive filters <span aria-hidden="true">↗</span></Link></section>
      <ol className="catalog-index-list">{games.map(({ game, platforms }) => <li key={game.slug}><Link href={`/games/${game.slug}/`}>{game.title}</Link><span>{platforms.map(getPlatformDisplayLabel).join(" · ")}</span></li>)}</ol>
    </main>
    <SiteFooter />
  </div>;
}
