import Link from "next/link";
import CatalogCards from "./catalog-cards";
import type { CatalogSearchRecord } from "@/lib/catalog/search";

interface TaxonomyHubProps {
  eyebrow: string;
  title: string;
  description: string;
  records: readonly CatalogSearchRecord[];
  backLabel: string;
}

export default function TaxonomyHub({ eyebrow, title, description, records, backLabel }: TaxonomyHubProps) {
  return <div className="site-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="topbar">
      <Link className="wordmark" href="/" aria-label="GameAtlas home"><span className="wordmark-mark" aria-hidden="true">✦</span>Game<span className="wordmark-accent">Atlas</span></Link>
      <nav className="topnav" aria-label="Primary navigation"><Link href="/#platforms">Platforms</Link><Link href="/#games">Games</Link><Link href="/docs/rights-and-support-policy/">Sources &amp; rights</Link></nav>
    </header>
    <main className="hub-page" id="main-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">GameAtlas</Link><span aria-hidden="true">/</span><span>{title}</span></nav>
      <section className="hub-hero" aria-labelledby="hub-title"><p className="eyebrow">{eyebrow}</p><h1 id="hub-title">{title}</h1><p className="hub-intro">{description}</p><div className="hub-meta"><span>{records.length} reviewed games</span><Link href="/#games">Back to the full catalog ↗</Link></div></section>
      <section className="hub-games" aria-labelledby="hub-games-heading"><div className="section-heading"><div><p className="eyebrow">{backLabel}</p><h2 id="hub-games-heading">Games in this collection.</h2></div><p className="section-aside">Every card links to a detail page and keeps editorial context separate from numeric provider signals.</p></div><CatalogCards records={records} /></section>
    </main>
    <footer className="footer"><div className="wordmark wordmark--footer"><span className="wordmark-mark" aria-hidden="true">✦</span>Game<span className="wordmark-accent">Atlas</span></div><p>Best Nintendo &amp; PC games, with context.</p><p className="footer-meta">Built for curious players · 2026</p></footer>
  </div>;
}
