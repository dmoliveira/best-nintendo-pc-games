import type { Metadata } from "next";
import Link from "next/link";
import { createSiteConfig } from "@/lib/site-config";

const site = createSiteConfig(process.env);

export const metadata: Metadata = {
  title: "Best Nintendo & PC Games",
  description: "Find the games worth your time across Nintendo consoles and PC, with platform context and transparent signals.",
  alternates: { canonical: site.canonicalUrl },
  openGraph: { type: "website", title: "Best Nintendo & PC Games | GameAtlas", description: "Find the games worth your time.", url: site.canonicalUrl, images: [{ url: site.publicUrl("og-image.png"), width: 1200, height: 630, alt: "GameAtlas — best Nintendo and PC games" }] },
  twitter: { card: "summary_large_image", title: "Best Nintendo & PC Games | GameAtlas", description: "Find the games worth your time.", images: [site.publicUrl("og-image.png")] },
  robots: { index: true, follow: true },
};

const platforms = [
  ["🟣", "Nintendo Switch", "Modern essentials", "violet"],
  ["🟥", "NES", "8-bit foundations", "coral"],
  ["🟦", "Super NES", "16-bit legends", "cyan"],
] as const;

const principles = [
  ["01", "Choose a platform", "Start with a console era or PC, then narrow the field."],
  ["02", "Read the signal", "Critic, community, sales, popularity, and editorial signals stay separate."],
  ["03", "Go deeper", "Open a concise game page with sources, links, and useful context."],
];

export default function Home() {
  return <main className="site-shell">
    <header className="topbar">
      <Link className="wordmark" href="/" aria-label="GameAtlas home"><span className="wordmark-mark" aria-hidden="true">✦</span>Game<span className="wordmark-accent">Atlas</span></Link>
      <nav className="topnav" aria-label="Primary navigation"><a href="#platforms">Platforms</a><a href="#method">How it works</a><Link href="/docs/rights-and-support-policy/">Sources &amp; rights</Link></nav>
    </header>

    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" /> Nintendo first · PC next</p>
        <h1 id="hero-title">Find the games<br /><em>worth your time.</em></h1>
        <p className="hero-lede">A beautifully organized atlas of acclaimed and popular games — being built for fast browsing by platform, genre, year, people, and evidence.</p>
        <div className="search-bar search-bar--preview" role="search" aria-label="Game search preview"><label className="sr-only" htmlFor="game-search">Search games, developers, genres, or platforms</label><span className="search-icon" aria-hidden="true">⌕</span><input id="game-search" type="search" placeholder="Search a game, developer, genre…" disabled /><button type="button" disabled>Search soon</button></div>
        <p className="search-note">Search index arrives with the catalog engine · preview only</p>
      </div>
      <div className="hero-art" aria-label="Abstract GameAtlas map illustration" role="img"><div className="orbit orbit--outer" aria-hidden="true" /><div className="orbit orbit--inner" aria-hidden="true" /><div className="hero-core"><span aria-hidden="true">🎮</span><strong>PLAY<br />SMART</strong></div><span className="map-label map-label--one">N-01</span><span className="map-label map-label--two">PC / 02</span><span className="map-label map-label--three">80+</span></div>
    </section>

    <section className="signal-strip" aria-label="GameAtlas principles"><div><b>80+</b><span>quality signals<br />when authorized</span></div><div><b>∞</b><span>eras to<br />explore</span></div><div><b>⌁</b><span>context over<br />hype</span></div></section>
    <section className="section-block" id="platforms" aria-labelledby="platform-heading"><div className="section-heading"><div><p className="eyebrow">Your starting point</p><h2 id="platform-heading">Choose an era.</h2></div><p className="section-aside">The first public alpha starts with three Nintendo landmarks. Every platform family will have an explicit coverage status as the atlas grows.</p></div><div className="platform-grid">{platforms.map(([emoji, name, detail, tone]) => <article className={`platform-card platform-card--${tone}`} key={name}><div className="card-topline">ALPHA SCOPE <span aria-hidden="true">↗</span></div><div className="platform-emoji" aria-hidden="true">{emoji}</div><h3>{name}</h3><p>{detail}</p><span className="card-link">Catalog arriving →</span></article>)}</div></section>
    <section className="section-block section-block--method" id="method" aria-labelledby="method-heading"><div className="section-heading"><div><p className="eyebrow">A better way to browse</p><h2 id="method-heading">Less noise.<br /><em>More signal.</em></h2></div><p className="section-aside">A great list should help you decide, not make you decode a mysterious score. GameAtlas keeps each signal labeled, sourced, and easy to inspect.</p></div><div className="promise-grid">{principles.map(([number, title, detail]) => <article className="promise-card" key={number}><span className="promise-number">{number}</span><h3>{title}</h3><p>{detail}</p></article>)}</div></section>
    <section className="closing-panel" aria-labelledby="closing-heading"><div><p className="eyebrow">The atlas is opening</p><h2 id="closing-heading">Good games are<br /><em>worth finding.</em></h2></div><div className="closing-copy"><p>GameAtlas is a free, source-aware guide for players who want the right game for the right machine — without the endless scroll.</p><Link className="text-link" href="/docs/rights-and-support-policy/">Read the source &amp; rights policy ↗</Link></div></section>
    <footer className="footer"><div className="wordmark wordmark--footer"><span className="wordmark-mark" aria-hidden="true">✦</span>Game<span className="wordmark-accent">Atlas</span></div><p>Best Nintendo &amp; PC games, with context.</p><p className="footer-meta">Built for curious players · 2026</p></footer>
    <noscript><p className="noscript-note">Interactive search arrives with the catalog engine; the platform guide and source policy remain available.</p></noscript>
  </main>;
}
