"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import CatalogCards from "./catalog-cards";
import {
  CATALOG_SORT_OPTIONS,
  DEFAULT_PAGE_SIZE,
  EMPTY_SEARCH_STATE,
  filterCatalog,
  normalizeSearchText,
  PAGE_SIZE_OPTIONS,
  paginateCatalog,
  parseSearchState,
  SEARCH_STATE_EVENT,
  serializeSearchState,
  type CatalogColumns,
  type CatalogPageSize,
  type CatalogSearchRecord,
  type CatalogSearchState,
  type SearchStateOptions,
} from "@/lib/catalog/search";

const layoutOptions: Array<{ value: CatalogColumns; label: string; description: string }> = [
  { value: "auto", label: "Auto", description: "Responsive" },
  { value: "1", label: "1", description: "Focus" },
  { value: "2", label: "2", description: "Balanced" },
  { value: "3", label: "3", description: "Dense" },
];

interface CatalogBrowserProps {
  records: readonly CatalogSearchRecord[];
}

interface FilterOption {
  id: string;
  label: string;
}

function subscribeToHydration(): () => void {
  return () => undefined;
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getServerHydratedSnapshot(): boolean {
  return false;
}

function compareLabels(left: FilterOption, right: FilterOption): number {
  return normalizeSearchText(left.label).localeCompare(normalizeSearchText(right.label), "en") || left.id.localeCompare(right.id, "en");
}

function selectedValues(value: string | undefined): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function nameOptions(records: readonly CatalogSearchRecord[], field: "developer" | "publisher"): FilterOption[] {
  const options = new Map<string, string>();
  for (const record of records) {
    const label = record[field];
    if (label) options.set(normalizeSearchText(label), label);
  }
  return [...options.entries()].map(([id, label]) => ({ id, label })).sort(compareLabels);
}

export default function CatalogBrowser({ records }: CatalogBrowserProps) {
  const platformOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const record of records) record.platformIds.forEach((id, index) => options.set(id, record.platformDisplayLabels[index]));
    return [...options.entries()].map(([id, label]) => ({ id, label })).sort(compareLabels);
  }, [records]);
  const genreOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const record of records) record.genreIds.forEach((id, index) => options.set(id, record.genreLabels[index]));
    return [...options.entries()].map(([id, label]) => ({ id, label })).sort(compareLabels);
  }, [records]);
  const developerOptions = useMemo(() => nameOptions(records, "developer"), [records]);
  const publisherOptions = useMemo(() => nameOptions(records, "publisher"), [records]);
  const yearOptions = useMemo(() => [...new Set(records.map((record) => record.releaseYear))].sort((left, right) => right - left), [records]);
  const options = useMemo<SearchStateOptions>(() => ({
    platformIds: new Set(platformOptions.map((option) => option.id)),
    genreIds: new Set(genreOptions.map((option) => option.id)),
    years: new Set(yearOptions.map(String)),
    developerValues: new Set(developerOptions.map((option) => option.id)),
    publisherValues: new Set(publisherOptions.map((option) => option.id)),
    yearMin: Math.min(...yearOptions),
    yearMax: Math.max(...yearOptions),
  }), [developerOptions, genreOptions, platformOptions, publisherOptions, yearOptions]);
  const [state, setState] = useState<CatalogSearchState>(EMPTY_SEARCH_STATE);
  const hydrated = useSyncExternalStore(subscribeToHydration, getHydratedSnapshot, getServerHydratedSnapshot);
  const resultSummaryRef = useRef<HTMLParagraphElement>(null);
  const filteredRecords = useMemo(() => filterCatalog(records, state), [records, state]);
  const page = useMemo(() => paginateCatalog(filteredRecords, state.page, state.pageSize), [filteredRecords, state.page, state.pageSize]);
  const platforms = selectedValues(state.platform);
  const genres = selectedValues(state.genre);
  const yearFrom = state.yearFrom || state.year;
  const yearTo = state.yearTo || state.year;
  const activeFilterCount = platforms.length + genres.length + [state.q, yearFrom || yearTo, state.developer, state.publisher].filter(Boolean).length;
  const activeSortLabel = CATALOG_SORT_OPTIONS.find((option) => option.value === (state.sort ?? "relevance"))?.label ?? "Relevance";

  useEffect(() => {
    const syncFromUrl = () => {
      const parsedState = parseSearchState(new URLSearchParams(window.location.search), options);
      const parsedRecords = filterCatalog(records, parsedState);
      const parsedPage = paginateCatalog(parsedRecords, parsedState.page, parsedState.pageSize).page;
      const nextState = { ...parsedState, page: parsedPage };
      setState(nextState);
      if (window.location.search !== serializeSearchState(nextState)) syncUrl(nextState, "replace");
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [options, records]);

  function syncUrl(nextState: CatalogSearchState, mode: "push" | "replace") {
    const nextUrl = `${window.location.pathname}${serializeSearchState(nextState)}${window.location.hash}`;
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", nextUrl);
    window.dispatchEvent(new Event(SEARCH_STATE_EVENT));
  }

  function updateState(patch: Partial<CatalogSearchState>, mode: "push" | "replace" = "push") {
    const nextState = { ...state, ...patch, page: 1 };
    setState(nextState);
    syncUrl(nextState, mode);
  }

  function updateQuery(value: string) {
    updateState({ q: value }, "replace");
  }

  function updateFacet(field: "platform" | "genre", value: string, checked: boolean) {
    const nextValues = new Set(selectedValues(state[field]));
    if (checked) nextValues.add(value);
    else nextValues.delete(value);
    updateState({ [field]: [...nextValues].sort().join(",") });
  }

  function updateYear(field: "yearFrom" | "yearTo", value: string) {
    let nextFrom = field === "yearFrom" ? value : yearFrom;
    let nextTo = field === "yearTo" ? value : yearTo;
    if (nextFrom && nextTo && Number(nextFrom) > Number(nextTo)) [nextFrom, nextTo] = [nextTo, nextFrom];
    updateState({ year: "", yearFrom: nextFrom, yearTo: nextTo });
  }

  function updateAdvancedFilter(field: "developer" | "publisher", value: string) {
    updateState({ [field]: value });
  }

  function updateSort(value: string) {
    if (CATALOG_SORT_OPTIONS.some((option) => option.value === value)) updateState({ sort: value as CatalogSortValue });
  }

  function updatePageSize(value: string) {
    const pageSize = Number(value);
    if (PAGE_SIZE_OPTIONS.includes(pageSize as CatalogPageSize)) updateState({ pageSize: pageSize as CatalogPageSize });
  }

  function updatePage(nextPage: number) {
    const nextState = { ...state, page: nextPage };
    setState(nextState);
    syncUrl(nextState, "push");
    window.requestAnimationFrame(() => {
      const summary = resultSummaryRef.current;
      if (!summary) return;
      summary.focus({ preventScroll: true });
      summary.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
  }

  function updateColumns(columns: CatalogColumns) {
    const nextState = { ...state, columns };
    setState(nextState);
    syncUrl(nextState, "push");
  }

  function clearFilters() {
    const nextState = { ...EMPTY_SEARCH_STATE, columns: state.columns };
    setState(nextState);
    syncUrl(nextState, "push");
  }

  const displayRecords = hydrated ? page.records : filteredRecords;
  const resultPositionOffset = hydrated ? page.startIndex : 0;
  const resultSummary = hydrated
    ? filteredRecords.length > 0 ? `Showing ${page.startIndex + 1}–${page.endIndex} of ${filteredRecords.length} matching games.` : "Showing 0 matching games."
    : `Showing 1–${records.length} of ${records.length} reviewed games.`;

  return <div className="catalog-browser">
    <form className="browser-panel" id="catalog-search" role="search" aria-label="Catalog search and filters" onSubmit={(event) => { event.preventDefault(); syncUrl(state, "replace"); }}>
      <div className="browser-panel-heading">
        <div><p className="eyebrow">Find your next favorite</p><h3>Filter the atlas.</h3></div>
        <div className="browser-panel-status"><span>{activeFilterCount ? `${activeFilterCount} active` : "All picks"}</span><button className="browser-button browser-button--clear" type="button" onClick={clearFilters}>Reset</button></div>
      </div>
      <div className="browser-controls">
        <label className="browser-field browser-field--query" htmlFor="catalog-query"><span>Search games</span><span className="browser-input"><span className="field-icon" aria-hidden="true">⌕</span><input id="catalog-query" type="search" value={state.q} onChange={(event) => updateQuery(event.target.value)} placeholder="Title, person, platform, or keyword" /></span></label>
        <label className="browser-field" htmlFor="catalog-sort"><span>Sort by</span><select id="catalog-sort" value={state.sort ?? "relevance"} onChange={(event) => updateSort(event.target.value)}><option value="score" disabled>Score (licensed data only)</option>{CATALOG_SORT_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <label className="browser-field" htmlFor="catalog-year-from"><span>From year</span><select id="catalog-year-from" value={yearFrom} onChange={(event) => updateYear("yearFrom", event.target.value)}><option value="">Any year</option>{yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
        <label className="browser-field" htmlFor="catalog-year-to"><span>To year</span><select id="catalog-year-to" value={yearTo} onChange={(event) => updateYear("yearTo", event.target.value)}><option value="">Any year</option>{yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
      </div>
      <div className="browser-facet-grid">
        <details className="browser-disclosure">
          <summary>Platforms <span>{platforms.length ? `${platforms.length} selected` : "All"}</span></summary>
          <fieldset className="browser-check-fieldset"><legend className="visually-hidden">Platforms</legend><div className="browser-check-list">{platformOptions.map((option) => <label className="browser-check" key={option.id}><input type="checkbox" checked={platforms.includes(option.id)} onChange={(event) => updateFacet("platform", option.id, event.target.checked)} /><span>{option.label}</span></label>)}</div></fieldset>
        </details>
        <details className="browser-disclosure">
          <summary>Genres <span>{genres.length ? `${genres.length} selected` : "All"}</span></summary>
          <fieldset className="browser-check-fieldset"><legend className="visually-hidden">Genres</legend><div className="browser-check-list">{genreOptions.map((option) => <label className="browser-check" key={option.id}><input type="checkbox" checked={genres.includes(option.id)} onChange={(event) => updateFacet("genre", option.id, event.target.checked)} /><span>{option.label}</span></label>)}</div></fieldset>
        </details>
        <details className="browser-disclosure browser-disclosure--advanced">
          <summary>Advanced filters <span>{state.developer || state.publisher ? "Active" : "Optional"}</span></summary>
          <div className="browser-advanced-fields">
            <label className="browser-field" htmlFor="catalog-developer"><span>Developer</span><select id="catalog-developer" value={state.developer ?? ""} onChange={(event) => updateAdvancedFilter("developer", event.target.value)}><option value="">All developers</option>{developerOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
            <label className="browser-field" htmlFor="catalog-publisher"><span>Publisher</span><select id="catalog-publisher" value={state.publisher ?? ""} onChange={(event) => updateAdvancedFilter("publisher", event.target.value)}><option value="">All publishers</option>{publisherOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
          </div>
        </details>
      </div>
      <div className="browser-layout-row">
        <fieldset className="layout-control">
          <legend>Card layout</legend>
          <div className="layout-options" role="radiogroup" aria-label="Choose card columns">
            {layoutOptions.map((option) => <label className={`layout-option${state.columns === option.value ? " layout-option--active" : ""}`} key={option.value}>
              <input type="radio" name="card-columns" value={option.value} checked={state.columns === option.value} onChange={() => updateColumns(option.value)} />
              <span className="layout-option-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
            </label>)}
          </div>
        </fieldset>
      </div>
      {activeFilterCount > 0 ? <div className="browser-filter-summary" aria-label="Active filters">{state.q ? <button type="button" className="filter-chip" onClick={() => updateQuery("")}>Search: {state.q} <span aria-hidden="true">×</span></button> : null}{platformOptions.filter((option) => platforms.includes(option.id)).map((option) => <button type="button" className="filter-chip" key={`platform-${option.id}`} onClick={() => updateFacet("platform", option.id, false)}>{option.label} <span aria-hidden="true">×</span></button>)}{genreOptions.filter((option) => genres.includes(option.id)).map((option) => <button type="button" className="filter-chip" key={`genre-${option.id}`} onClick={() => updateFacet("genre", option.id, false)}>{option.label} <span aria-hidden="true">×</span></button>)}{yearFrom || yearTo ? <button type="button" className="filter-chip" onClick={() => updateState({ year: "", yearFrom: "", yearTo: "" })}>Years: {yearFrom || "Any"}–{yearTo || "Any"} <span aria-hidden="true">×</span></button> : null}{state.developer ? <button type="button" className="filter-chip" onClick={() => updateAdvancedFilter("developer", "")}>Dev: {developerOptions.find((option) => option.id === state.developer)?.label ?? state.developer} <span aria-hidden="true">×</span></button> : null}{state.publisher ? <button type="button" className="filter-chip" onClick={() => updateAdvancedFilter("publisher", "")}>Pub: {publisherOptions.find((option) => option.id === state.publisher)?.label ?? state.publisher} <span aria-hidden="true">×</span></button> : null}</div> : null}
      <div className="browser-panel-footer"><p>Filters combine across facets. Multiple platforms or genres broaden that facet.</p><button className="browser-button" type="submit">Update results <span aria-hidden="true">↗</span></button></div>
    </form>
    <div className="result-bar"><p className="result-summary" ref={resultSummaryRef} tabIndex={-1} aria-live="polite">{resultSummary}</p><div className="result-tools"><span className="result-detail">{activeSortLabel} · signals kept separate</span><label className="page-size-field" htmlFor="catalog-page-size"><span>Cards</span><select id="catalog-page-size" value={state.pageSize ?? DEFAULT_PAGE_SIZE} onChange={(event) => updatePageSize(event.target.value)}>{PAGE_SIZE_OPTIONS.map((size) => <option value={size} key={size}>{size} / page</option>)}</select></label></div></div>
    {filteredRecords.length > 0 ? <CatalogCards records={displayRecords} columns={state.columns} showResultPosition resultPositionOffset={resultPositionOffset} resultPositionTotal={filteredRecords.length} /> : <div className="empty-state" role="status"><strong>No games match those filters.</strong><span>Try a broader title, platform, genre, year, developer, or publisher.</span><button className="text-link" type="button" onClick={clearFilters}>Clear the current search <span aria-hidden="true">↗</span></button></div>}
    {hydrated && page.pageCount > 1 ? <nav className="catalog-pagination" aria-label="Catalog pages"><button type="button" className="pagination-button" disabled={page.page === 1} onClick={() => updatePage(page.page - 1)}>Previous</button><div className="pagination-pages">{Array.from({ length: page.pageCount }, (_, index) => index + 1).map((pageNumber) => <button type="button" className={`pagination-button${pageNumber === page.page ? " pagination-button--current" : ""}`} aria-current={pageNumber === page.page ? "page" : undefined} aria-label={`Go to page ${pageNumber}`} key={pageNumber} onClick={() => updatePage(pageNumber)}>{pageNumber}</button>)}</div><button type="button" className="pagination-button" disabled={page.page === page.pageCount} onClick={() => updatePage(page.page + 1)}>Next</button></nav> : null}
  </div>;
}

type CatalogSortValue = NonNullable<CatalogSearchState["sort"]>;
