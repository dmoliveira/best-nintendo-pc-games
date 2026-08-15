import type { Metadata } from "next";
import Link from "next/link";
import CatalogBrowser from "./catalog-browser";
import HeroSearch from "./hero-search";
import JsonLd from "./json-ld";
import PlatformGlyph from "./platform-glyph";
import SiteFooter from "./site-footer";
import SiteHeader from "./site-header";
import { createSiteConfig } from "@/lib/site-config";
import { catalogFilterHref, DEFAULT_PAGE_SIZE, toCatalogCardRecord } from "@/lib/catalog/search";
import { createWebSiteStructuredData } from "@/lib/structured-data";
import { getCatalogSearchIndexDigest } from "@/lib/catalog/search-index";
import { getCatalogGames, getCatalogSearchRecords, getPlatformHubs, getPopulatedPlatforms } from "@/lib/catalog/site-data";

const site = createSiteConfig(process.env);

export const metadata: Metadata = {
  title: "Nintendo & PC Games",
  description: "Find the games worth your time across Nintendo consoles and PC, with platform context and transparent signals.",
  alternates: { canonical: site.canonicalUrl },
  openGraph: { type: "website", title: "Nintendo & PC Games | GameAtlas", description: "Find the games worth your time.", url: site.canonicalUrl, images: [{ url: site.publicUrl("og-image.png"), width: 1200, height: 630, alt: "GameAtlas — source-aware Nintendo and PC game catalog" }] },
  twitter: { card: "summary_large_image", title: "Nintendo & PC Games | GameAtlas", description: "Find the games worth your time.", images: [site.publicUrl("og-image.png")] },
  robots: { index: true, follow: true },
};

const platformTones = ["violet", "coral", "cyan", "lime", "orange", "blue"] as const;

export default function Home() {
  const games = getCatalogGames();
  const populatedPlatforms = getPopulatedPlatforms();
  const platformHubIds = new Set(getPlatformHubs().map((platform) => platform.id));
  const platformCounts = new Map(populatedPlatforms.map((platform) => [platform.id, games.filter(({ game }) => game.platforms.includes(platform.id)).length]));
  const catalogSearchRecords = getCatalogSearchRecords();
  const catalogIndexDigest = getCatalogSearchIndexDigest(catalogSearchRecords);
  const initialCatalogRecords = catalogSearchRecords.slice(0, DEFAULT_PAGE_SIZE);
  const initialSourceListed = initialCatalogRecords.length > 0 && initialCatalogRecords.every((record) => record.platformAssociationScope === "source-listed");
  const initialSearchRecords = initialCatalogRecords.map((record) => toCatalogCardRecord(record, !initialSourceListed));
  const catalogIndexUrl = `${site.publicUrl("catalog-search-index.json")}?v=${encodeURIComponent(catalogIndexDigest)}`;

  return <div className="site-shell">
    <JsonLd data={createWebSiteStructuredData(site)} />
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <SiteHeader active="browse" />

    <main id="main-content">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" /> Source-aware game discovery <span className="eyebrow-divider" aria-hidden="true">/</span> 2026 edition</p>
          <h1 id="hero-title">Find a game.<br /><em>Explore the atlas.</em></h1>
          <p className="hero-lede">A broad, source-aware catalog for curious players. Browse games by platform, genre, era, and the context kept with each entry.</p>
          <HeroSearch />
          <p className="search-note"><span className="status-dot" aria-hidden="true" /> {games.length} catalog entries · no blended scores, no endless scroll</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-grid" />
          <div className="orbit orbit--outer" />
          <div className="orbit orbit--middle" />
          <div className="orbit orbit--inner" />
          <div className="hero-core"><span className="hero-core-symbol">✦</span><strong>PLAY<br />WITH<br />PURPOSE</strong></div>
          <span className="map-label map-label--one">N / 01</span>
          <span className="map-label map-label--two">PC / 02</span>
          <span className="map-label map-label--three">SOURCED</span>
          <span className="map-label map-label--four">◎</span>
        </div>
      </section>

      <section className="signal-strip" aria-label="Why browse GameAtlas">
        <div className="signal-item"><span className="signal-icon" aria-hidden="true">✦</span><span><strong>Method stays visible</strong><small>Catalog methods and original editorial context with documented source paths.</small></span></div>
        <div className="signal-item"><span className="signal-icon" aria-hidden="true">◌</span><span><strong>Context over hype</strong><small>{games.length} entries with visible source context.</small></span></div>
        <div className="signal-item"><span className="signal-icon" aria-hidden="true">↗</span><span><strong>Sources stay visible</strong><small>Every signal is labeled and easy to inspect.</small></span></div>
      </section>

      <section className="section-block section-block--platforms" id="platforms" aria-labelledby="platform-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Browse the atlas</p><h2 id="platform-heading">Choose a <em>starting point.</em></h2></div>
          <p className="section-aside"><strong>{populatedPlatforms.length} platform families</strong> with catalog entries. Select any tile to filter the catalog, or open a guide when a collection has enough depth.</p>
        </div>
        <div className="platform-grid">
          {populatedPlatforms.map((platform, index) => <article className={`platform-card platform-card--${platformTones[index % platformTones.length]}`} key={platform.id}>
            <a className="platform-card-main" href={`${site.basePath}${catalogFilterHref("platform", platform.id)}`} aria-label={`Filter games by ${platform.name}`}>
              <span className="card-topline">{platform.family === "pc" ? "PC" : "NINTENDO"}<span aria-hidden="true">↗</span></span>
              <span className="platform-card-icon" aria-hidden="true"><PlatformGlyph platformId={platform.id} /></span>
              <span className="platform-card-copy"><strong>{platform.name}</strong><small>{platformCounts.get(platform.id) ?? 0} catalog {platformCounts.get(platform.id) === 1 ? "entry" : "entries"}</small></span>
            </a>
            {platformHubIds.has(platform.id) ? <div className="platform-card-footer"><Link className="platform-guide" href={`/platforms/${platform.id}/`}>Open guide <span aria-hidden="true">↗</span></Link></div> : null}
          </article>)}
        </div>
      </section>

      <section className="section-block section-block--catalog" id="games" aria-labelledby="games-heading">
        <div className="section-heading section-heading--catalog">
          <div><p className="eyebrow">The source-aware catalog</p><h2 id="games-heading">Start with a game.</h2></div>
          <p className="section-aside">Search by title, person, platform, genre, year, or creator. Sort the results without turning editorial context into a blended rating.</p>
        </div>
        <noscript><style>{".browser-panel, .result-tools .page-size-field, .hero-search { display: none; }"}</style><p className="noscript-note">Interactive filters and pagination require JavaScript. The first catalog entries remain available below; <Link href="/catalog/">browse every game in the no-JavaScript index</Link>.</p></noscript>
        <CatalogBrowser initialRecords={initialSearchRecords} initialSourceListed={initialSourceListed} catalogEntryCount={games.length} catalogIndexDigest={catalogIndexDigest} catalogIndexUrl={catalogIndexUrl} catalogIndexHref={site.publicUrl("catalog/")} basePath={site.basePath} />
      </section>

      <section className="section-block section-block--method" id="method" aria-labelledby="method-heading">
        <div className="section-heading">
          <div><p className="eyebrow">A better way to browse</p><h2 id="method-heading">Less noise.<br /><em>More signal.</em></h2></div>
          <p className="section-aside">A good list should help you decide, not make you decode a mysterious score. GameAtlas keeps each signal labeled, sourced, and easy to inspect.</p>
        </div>
        <div className="promise-grid">
          <article className="promise-card"><span className="promise-number">01</span><h3>Choose a platform</h3><p>Start with a console era or PC, then narrow the field with the live catalog controls.</p></article>
          <article className="promise-card"><span className="promise-number">02</span><h3>Read the signal</h3><p>Critic, community, sales, popularity, and editorial signals stay separate.</p></article>
          <article className="promise-card"><span className="promise-number">03</span><h3>Go deeper</h3><p>Open a concise game page with sources, links, and useful context.</p></article>
        </div>
      </section>

      <section className="closing-panel" aria-labelledby="closing-heading">
        <div><p className="eyebrow">The atlas is opening</p><h2 id="closing-heading">Good games are<br /><em>worth finding.</em></h2></div>
        <div className="closing-copy"><p>GameAtlas is a free, source-aware guide for players who want the right game for the right machine — without the endless scroll.</p><Link className="text-link" href="/docs/rights-and-support-policy/">Read the source &amp; rights policy <span aria-hidden="true">↗</span></Link></div>
      </section>
    </main>

    <SiteFooter />
  </div>;
}
