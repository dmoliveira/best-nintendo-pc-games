/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import PlatformGlyph from "./platform-glyph";
import { getGenreTone } from "@/lib/catalog/display";
import type { CatalogSearchRecord } from "@/lib/catalog/search";

interface CatalogCardsProps {
  records: readonly CatalogSearchRecord[];
}

function externalLabel(label: string): string {
  return label.replace(/^External\/reference\s+—\s*/, "");
}

export default function CatalogCards({ records }: CatalogCardsProps) {
  return <div className="game-grid">{records.map((record) => {
    const visiblePlatforms = record.platformIds.slice(0, 2);
    const hiddenPlatformCount = Math.max(record.platformIds.length - visiblePlatforms.length, 0);
    const visibleGenres = record.genreIds.slice(0, 3);
    const hiddenGenreCount = Math.max(record.genreIds.length - visibleGenres.length, 0);
    const sameTeam = record.developer && record.publisher && record.developer === record.publisher;
    return <article className="game-card" key={record.slug}>
      <div className="game-card-art">
        {record.artPath ? <img src={record.artPath} alt="" loading="lazy" /> : <span className="game-card-emoji" aria-hidden="true">{record.emoji}</span>}
        <div className="game-card-art-rail">
          {record.editorialLabel ? <span className="editorial-badge"><span className="editorial-dot" aria-hidden="true" />{record.editorialLabel}</span> : null}
          <span className="game-card-year">{record.releaseYear}</span>
        </div>
      </div>
      <h3><Link href={`/games/${record.slug}/`}>{record.title}</Link></h3>
      <div className="game-card-platforms" aria-label={`Platforms: ${record.platformLabels.join(", ")}`}>
        {visiblePlatforms.map((platformId, index) => <span className="game-card-platform" key={platformId}>
          <PlatformGlyph platformId={platformId} />
          {record.platformHubIds.includes(platformId) ? <Link href={`/platforms/${platformId}/`}>{record.platformLabels[index]}</Link> : <span>{record.platformLabels[index]}</span>}
        </span>)}
        {hiddenPlatformCount > 0 ? <span className="game-card-platform game-card-platform--more">+{hiddenPlatformCount}</span> : null}
      </div>
      <p className="game-card-description">{record.shortDescription}</p>
      {record.developer || record.publisher ? <div className="game-card-credits" aria-label="Credits">
        {sameTeam ? <span><b>Team</b>{record.developer}</span> : <>{record.developer ? <span><b>Dev</b>{record.developer}</span> : null}{record.publisher ? <span><b>Pub</b>{record.publisher}</span> : null}</>}
      </div> : null}
      <div className="tag-list" aria-label="Genres">
        {visibleGenres.map((genreId, index) => record.genreHubIds.includes(genreId) ? <Link className={`tag tag--${getGenreTone(genreId)}`} href={`/genres/${genreId}/`} key={genreId}>{record.genreLabels[index]}</Link> : <span className={`tag tag--${getGenreTone(genreId)}`} key={genreId}>{record.genreLabels[index]}</span>)}
        {hiddenGenreCount > 0 ? <span className="tag tag--more">+{hiddenGenreCount} more</span> : null}
      </div>
      <div className="game-card-footer">
        {record.criticalLink ? <a className="score-link" href={record.criticalLink.url} target="_blank" rel="noreferrer" aria-label={`Open ${externalLabel(record.criticalLink.label)} critical context for ${record.title} in a new tab`}><span className="score-link-label">Score</span><span>{externalLabel(record.criticalLink.label)} ↗</span></a> : <span className="score-link score-link--pending"><span className="score-link-label">Score</span><span>Context pending</span></span>}
        <Link className="card-link" href={`/games/${record.slug}/`}>Read the game page <span aria-hidden="true">↗</span></Link>
      </div>
    </article>;
  })}</div>;
}
