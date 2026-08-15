"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  EMPTY_SEARCH_STATE,
  filterCatalog,
  normalizeSearchText,
  parseSearchState,
  serializeSearchState,
  type CatalogSearchRecord,
  type CatalogSearchState,
} from "@/lib/catalog/search";

interface CatalogBrowserProps {
  records: readonly CatalogSearchRecord[];
}

export default function CatalogBrowser({ records }: CatalogBrowserProps) {
  const options = useMemo(() => ({
    platformIds: new Set(records.flatMap((record) => record.platformIds)),
    genreIds: new Set(records.flatMap((record) => record.genreIds)),
    years: new Set(records.map((record) => String(record.releaseYear))),
  }), [records]);
  const platformOptions = useMemo(() => [...new Map(records.flatMap((record) => record.platformLabels.map((label, index) => [label, record.platformIds[index]] as const))).entries()].sort(([left], [right]) => normalizeSearchText(left) < normalizeSearchText(right) ? -1 : normalizeSearchText(left) > normalizeSearchText(right) ? 1 : 0), [records]);
  const genreOptions = useMemo(() => [...new Map(records.flatMap((record) => record.genreLabels.map((label, index) => [label, record.genreIds[index]] as const))).entries()].sort(([left], [right]) => normalizeSearchText(left) < normalizeSearchText(right) ? -1 : normalizeSearchText(left) > normalizeSearchText(right) ? 1 : 0), [records]);
  const yearOptions = useMemo(() => [...options.years].sort((left, right) => Number(right) - Number(left)), [options.years]);
  const [state, setState] = useState<CatalogSearchState>(EMPTY_SEARCH_STATE);
  const filteredRecords = useMemo(() => filterCatalog(records, state), [records, state]);

  useEffect(() => {
    const syncFromUrl = () => setState(parseSearchState(new URLSearchParams(window.location.search), options));
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [options]);

  function syncUrl(nextState: CatalogSearchState, mode: "push" | "replace") {
    const nextUrl = `${window.location.pathname}${serializeSearchState(nextState)}${window.location.hash}`;
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", nextUrl);
  }

  function updateQuery(value: string) {
    const nextState = { ...state, q: value };
    setState(nextState);
    syncUrl(nextState, "replace");
  }

  function updateFilter(field: "platform" | "genre" | "year", value: string) {
    const nextState = { ...state, [field]: value };
    setState(nextState);
    syncUrl(nextState, "push");
  }

  function clearFilters() {
    setState(EMPTY_SEARCH_STATE);
    syncUrl(EMPTY_SEARCH_STATE, "push");
  }

  return <div className="catalog-browser">
    <form className="browser-panel" role="search" aria-label="Search the GameAtlas catalog" onSubmit={(event) => { event.preventDefault(); syncUrl(state, "replace"); }}>
      <div className="browser-controls">
        <label className="browser-field browser-field--query" htmlFor="catalog-query">Search games<input id="catalog-query" type="search" value={state.q} onChange={(event) => updateQuery(event.target.value)} placeholder="Title, person, platform, or keyword" /></label>
        <label className="browser-field" htmlFor="catalog-platform">Platform<select id="catalog-platform" value={state.platform} onChange={(event) => updateFilter("platform", event.target.value)}><option value="">All platforms</option>{platformOptions.map(([label, value]) => <option value={value} key={label}>{label}</option>)}</select></label>
        <label className="browser-field" htmlFor="catalog-genre">Genre<select id="catalog-genre" value={state.genre} onChange={(event) => updateFilter("genre", event.target.value)}><option value="">All genres</option>{genreOptions.map(([label, value]) => <option value={value} key={label}>{label}</option>)}</select></label>
        <label className="browser-field" htmlFor="catalog-year">Year<select id="catalog-year" value={state.year} onChange={(event) => updateFilter("year", event.target.value)}><option value="">Any year</option>{yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
        <div className="browser-actions"><button className="browser-button browser-button--clear" type="button" onClick={clearFilters}>Clear filters</button><button className="browser-button" type="submit">Search</button></div>
      </div>
    </form>
    <p className="result-summary" aria-live="polite">Showing {filteredRecords.length} of {records.length} reviewed games.</p>
    {filteredRecords.length > 0 ? <div className="game-grid">{filteredRecords.map((record) => <article className="game-card" key={record.slug}><div className="game-card-topline"><span>{record.platformLabels.join(" · ")}</span><span>{record.releaseYear}</span></div><div className="game-card-emoji" aria-hidden="true">{record.emoji}</div><h3><Link href={`/games/${record.slug}/`}>{record.title}</Link></h3><p>{record.shortDescription}</p><div className="tag-list" aria-label="Genres">{record.genreLabels.map((label) => <span className="tag" key={label}>{label}</span>)}</div><div className="game-card-footer"><span className="evidence-pill">{record.evidenceLabels.join(" · ")}</span><Link className="card-link" href={`/games/${record.slug}/`}>Read the game page <span aria-hidden="true">↗</span></Link></div></article>)}</div> : <div className="empty-state" role="status"><strong>No games match those filters.</strong><span>Try a broader title, platform, genre, or year.</span><button className="text-link" type="button" onClick={clearFilters}>Clear the current search ↗</button></div>}
  </div>;
}
