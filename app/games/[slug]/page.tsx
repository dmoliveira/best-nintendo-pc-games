/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSiteConfig } from "@/lib/site-config";
import { getCatalogGame, getCatalogGames, getEditorialSignals, getGenreHub, getPlatformHub } from "@/lib/catalog/site-data";

const site = createSiteConfig(process.env);
type GamePageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getCatalogGames().map(({ game }) => ({ slug: game.slug }));
}

export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getCatalogGame(slug);
  if (!entry) return {};
  const { game } = entry;
  const url = site.publicUrl(`games/${game.slug}/`);
  return {
    title: game.title,
    description: game.shortDescription,
    alternates: { canonical: url },
    openGraph: { type: "article", title: game.title, description: game.shortDescription, url, images: [{ url: site.publicUrl("og-image.png"), width: 1200, height: 630, alt: `GameAtlas — ${game.title}` }] },
  };
}

export default async function GamePage({ params }: GamePageProps) {
  const { slug } = await params;
  const entry = getCatalogGame(slug);
  if (!entry) notFound();
  const { game, platforms, genres } = entry;
  const editorialSignals = getEditorialSignals(game);

  return <div className="site-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="topbar">
      <Link className="wordmark" href="/" aria-label="GameAtlas home"><span className="wordmark-mark" aria-hidden="true">✦</span>Game<span className="wordmark-accent">Atlas</span></Link>
      <nav className="topnav" aria-label="Primary navigation"><Link href="/#platforms">Platforms</Link><Link href="/#games">Games</Link><Link href="/docs/rights-and-support-policy/">Sources &amp; rights</Link></nav>
    </header>

    <main className="game-page" id="main-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">GameAtlas</Link><span aria-hidden="true">/</span><span>{game.title}</span></nav>
      <section className="game-hero" aria-labelledby="game-title"><div className="game-hero-art" aria-hidden="true">{game.assets[0] ? <img src={site.publicUrl(game.assets[0].path.replace(/^public\//, ""))} alt="" /> : game.emoji}</div><div><p className="eyebrow">{platforms.map((platform, index) => <span key={platform.id}>{getPlatformHub(platform.id) ? <Link href={`/platforms/${platform.id}/`}>{platform.name}</Link> : platform.name}{index < platforms.length - 1 ? " · " : null}</span>)}</p><h1 id="game-title">{game.title}</h1><p className="game-intro">{game.shortDescription}</p><div className="game-meta"><span>{game.release.year}</span>{genres.map((genre) => getGenreHub(genre.id) ? <Link href={`/genres/${genre.id}/`} key={genre.id}>{genre.name}</Link> : <span key={genre.id}>{genre.name}</span>)}</div></div></section>

      <div className="game-content-grid"><section className="game-main-column" aria-labelledby="highlights-heading"><div className="detail-section"><p className="eyebrow">Why it is here</p><h2 id="highlights-heading">A useful place to start.</h2><ul className="highlight-list">{game.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul></div><div className="detail-section" aria-labelledby="evidence-heading"><p className="eyebrow">Evidence</p><h2 id="evidence-heading">Read the context.</h2>{editorialSignals.map((signal) => <article className="evidence-card" key={`${signal.provider}-${signal.label}`}><span className="evidence-pill">Original editorial</span><h3>{signal.label}</h3><p>{signal.rationale}</p><small>Reviewed by {signal.reviewedBy ?? "GameAtlas editorial review"} · Captured {signal.capturedAt}</small></article>)}</div></section><aside className="game-sidebar" aria-labelledby="resources-heading"><div className="sidebar-card"><p className="eyebrow">At a glance</p><h2>Game details</h2><dl className="detail-list"><div><dt>Platform</dt><dd>{platforms.map((platform) => platform.name).join(", ")}</dd></div><div><dt>Release year</dt><dd>{game.release.year}</dd></div>{game.releaseFormat ? <div><dt>Distribution</dt><dd>{game.releaseFormat === "digital" && platforms.some((platform) => platform.id === "nintendo-dsi") ? "DSiWare · Digital" : game.releaseFormat}</dd></div> : null}{game.developer ? <div><dt>Developer</dt><dd>{game.developer}</dd></div> : null}{game.publisher ? <div><dt>Publisher</dt><dd>{game.publisher}</dd></div> : null}</dl></div><div className="sidebar-card"><p className="eyebrow">Go deeper</p><h2 id="resources-heading">Official &amp; external resources</h2><ul className="resource-list">{game.links.map((link) => <li key={`${link.kind}-${link.url}`}><a href={link.url} target="_blank" rel="noreferrer">{link.label}<span aria-hidden="true">↗</span></a></li>)}</ul></div></aside></div>
    </main>

    <footer className="footer"><div className="wordmark wordmark--footer"><span className="wordmark-mark" aria-hidden="true">✦</span>Game<span className="wordmark-accent">Atlas</span></div><p>Best Nintendo &amp; PC games, with context.</p><p className="footer-meta">Built for curious players · 2026</p></footer>
  </div>;
}
