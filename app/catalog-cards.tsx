/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import AttributeGlyph, { type AttributeGlyphKind } from "./attribute-glyph";
import PlatformGlyph from "./platform-glyph";
import { getGenreTone } from "@/lib/catalog/display";
import type { CatalogColumns, CatalogSearchRecord } from "@/lib/catalog/search";

interface CatalogCardsProps {
  records: readonly CatalogSearchRecord[];
  columns?: CatalogColumns;
}

interface CardCredit {
  label: string;
  value: string;
  glyph: AttributeGlyphKind;
}

function externalLabel(label: string): string {
  return label.replace(/^External\/reference\s+—\s*/, "");
}

export default function CatalogCards({ records, columns = "auto" }: CatalogCardsProps) {
  const layoutClass = columns === "auto" ? "" : ` game-grid--columns-${columns}`;
  return <div className={`game-grid${layoutClass}`}>{records.map((record) => {
    const visiblePlatforms = record.platformIds.slice(0, 2);
    const hiddenPlatformCount = Math.max(record.platformIds.length - visiblePlatforms.length, 0);
    const visibleGenres = record.genreIds.slice(0, 3);
    const hiddenGenreCount = Math.max(record.genreIds.length - visibleGenres.length, 0);
    const sameTeam = record.developer && record.publisher && record.developer === record.publisher;
    const distributionLabel = record.releaseFormat === "digital" ? "Digital" : record.releaseFormat === "cartridge" ? "Cartridge" : undefined;
    const credits: CardCredit[] = sameTeam && record.developer
      ? [{ label: "Team", value: record.developer, glyph: "studio" }]
      : [
        ...(record.developer ? [{ label: "Dev", value: record.developer, glyph: "studio" as const }] : []),
        ...(record.publisher ? [{ label: "Pub", value: record.publisher, glyph: "publisher" as const }] : []),
      ];
    const creditTitle = credits.map(({ label, value }) => `${label}: ${value}`).join(" · ");

    return <article className="game-card" key={record.slug}>
      <div className="game-card-topline">
        <div className="game-card-topline-platforms" aria-label={`Platforms: ${record.platformLabels.join(", ")}`}>
          {visiblePlatforms.map((platformId, index) => <span className="game-card-platform" key={platformId} title={record.platformLabels[index]}>
            <PlatformGlyph platformId={platformId} />
            {record.platformHubIds.includes(platformId) ? <Link aria-label={`Open ${record.platformLabels[index]} platform guide`} href={`/platforms/${platformId}/`}>{record.platformDisplayLabels[index]}</Link> : <span>{record.platformDisplayLabels[index]}</span>}
          </span>)}
          {hiddenPlatformCount > 0 ? <span className="game-card-platform game-card-platform--more">+{hiddenPlatformCount}</span> : null}
        </div>
        <span className="game-card-year"><AttributeGlyph kind="year" />{record.releaseYear}</span>
      </div>
      <Link className="game-card-art" href={`/games/${record.slug}/`} aria-label={`Open ${record.title} game page`}>
        {record.artPath ? <img src={record.artPath} alt="" loading="lazy" /> : <span className="game-card-emoji" aria-hidden="true">{record.emoji}</span>}
        <span className="game-card-art-rail">{record.editorialLabel ? <span className="editorial-badge"><span className="editorial-dot" aria-hidden="true" />{record.editorialLabel}</span> : null}</span>
        <span className="art-link-label">View guide <span aria-hidden="true">↗</span></span>
      </Link>
      <div className="game-card-body">
        <h3><Link href={`/games/${record.slug}/`}>{record.title}</Link></h3>
        {distributionLabel ? <div className="game-card-detail-chips"><span className="game-card-distribution"><AttributeGlyph kind={record.releaseFormat === "digital" ? "digital" : "physical"} />{distributionLabel}</span></div> : null}
        <p className="game-card-description">{record.shortDescription}</p>
        {credits.length > 0 ? <div className="game-card-credits" aria-label="Credits" title={creditTitle}>{credits.map(({ label, value, glyph }) => <span className="game-card-credit" key={label}><AttributeGlyph kind={glyph} /><b>{label}</b><span>{value}</span></span>)}</div> : null}
        <div className="tag-list" aria-label="Genres">
          {visibleGenres.map((genreId, index) => record.genreHubIds.includes(genreId) ? <Link className={`tag tag--${getGenreTone(genreId)}`} href={`/genres/${genreId}/`} key={genreId}><AttributeGlyph kind="genre" />{record.genreLabels[index]}</Link> : <span className={`tag tag--${getGenreTone(genreId)}`} key={genreId}><AttributeGlyph kind="genre" />{record.genreLabels[index]}</span>)}
          {hiddenGenreCount > 0 ? <span className="tag tag--more">+{hiddenGenreCount} more</span> : null}
        </div>
        <div className="game-card-footer">
          {record.criticalLink ? <a className="score-link" href={record.criticalLink.url} target="_blank" rel="noreferrer" aria-label={`Open ${externalLabel(record.criticalLink.label)} critical context for ${record.title} in a new tab`}><span className="score-link-label">Score</span><span>{externalLabel(record.criticalLink.label)} ↗</span></a> : <span className="score-link score-link--pending"><span className="score-link-label">Score</span><span>Context pending</span></span>}
          <Link className="card-link" href={`/games/${record.slug}/`}>Read the game page <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </article>;
  })}</div>;
}
