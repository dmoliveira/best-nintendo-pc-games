import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "../../site-footer";
import SiteHeader from "../../site-header";
import { createSiteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

const site = createSiteConfig(process.env);

export const metadata: Metadata = {
  title: "Sources & Rights Policy",
  description: "How GameAtlas handles game sources, ratings, artwork, and future support links.",
  alternates: { canonical: site.publicUrl("docs/rights-and-support-policy/") },
  openGraph: { type: "article", title: "Sources & Rights Policy | GameAtlas", description: "How GameAtlas handles sources, ratings, artwork, and support links.", url: site.publicUrl("docs/rights-and-support-policy/"), images: [{ url: site.publicUrl("og-image.png"), width: 1200, height: 630, alt: "GameAtlas source and rights policy" }] },
  twitter: { card: "summary_large_image", title: "Sources & Rights Policy | GameAtlas", description: "How GameAtlas handles sources, ratings, artwork, and support links.", images: [site.publicUrl("og-image.png")] },
  robots: { index: true, follow: true },
};

export default function RightsAndSupportPolicyPage() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <SiteHeader />
      <main className="policy-page" id="main-content">
        <Link className="policy-back" href="/">← Back to GameAtlas</Link>
        <p className="eyebrow">Publishing standards · reviewed 2026-08-15</p>
        <h1>Sources, rights &amp; support</h1>
        <p className="policy-intro">GameAtlas is a static reference catalog. It links to external sources, but it does not scrape review sites, copy reviews or comments, or assume that an API image URL grants permission to redistribute artwork.</p>

        <section className="policy-card" aria-labelledby="score-policy-heading">
          <h2 id="score-policy-heading">Numeric signals need two approvals</h2>
          <p>A score must be factually checked and separately approved for redistribution before it appears in the local index or HTML. The record must retain its provider, type, scale, edition/platform, date, source, terms reference, reviewer, and recheck date.</p>
          <ul><li>Metacritic and OpenCritic are outbound references until an authorized data path exists.</li><li>Sales facts stay separate from critic and user ratings.</li><li>There is no unlabeled blended “overall” score.</li></ul>
        </section>

        <section className="policy-card" aria-labelledby="asset-policy-heading">
          <h2 id="asset-policy-heading">Local artwork is manifested</h2>
          <p>Every local asset needs a source or creator, license/permission, intended use, attribution, alt text, reviewer, and recheck metadata. The launch path favors original abstract editorial art, compatible-license assets, and deterministic emoji/CSS fallbacks.</p>
          <p>Third-party covers, screenshots, logos, characters, and box recreations are outbound-only by default.</p>
        </section>

        <section className="policy-card" aria-labelledby="support-policy-heading">
          <h2 id="support-policy-heading">Support comes after disclosure</h2>
          <p>A future support destination has been supplied for the later launch task. It is intentionally not published here while voluntary-support wording, contact/correction details, and applicable payment disclosures are being finalized.</p>
        </section>

        <section className="policy-card" aria-labelledby="correction-policy-heading">
          <h2 id="correction-policy-heading">Report a catalog correction</h2>
          <p>Found a wrong platform, genre, release year, source, or asset status? Include the game or platform slug, the field in question, a proposed correction, and a public source URL. Do not attach copied review text or unlicensed artwork.</p>
          <a className="text-link" href={site.correctionUrl} target="_blank" rel="noreferrer">Open the catalog correction form <span aria-hidden="true">↗</span></a>
        </section>

        <section className="policy-card" aria-labelledby="source-links-heading">
          <h2 id="source-links-heading">Reference links</h2>
          <ul className="policy-links"><li><a href="https://www.fandom.com/terms-of-service-pp1" rel="noreferrer">Metacritic/Fandom terms ↗</a></li><li><a href="https://help.opencritic.com/knowledge-base/articles/6333223-are-there-any-opencritic-api-s" rel="noreferrer">OpenCritic API FAQ ↗</a></li><li><a href="https://api-docs.igdb.com/" rel="noreferrer">IGDB API docs ↗</a></li><li><a href="https://rawg.io/terms" rel="noreferrer">RAWG terms ↗</a></li><li><a href="https://www.nintendo.co.jp/ir/en/finance/hard_soft/" rel="noreferrer">Nintendo IR sales ↗</a></li></ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
