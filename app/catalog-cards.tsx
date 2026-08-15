/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import type { CatalogSearchRecord } from "@/lib/catalog/search";

interface CatalogCardsProps {
  records: readonly CatalogSearchRecord[];
}

export default function CatalogCards({ records }: CatalogCardsProps) {
  return <div className="game-grid">{records.map((record) => <article className="game-card" key={record.slug}><div className="game-card-topline"><span className="taxonomy-links">{record.platformLabels.map((label, index) => <span key={record.platformIds[index]}>{record.platformHubIds.includes(record.platformIds[index]) ? <Link href={`/platforms/${record.platformIds[index]}/`}>{label}</Link> : <span>{label}</span>}{index < record.platformLabels.length - 1 ? " · " : null}</span>)}</span><span>{record.releaseYear}</span></div><div className="game-card-art" aria-hidden="true">{record.artPath ? <img src={record.artPath} alt="" loading="lazy" /> : <span className="game-card-emoji">{record.emoji}</span>}</div><h3><Link href={`/games/${record.slug}/`}>{record.title}</Link></h3><p>{record.shortDescription}</p><div className="tag-list" aria-label="Genres">{record.genreLabels.map((label, index) => record.genreHubIds.includes(record.genreIds[index]) ? <Link className="tag" href={`/genres/${record.genreIds[index]}/`} key={record.genreIds[index]}>{label}</Link> : <span className="tag" key={record.genreIds[index]}>{label}</span>)}</div><div className="game-card-footer"><span className="evidence-pill">{record.evidenceLabels.join(" · ")}</span><Link className="card-link" href={`/games/${record.slug}/`}>Read the game page <span aria-hidden="true">↗</span></Link></div></article>)}</div>;
}
