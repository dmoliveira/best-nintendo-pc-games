import { getPlatformDisplayLabel } from "@/lib/catalog/display";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AttributeGlyph from "@/app/attribute-glyph";
import GameBoxViewer from "@/app/game-box-viewer";
import JsonLd from "@/app/json-ld";
import PlatformGlyph from "@/app/platform-glyph";
import SiteFooter from "../../site-footer";
import SiteHeader from "../../site-header";
import { createPackagePresentation } from "@/lib/box-art/package-engine";
import { createSiteConfig } from "@/lib/site-config";
import { createBreadcrumbStructuredData, createVideoGameStructuredData } from "@/lib/structured-data";
import { getCatalogGame, getCatalogGames, getEditorialSignals, getGameBoxFront, getGameEditorialArt, getGenreHub, getPlatformHub, getPublicGameSignals, resolveCatalogRecordSemantics } from "@/lib/catalog/site-data";

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
  const criticalLink = game.links.find((link) => link.kind === "critical");
  const publicSignals = getPublicGameSignals(game);
  const boxAsset = getGameBoxFront(game);
  const editorialTileAsset = getGameEditorialArt(game);
  const gameUrl = site.publicUrl(`games/${game.slug}/`);
  const platformLabel = platforms.map((platform) => getPlatformDisplayLabel(platform)).join(" · ");
  const semantics = resolveCatalogRecordSemantics(game);
  const isSourceListed = semantics.platformAssociationScope === "source-listed";
  const isEarliestTitleRelease = semantics.releaseScope === "earliest-title-release";
  const packagePresentation = createPackagePresentation({
    title: game.title,
    platformIds: game.platforms,
    platformLabel: isSourceListed ? `Wikidata-listed: ${platformLabel}` : platformLabel,
    platformAssociationScope: semantics.platformAssociationScope,
    releaseFormat: game.releaseFormat,
    editorialThumbnail: editorialTileAsset ? {
      src: site.assetPath(editorialTileAsset.path.replace(/^public\//, "")),
      alt: editorialTileAsset.alt ?? `Abstract GameAtlas editorial reference art for ${game.title}`,
    } : undefined,
    governedFront: boxAsset?.boxFormatId ? {
      src: site.assetPath(boxAsset.path.replace(/^public\//, "")),
      alt: boxAsset.alt ?? `${game.title} AI-generated package front`,
      formatId: boxAsset.boxFormatId,
    } : undefined,
  });
  const isCatalogMethodEntry = editorialSignals.some((signal) => signal.evidenceState === "catalog-method");

  return <div className="site-shell">
    <JsonLd data={createVideoGameStructuredData({ title: game.title, description: game.shortDescription, url: gameUrl, releaseDate: game.release.date, platformNames: platforms.map((platform) => getPlatformDisplayLabel(platform)), genreNames: genres.map((genre) => genre.name) })} />
    <JsonLd data={createBreadcrumbStructuredData([{ name: "GameAtlas", url: site.canonicalUrl }, { name: game.title, url: gameUrl }])} />
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <SiteHeader />

    <main className="game-page" id="main-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">GameAtlas</Link><span aria-hidden="true">/</span><span>{game.title}</span></nav>
      <section className="game-hero game-hero--with-package" aria-labelledby="game-title">
        <GameBoxViewer key={game.slug} presentation={packagePresentation} />
        <div>
          {isSourceListed ? <p className="game-semantic-label">Wikidata-listed platforms</p> : null}
          <p className="eyebrow game-platform-list" aria-label={isSourceListed ? "Wikidata-listed platforms" : "Platforms"}>{platforms.map((platform, index) => <span className="game-platform-item" key={platform.id}><PlatformGlyph platformId={platform.id} />{getPlatformHub(platform.id) ? <Link aria-label={`Open ${platform.name} platform guide`} href={`/platforms/${platform.id}/`}>{getPlatformDisplayLabel(platform)}</Link> : <span title={platform.name}>{getPlatformDisplayLabel(platform)}</span>}{index < platforms.length - 1 ? " · " : null}</span>)}</p>
          <h1 id="game-title">{game.title}</h1>
          <p className="game-intro">{game.shortDescription}</p>
          {isSourceListed && isEarliestTitleRelease ? <p className="game-scope-note">The Wikidata-listed platform and earliest documented title release are separate statements; they do not establish a platform-specific release date.</p> : null}
          <div className="game-status-row">{editorialSignals.length > 0 ? <span className="editorial-badge"><span className="editorial-dot" aria-hidden="true" />{isCatalogMethodEntry ? "GameAtlas catalog entry" : "GameAtlas pick"}</span> : null}{publicSignals.critic ? <a className="score-value" href={publicSignals.critic.url} target="_blank" rel="noreferrer" title={`${publicSignals.critic.provider} · ${publicSignals.critic.detail}`} aria-label={`${publicSignals.critic.label}: ${publicSignals.critic.display}; ${publicSignals.critic.detail}; source ${publicSignals.critic.provider}`}><span className="score-link-label">{publicSignals.critic.label}</span><strong>{publicSignals.critic.display}</strong></a> : criticalLink ? <a className="score-link" href={criticalLink.url} target="_blank" rel="noreferrer" aria-label={`Open ${criticalLink.label.replace(/^External\/reference\s+—\s*/, "")} critic score context for ${game.title} in a new tab`}><span className="score-link-label">Critic score</span><span>{criticalLink.label.replace(/^External\/reference\s+—\s*/, "")} ↗</span></a> : null}{publicSignals.sales ? <a className="sales-summary" href={publicSignals.sales.url} target="_blank" rel="noreferrer" title={`${publicSignals.sales.provider} · ${publicSignals.sales.detail}`} aria-label={`${publicSignals.sales.label}: ${publicSignals.sales.display}; ${publicSignals.sales.detail}; source ${publicSignals.sales.provider}`}><span className="score-link-label">{publicSignals.sales.label}</span><strong>{publicSignals.sales.display}</strong></a> : null}</div>
          <div className="game-meta"><span aria-label={`${isEarliestTitleRelease ? "Title year" : "Release year"}: ${game.release.year}`}><AttributeGlyph kind="year" />{isEarliestTitleRelease ? `Title year ${game.release.year}` : game.release.year}</span>{genres.map((genre) => getGenreHub(genre.id) ? <Link href={`/genres/${genre.id}/`} key={genre.id}>{genre.name}</Link> : <span key={genre.id}>{genre.name}</span>)}</div>
        </div>
      </section>

      <div className="game-content-grid"><section className="game-main-column" aria-labelledby="highlights-heading"><div className="detail-section"><p className="eyebrow">{isCatalogMethodEntry ? "Catalog context" : "Why it is here"}</p><h2 id="highlights-heading">{isCatalogMethodEntry ? "How it was cataloged." : "A useful place to start."}</h2><ul className="highlight-list">{game.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul></div><div className="detail-section" aria-labelledby="evidence-heading"><p className="eyebrow">Evidence</p><h2 id="evidence-heading">{isCatalogMethodEntry ? "Read the method." : "Read the context."}</h2>{editorialSignals.map((signal) => <article className="evidence-card" key={`${signal.provider}-${signal.label}`}><span className="evidence-pill">{signal.evidenceState === "catalog-method" ? "Catalog method" : "Original editorial"}</span><h3>{signal.label}</h3><p>{signal.rationale}</p><small>{signal.evidenceState === "catalog-method" ? "Method" : "Reviewed by"} {signal.reviewedBy ?? "GameAtlas editorial review"} · Captured {signal.capturedAt}</small></article>)}</div></section><aside className="game-sidebar" aria-labelledby="resources-heading"><div className="sidebar-card"><p className="eyebrow">At a glance</p><h2>Game details</h2><dl className="detail-list"><div><dt><span className="detail-label"><PlatformGlyph platformId={platforms[0]?.id ?? "unknown-platform"} />{isSourceListed ? "Wikidata-listed platform" : "Platform"}</span></dt><dd>{platforms.map((platform) => platform.name).join(", ")}</dd></div><div><dt><span className="detail-label"><AttributeGlyph kind="year" />{isEarliestTitleRelease ? "Earliest documented title release" : "First documented release"}</span></dt><dd>{game.release.year}</dd></div>{game.releaseFormat ? <div><dt><span className="detail-label"><AttributeGlyph kind={game.releaseFormat === "digital" ? "digital" : "physical"} />Distribution</span></dt><dd>{game.releaseFormat === "digital" && platforms.some((platform) => platform.id === "nintendo-dsi") ? "DSiWare · Digital" : game.releaseFormat}</dd></div> : null}{game.developer ? <div><dt><span className="detail-label"><AttributeGlyph kind="studio" />Developer</span></dt><dd>{game.developer}</dd></div> : null}{game.publisher ? <div><dt><span className="detail-label"><AttributeGlyph kind="publisher" />Publisher</span></dt><dd>{game.publisher}</dd></div> : null}</dl></div><div className="sidebar-card"><p className="eyebrow">Go deeper</p><h2 id="resources-heading">Official &amp; external resources</h2><ul className="resource-list">{game.links.map((link) => <li key={`${link.kind}-${link.url}`}><a href={link.url} target="_blank" rel="noreferrer">{link.label}<span aria-hidden="true">↗</span></a></li>)}</ul></div></aside></div>
    </main>

    <SiteFooter />
  </div>;
}
