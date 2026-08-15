import type { Metadata } from "next";
import Link from "next/link";
import CatalogBrowser from "./catalog-browser";
import { createSiteConfig } from "@/lib/site-config";
import { getCatalogGames, getCatalogSearchRecords, getPopulatedPlatforms } from "@/lib/catalog/site-data";

const site = createSiteConfig(process.env);

export const metadata: Metadata = {
  title: "Best Nintendo & PC Games",
  description: "Find the games worth your time across Nintendo consoles and PC, with platform context and transparent signals.",
  alternates: { canonical: site.canonicalUrl },
  openGraph: { type: "website", title: "Best Nintendo & PC Games | GameAtlas", description: "Find the games worth your time.", url: site.canonicalUrl, images: [{ url: site.publicUrl("og-image.png"), width: 1200, height: 630, alt: "GameAtlas — best Nintendo and PC games" }] },
  twitter: { card: "summary_large_image", title: "Best Nintendo & PC Games | GameAtlas", description: "Find the games worth your time.", images: [site.publicUrl("og-image.png")] },
  robots: { index: true, follow: true },
};

const platformTones = ["violet", "coral", "cyan", "lime", "orange", "blue", "violet", "coral"] as const;

export default function Home() {
  const games = getCatalogGames();
  const populatedPlatforms = getPopulatedPlatforms();

  return <div className="site-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="topbar">
      <Link className="wordmark" href="/" aria-label="GameAtlas home"><span className="wordmark-mark" aria-hidden="true">✦</span>Game<span className="wordmark-accent">Atlas</span></Link>
      <nav className="topnav" aria-label="Primary navigation"><a href="#platforms">Platforms</a><a href="#games">Games</a><a href="#method">How it works</a><Link href="/docs/rights-and-support-policy/">Sources &amp; rights</Link></nav>
    </header>

    <main id="main-content">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" /> Nintendo first · PC next</p>
          <h1 id="hero-title">Find the games<br /><em>worth your time.</em></h1>
          <p className="hero-lede">A beautifully organized atlas of acclaimed and popular games — built for fast browsing by platform, genre, year, people, and evidence.</p>
          <div className="availability-panel" aria-label="Catalog availability">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <div className="availability-copy"><strong>Reviewed catalog is live</strong><span>{games.length} records are available now; search and filters are available below.</span></div>
            <span className="availability-status">Live</span>
          </div>
          <p className="search-note">Every current record has an original description, platform context, and source-aware editorial rationale.</p>
        </div>
        <div className="hero-art" aria-label="Abstract GameAtlas map illustration" role="img"><div className="orbit orbit--outer" aria-hidden="true" /><div className="orbit orbit--inner" aria-hidden="true" /><div className="hero-core"><span aria-hidden="true">🎮</span><strong>PLAY<br />SMART</strong></div><span className="map-label map-label--one">N-01</span><span className="map-label map-label--two">PC / 02</span><span className="map-label map-label--three">LIVE</span></div>
      </section>

      <section className="signal-strip" aria-label="Catalog facts"><div><b>{games.length}</b><span>reviewed games<br />in this slice</span></div><div><b>{populatedPlatforms.length}</b><span>platform families<br />with records</span></div><div><b>⌁</b><span>context over<br />hype</span></div></section>

      <section className="section-block" id="platforms" aria-labelledby="platform-heading"><div className="section-heading"><div><p className="eyebrow">Your starting point</p><h2 id="platform-heading">Choose an era.</h2></div><p className="section-aside">The taxonomy maps every supported Nintendo family. Populated platforms have reviewed records; planned families stay visible without pretending to be complete.</p></div><div className="platform-grid">{populatedPlatforms.map((platform, index) => <article className={`platform-card platform-card--${platformTones[index % platformTones.length]}`} key={platform.id}><div className="card-topline">RECORDS LIVE</div><div className="platform-emoji" aria-hidden="true">{platform.emoji}</div><h3>{platform.name}</h3><p>{platform.description}</p><span className="card-status">Browse the games below</span></article>)}</div></section>

      <section className="section-block section-block--catalog" id="games" aria-labelledby="games-heading"><div className="section-heading"><div><p className="eyebrow">The reviewed catalog</p><h2 id="games-heading">Start with a game.</h2></div><p className="section-aside">Search across titles, people, platforms, genres, and years. These are original GameAtlas selections, not blended ratings.</p></div><CatalogBrowser records={getCatalogSearchRecords()} /></section>

      <section className="section-block section-block--method" id="method" aria-labelledby="method-heading"><div className="section-heading"><div><p className="eyebrow">A better way to browse</p><h2 id="method-heading">Less noise.<br /><em>More signal.</em></h2></div><p className="section-aside">A great list should help you decide, not make you decode a mysterious score. GameAtlas keeps each signal labeled, sourced, and easy to inspect.</p></div><div className="promise-grid"><article className="promise-card"><span className="promise-number">01</span><h3>Choose a platform</h3><p>Start with a console era or PC, then narrow the field with the live catalog controls.</p></article><article className="promise-card"><span className="promise-number">02</span><h3>Read the signal</h3><p>Critic, community, sales, popularity, and editorial signals stay separate.</p></article><article className="promise-card"><span className="promise-number">03</span><h3>Go deeper</h3><p>Open a concise game page with sources, links, and useful context.</p></article></div></section>

      <section className="closing-panel" aria-labelledby="closing-heading"><div><p className="eyebrow">The atlas is opening</p><h2 id="closing-heading">Good games are<br /><em>worth finding.</em></h2></div><div className="closing-copy"><p>GameAtlas is a free, source-aware guide for players who want the right game for the right machine — without the endless scroll.</p><Link className="text-link" href="/docs/rights-and-support-policy/">Read the source &amp; rights policy ↗</Link></div></section>
    </main>

    <footer className="footer"><div className="wordmark wordmark--footer"><span className="wordmark-mark" aria-hidden="true">✦</span>Game<span className="wordmark-accent">Atlas</span></div><p>Best Nintendo &amp; PC games, with context.</p><p className="footer-meta">Built for curious players · 2026</p></footer>
    <noscript><p className="noscript-note">All reviewed game cards remain available without JavaScript; interactive search and filters require JavaScript.</p></noscript>
  </div>;
}
