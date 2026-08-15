import Link from "next/link";
import AttributeGlyph from "./attribute-glyph";
import CatalogCards from "./catalog-cards";
import PlatformGlyph from "./platform-glyph";
import SiteFooter from "./site-footer";
import SiteHeader from "./site-header";
import { catalogFilterHref, type CatalogSearchRecord } from "@/lib/catalog/search";
import { createSiteConfig } from "@/lib/site-config";

type TaxonomyVisual =
  | { kind: "platform"; platformId: string }
  | { kind: "genre"; genreId: string };

interface TaxonomyHubProps {
  eyebrow: string;
  title: string;
  description: string;
  records: readonly CatalogSearchRecord[];
  backLabel: string;
  visual: TaxonomyVisual;
}

function TaxonomyGlyph({ visual }: { visual: TaxonomyVisual }) {
  return visual.kind === "platform"
    ? <PlatformGlyph platformId={visual.platformId} />
    : <AttributeGlyph kind="genre" />;
}

export default function TaxonomyHub({ eyebrow, title, description, records, backLabel, visual }: TaxonomyHubProps) {
  const site = createSiteConfig(process.env);
  const filterHref = visual.kind === "platform" ? catalogFilterHref("platform", visual.platformId) : catalogFilterHref("genre", visual.genreId);
  const catalogHref = `${site.basePath}${filterHref}`;
  return <div className="site-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <SiteHeader />
    <main className="hub-page" id="main-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">GameAtlas</Link><span aria-hidden="true">/</span><span>{title}</span></nav>
      <section className="hub-hero" aria-labelledby="hub-title"><p className="eyebrow hub-eyebrow"><span className="hub-visual" data-taxonomy-visual={visual.kind}><TaxonomyGlyph visual={visual} /></span>{eyebrow}</p><h1 id="hub-title">{title}</h1><p className="hub-intro">{description}</p><div className="hub-meta"><span>{records.length} catalog games</span><a href={catalogHref}>Show matching catalog games ↗</a></div></section>
      <section className="hub-games" aria-labelledby="hub-games-heading"><div className="section-heading"><div><p className="eyebrow">{backLabel}</p><h2 id="hub-games-heading">Games in this collection.</h2></div><p className="section-aside">Every card links to a detail page and keeps editorial context separate from numeric provider signals.</p></div><CatalogCards records={records} basePath={site.basePath} /></section>
    </main>
    <SiteFooter />
  </div>;
}
