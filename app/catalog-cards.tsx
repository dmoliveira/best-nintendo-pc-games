"use client";

import Link from "next/link";
import AttributeGlyph, { type AttributeGlyphKind } from "./attribute-glyph";
import PlatformGlyph from "./platform-glyph";
import PackageThumbnail from "./package-thumbnail";
import { getGenreTone } from "@/lib/catalog/display";
import type { CatalogCardRecord, CatalogColumns } from "@/lib/catalog/search";

interface CatalogCardsProps {
  records: readonly CatalogCardRecord[];
  columns?: CatalogColumns;
  showImages?: boolean;
  showResultPosition?: boolean;
  resultPositionOffset?: number;
  resultPositionTotal?: number;
}

interface CardCredit {
  label: string;
  value: string;
  glyph: AttributeGlyphKind;
}

function externalLabel(label: string): string {
  return label.replace(/^External\/reference\s+—\s*/, "");
}

export default function CatalogCards({ records, columns = "auto", showImages = true, showResultPosition = false, resultPositionOffset = 0, resultPositionTotal = records.length }: CatalogCardsProps) {
  const layoutClass = columns === "auto" ? "" : ` game-grid--columns-${columns}`;
  return <div className={`game-grid${layoutClass}`}>{records.map((record, index) => {
    const visiblePlatforms = record.platformIds.slice(0, 2);
    const hiddenPlatformLabels = record.platformLabels.slice(visiblePlatforms.length);
    const hiddenPlatformCount = hiddenPlatformLabels.length;
    const visibleGenres = record.genreIds.slice(0, 3);
    const hiddenGenreLabels = record.genreLabels.slice(visibleGenres.length);
    const hiddenGenreCount = hiddenGenreLabels.length;
    const sameTeam = record.developer && record.publisher && record.developer === record.publisher;
    const distributionLabel = record.releaseFormat === "digital" ? "Digital" : record.releaseFormat === "cartridge" ? "Cartridge" : undefined;
    const credits: CardCredit[] = sameTeam && record.developer
      ? [{ label: "Team", value: record.developer, glyph: "studio" }]
      : [
        ...(record.developer ? [{ label: "Dev", value: record.developer, glyph: "studio" as const }] : []),
        ...(record.publisher ? [{ label: "Pub", value: record.publisher, glyph: "publisher" as const }] : []),
      ];
    const creditTitle = credits.map(({ label, value }) => `${label}: ${value}`).join(" · ");
    const resultPosition = resultPositionOffset + index + 1;
    const positionLabel = `Current result position ${resultPosition} of ${resultPositionTotal}`;

    return <article className={`game-card${showImages ? "" : " game-card--no-image"}`} key={record.slug}>
      <div className="game-card-topline">
        <div className="game-card-topline-leading">
          {showResultPosition ? <span className="game-card-position" aria-label={positionLabel} title="Current catalog order, not a quality ranking"><span className="game-card-position-label">Item</span> {String(resultPosition).padStart(2, "0")} <span className="game-card-position-total">/ {resultPositionTotal}</span></span> : null}
          <ul className="game-card-topline-platforms" aria-label="Platforms">
            {visiblePlatforms.map((platformId, platformIndex) => <li className="game-card-platform" key={platformId} title={record.platformLabels[platformIndex]}>
              <PlatformGlyph platformId={platformId} />
              {record.platformHubIds.includes(platformId) ? <Link aria-label={`Open ${record.platformLabels[platformIndex]} platform guide`} href={`/platforms/${platformId}/`}>{record.platformDisplayLabels[platformIndex]}</Link> : <span>{record.platformDisplayLabels[platformIndex]}</span>}
            </li>)}
            {hiddenPlatformCount > 0 ? <li className="game-card-platform game-card-platform--more" data-platform-overflow={hiddenPlatformCount}><span aria-hidden="true">+{hiddenPlatformCount}</span> platforms<span className="visually-hidden">: {hiddenPlatformLabels.join(", ")}</span></li> : null}
          </ul>
        </div>
        <span className="game-card-year"><AttributeGlyph kind="year" />{record.releaseYear}</span>
      </div>
      {showImages ? <div className="game-card-art">
        <PackageThumbnail thumbnail={record.packageThumbnail} emoji={record.emoji} />
        <span className="game-card-art-rail">{record.editorialLabel ? <span className="editorial-badge"><span className="editorial-dot" aria-hidden="true" />{record.editorialLabel}</span> : null}</span>
        <span className="art-link-label" aria-hidden="true">View guide <span>↗</span></span>
      </div> : record.editorialLabel ? <div className="game-card-compact-rail"><span className="editorial-badge"><span className="editorial-dot" aria-hidden="true" />{record.editorialLabel}</span></div> : null}
      <div className="game-card-body">
        <h3><Link className="game-card-title-link" href={`/games/${record.slug}/`}>{record.title}</Link></h3>
        {distributionLabel ? <div className="game-card-detail-chips"><span className="game-card-distribution"><AttributeGlyph kind={record.releaseFormat === "digital" ? "digital" : "physical"} />{distributionLabel}</span></div> : null}
        <p className="game-card-description">{record.shortDescription}</p>
        {credits.length > 0 ? <div className="game-card-credits" aria-label="Credits" title={creditTitle}>{credits.map(({ label, value, glyph }) => <span className="game-card-credit" key={label}><AttributeGlyph kind={glyph} /><b>{label}</b><span>{value}</span></span>)}</div> : null}
        <div className="tag-list" aria-label="Genres">
          {visibleGenres.map((genreId, genreIndex) => record.genreHubIds.includes(genreId) ? <Link className={`tag tag--${getGenreTone(genreId)}`} href={`/genres/${genreId}/`} key={genreId}><AttributeGlyph kind="genre" />{record.genreLabels[genreIndex]}</Link> : <span className={`tag tag--${getGenreTone(genreId)}`} key={genreId}><AttributeGlyph kind="genre" />{record.genreLabels[genreIndex]}</span>)}
          {hiddenGenreCount > 0 ? <span className="tag tag--more" data-genre-overflow={hiddenGenreCount}><span aria-hidden="true">+{hiddenGenreCount}</span> more genres<span className="visually-hidden">: {hiddenGenreLabels.join(", ")}</span></span> : null}
        </div>
        <div className="game-card-footer">
          <div className="game-card-signal-stack" aria-label="Published signals">
            {record.criticSummary ? <a className="score-value" href={record.criticSummary.url} target="_blank" rel="noreferrer" title={`${record.criticSummary.provider} · ${record.criticSummary.detail}`} aria-label={`${record.criticSummary.label}: ${record.criticSummary.display}; ${record.criticSummary.detail}; source ${record.criticSummary.provider}; opens in a new tab`}><span className="score-link-label">{record.criticSummary.label}</span><strong>{record.criticSummary.display}</strong></a> : record.criticalLink ? <a className="score-link" href={record.criticalLink.url} target="_blank" rel="noreferrer" aria-label={`Open ${externalLabel(record.criticalLink.label)} critic score context for ${record.title} in a new tab`}><span className="score-link-label">Critic score</span><span>{externalLabel(record.criticalLink.label)} ↗</span></a> : <span className="score-link score-link--pending"><span className="score-link-label">Critic score</span><span>Context pending</span></span>}
            {record.salesSummary ? <a className="sales-summary" href={record.salesSummary.url} target="_blank" rel="noreferrer" title={`${record.salesSummary.provider} · ${record.salesSummary.detail}`} aria-label={`${record.salesSummary.label}: ${record.salesSummary.display}; ${record.salesSummary.detail}; source ${record.salesSummary.provider}; opens in a new tab`}><span className="score-link-label">{record.salesSummary.label}</span><strong>{record.salesSummary.display}</strong></a> : null}
          </div>
          <span className="card-link" aria-hidden="true">Read the game page <span>↗</span></span>
        </div>
      </div>
    </article>;
  })}</div>;
}
