import Link from "next/link";
import GameAtlasMark from "./gameatlas-mark";
import { createSiteConfig } from "@/lib/site-config";

const site = createSiteConfig(process.env);

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <div className="wordmark wordmark--footer">
          <GameAtlasMark />
          <span>Game<span className="wordmark-accent">Atlas</span></span>
        </div>
        <p>Source-aware entries for curious players.</p>
      </div>
      <div className="footer-intro">
        <p className="footer-slogan">Less noise.<br /><em>More signal.</em></p>
        <p>Browse catalog context, platform paths, and documented sources.</p>
      </div>
      <nav className="footer-links" aria-label="Footer navigation">
        <div className="footer-link-group">
          <strong>Explore</strong>
          <Link href="/#games">Browse games</Link>
          <Link href="/#platforms">Platforms</Link>
          <Link href="/#method">How it works</Link>
        </div>
        <div className="footer-link-group">
          <strong>About</strong>
          <Link href="/docs/rights-and-support-policy/">Sources &amp; rights</Link>
          <a href={site.correctionUrl} target="_blank" rel="noreferrer">Report a correction ↗</a>
        </div>
      </nav>
      <p className="footer-meta">Built for curious players · 2026 <span aria-hidden="true">/</span> GameAtlas is an independent source-aware catalog.</p>
    </footer>
  );
}
