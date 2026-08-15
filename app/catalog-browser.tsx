"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import CatalogCards from "./catalog-cards";
import {
  CATALOG_SORT_OPTIONS,
  clearCatalogFilters,
  createSearchStateOptions,
  DEFAULT_PAGE_SIZE,
  EMPTY_SEARCH_STATE,
  filterCatalog,
  getCatalogPaginationItems,
  normalizeSearchText,
  PAGE_SIZE_OPTIONS,
  paginateCatalog,
  parseCatalogSearchIndex,
  parseSearchState,
  SEARCH_STATE_EVENT,
  serializeSearchState,
  type CatalogColumns,
  type CatalogCardRecord,
  type CatalogImageMode,
  type CatalogPageSize,
  type CatalogSearchRecord,
  type CatalogSearchState,
} from "@/lib/catalog/search";

const layoutOptions: Array<{ value: CatalogColumns; label: string; description: string; accessibleLabel: string }> = [
  { value: "auto", label: "Auto", description: "Responsive", accessibleLabel: "Automatic responsive card layout" },
  { value: "1", label: "1", description: "Focus", accessibleLabel: "One-column card layout" },
  { value: "2", label: "2", description: "Balanced", accessibleLabel: "Two-column card layout" },
  { value: "3", label: "3", description: "Dense", accessibleLabel: "Three-column card layout" },
];

const catalogQueryKeys = new Set(["q", "platform", "genre", "year", "from", "to", "developer", "publisher", "sort", "page", "perPage", "columns", "images"]);
const catalogFilterKeys = new Set(["q", "platform", "genre", "year", "from", "to", "developer", "publisher"]);
const catalogQueryParamGroups: Record<string, readonly string[]> = {
  q: ["q"],
  platform: ["platform"],
  genre: ["genre"],
  year: ["year", "from", "to"],
  yearFrom: ["year", "from", "to"],
  yearTo: ["year", "from", "to"],
  developer: ["developer"],
  publisher: ["publisher"],
  sort: ["sort"],
  page: ["page"],
  pageSize: ["perPage"],
  columns: ["columns"],
  images: ["images"],
};

interface CatalogBrowserProps {
  initialRecords: readonly CatalogCardRecord[];
  catalogEntryCount: number;
  catalogIndexDigest: string;
  catalogIndexUrl: string;
  catalogIndexHref: string;
  basePath: string;
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

function hasCatalogQuery(search: string): boolean {
  return [...new URLSearchParams(search).keys()].some((key) => catalogQueryKeys.has(key));
}

function hasCatalogFilterQuery(search: string): boolean {
  return [...new URLSearchParams(search).keys()].some((key) => catalogFilterKeys.has(key));
}

function searchStateFromUrl(records: readonly CatalogSearchRecord[], search: URLSearchParams): CatalogSearchState {
  const parsedState = parseSearchState(search, createSearchStateOptions(records));
  const parsedRecords = filterCatalog(records, parsedState);
  return { ...parsedState, page: paginateCatalog(parsedRecords, parsedState.page, parsedState.pageSize).page };
}

function nameOptions(records: readonly CatalogCardRecord[], field: "developer" | "publisher"): FilterOption[] {
  const options = new Map<string, string>();
  for (const record of records) {
    const label = record[field];
    if (label) options.set(normalizeSearchText(label), label);
  }
  return [...options.entries()].map(([id, label]) => ({ id, label })).sort(compareLabels);
}

export default function CatalogBrowser({ initialRecords, catalogEntryCount, catalogIndexDigest, catalogIndexUrl, catalogIndexHref, basePath }: CatalogBrowserProps) {
  const [loadedRecords, setLoadedRecords] = useState<readonly CatalogSearchRecord[] | undefined>();
  const [indexStatus, setIndexStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const indexStatusRef = useRef(indexStatus);
  const mountedRef = useRef(false);
  const [hasRecognizedUrlQuery, setHasRecognizedUrlQuery] = useState(false);
  const catalogBrowserRef = useRef<HTMLDivElement>(null);
  const indexRequestRef = useRef<Promise<void> | null>(null);
  const indexAbortRef = useRef<AbortController | null>(null);
  const catalogReady = loadedRecords !== undefined;
  const records: readonly CatalogCardRecord[] = loadedRecords ?? initialRecords;
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
  const options = useMemo(() => createSearchStateOptions(records), [records]);
  const [state, setState] = useState<CatalogSearchState>(EMPTY_SEARCH_STATE);
  const hydrated = useSyncExternalStore(subscribeToHydration, getHydratedSnapshot, getServerHydratedSnapshot);
  const resultSummaryRef = useRef<HTMLParagraphElement>(null);
  const filteredRecords = useMemo(() => loadedRecords ? filterCatalog(loadedRecords, state) : [], [loadedRecords, state]);
  const page = useMemo(() => paginateCatalog(filteredRecords, catalogReady ? state.page : 1, state.pageSize), [catalogReady, filteredRecords, state.page, state.pageSize]);
  const paginationItems = useMemo(() => getCatalogPaginationItems(page.pageCount, page.page), [page.page, page.pageCount]);
  const platforms = selectedValues(state.platform);
  const genres = selectedValues(state.genre);
  const yearFrom = state.yearFrom || state.year;
  const yearTo = state.yearTo || state.year;
  const activeFilterCount = platforms.length + genres.length + [state.q, yearFrom || yearTo, state.developer, state.publisher].filter(Boolean).length;
  const developerLabel = state.developer ? developerOptions.find((option) => option.id === state.developer)?.label ?? state.developer : "";
  const publisherLabel = state.publisher ? publisherOptions.find((option) => option.id === state.publisher)?.label ?? state.publisher : "";
  const pendingFilterQuery = hydrated && !catalogReady && hasCatalogFilterQuery(window.location.search);
  const hasVisibleFilters = activeFilterCount > 0 || pendingFilterQuery;

  const loadCatalogIndex = useCallback((force = false) => {
    if (indexRequestRef.current || indexStatusRef.current === "loading" || indexStatusRef.current === "ready" || (indexStatusRef.current === "error" && !force)) return;
    const controller = new AbortController();
    indexAbortRef.current = controller;
    indexStatusRef.current = "loading";
    setIndexStatus("loading");
    const request = fetch(catalogIndexUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`catalog index request failed with ${response.status}`);
        const value: unknown = await response.json();
        const catalogRecords = await parseCatalogSearchIndex(value, catalogEntryCount, catalogIndexDigest, catalogIndexUrl);
        if (!catalogRecords) throw new Error("catalog index must contain the expected safe records");
        return catalogRecords;
      })
      .then((catalogRecords) => {
        if (controller.signal.aborted || indexAbortRef.current !== controller) return;
        indexRequestRef.current = null;
        indexAbortRef.current = null;
        indexStatusRef.current = "ready";
        if (!mountedRef.current) return;
        setState(searchStateFromUrl(catalogRecords, new URLSearchParams(window.location.search)));
        setLoadedRecords(catalogRecords);
        setIndexStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || indexAbortRef.current !== controller || (error instanceof DOMException && error.name === "AbortError")) return;
        indexRequestRef.current = null;
        indexAbortRef.current = null;
        indexStatusRef.current = "error";
        if (!mountedRef.current) return;
        setIndexStatus("error");
      });
    indexRequestRef.current = request;
  }, [catalogEntryCount, catalogIndexDigest, catalogIndexUrl]);

  const syncUrl = useCallback((nextState: CatalogSearchState, mode: "push" | "replace", changedFields: readonly string[] = []) => {
    const params = new URLSearchParams(serializeSearchState(nextState));
    if (!catalogReady) {
      const changedParams = new Set<string>(["page"]);
      for (const field of changedFields) for (const key of catalogQueryParamGroups[field] ?? []) changedParams.add(key);
      const currentParams = new URLSearchParams(window.location.search);
      for (const key of catalogQueryKeys) {
        if (changedParams.has(key)) continue;
        params.delete(key);
        for (const value of currentParams.getAll(key)) params.append(key, value);
      }
    }
    const serialized = params.toString();
    const nextUrl = `${window.location.pathname}${serialized ? `?${serialized}` : ""}${window.location.hash}`;
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", nextUrl);
    window.dispatchEvent(new Event(SEARCH_STATE_EVENT));
  }, [catalogReady]);

  useEffect(() => {
    indexStatusRef.current = indexStatus;
  }, [indexStatus]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      indexAbortRef.current?.abort();
      indexAbortRef.current = null;
      indexRequestRef.current = null;
      indexStatusRef.current = "idle";
    };
  }, []);

  useEffect(() => {
    const syncRecognizedUrlQuery = () => setHasRecognizedUrlQuery(hasCatalogQuery(window.location.search));
    syncRecognizedUrlQuery();
    window.addEventListener("popstate", syncRecognizedUrlQuery);
    window.addEventListener(SEARCH_STATE_EVENT, syncRecognizedUrlQuery);
    return () => {
      window.removeEventListener("popstate", syncRecognizedUrlQuery);
      window.removeEventListener(SEARCH_STATE_EVENT, syncRecognizedUrlQuery);
    };
  }, []);

  useEffect(() => {
    if (hasCatalogQuery(window.location.search) || !("IntersectionObserver" in window)) {
      loadCatalogIndex();
      return;
    }
    const target = catalogBrowserRef.current;
    if (!target) {
      loadCatalogIndex();
      return;
    }
    try {
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        loadCatalogIndex();
      }, { rootMargin: "800px 0px" });
      observer.observe(target);
      return () => observer.disconnect();
    } catch {
      loadCatalogIndex();
    }
  }, [loadCatalogIndex]);

  useEffect(() => {
    if (!loadedRecords) return;
    const syncFromUrl = () => {
      const nextState = searchStateFromUrl(loadedRecords, new URLSearchParams(window.location.search));
      setState(nextState);
      if (window.location.search !== serializeSearchState(nextState)) syncUrl(nextState, "replace");
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [loadedRecords, syncUrl]);

  useEffect(() => {
    if (catalogReady) return;
    const syncPendingState = () => setState(parseSearchState(new URLSearchParams(window.location.search), options));
    syncPendingState();
    window.addEventListener("popstate", syncPendingState);
    window.addEventListener(SEARCH_STATE_EVENT, syncPendingState);
    return () => {
      window.removeEventListener("popstate", syncPendingState);
      window.removeEventListener(SEARCH_STATE_EVENT, syncPendingState);
    };
  }, [catalogReady, options]);

  function updateState(patch: Partial<CatalogSearchState>, mode: "push" | "replace" = "push") {
    const nextState = { ...state, ...patch, page: 1 };
    setState(nextState);
    syncUrl(nextState, mode, [...Object.keys(patch), "page"]);
  }

  function updateQuery(value: string) {
    updateState({ q: value }, "replace");
  }

  function updateFacet(field: "platform" | "genre", value: string, checked: boolean) {
    const nextValues = new Set(selectedValues(state[field]));
    if (!catalogReady) {
      for (const rawValue of new URLSearchParams(window.location.search).getAll(field).flatMap((raw) => raw.split(","))) nextValues.add(rawValue.trim());
    }
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

  function retryCatalogIndex() {
    loadCatalogIndex(true);
  }

  function updatePage(nextPage: number) {
    const nextState = { ...state, page: nextPage };
    setState(nextState);
    syncUrl(nextState, "push", ["page"]);
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
    syncUrl(nextState, "push", ["columns"]);
  }

  function updateImages(images: CatalogImageMode) {
    const nextState = { ...state, images };
    setState(nextState);
    syncUrl(nextState, "push", ["images"]);
  }

  function clearFilters() {
    const nextState = clearCatalogFilters(state);
    setState(nextState);
    syncUrl(nextState, "push", [...catalogQueryKeys]);
  }

  const displayRecords = hydrated && loadedRecords ? page.records : initialRecords;
  const resultPositionOffset = hydrated && catalogReady ? page.startIndex : 0;
  const resultPositionTotal = catalogReady ? filteredRecords.length : catalogEntryCount;
  const resultSummary = !hydrated
    ? `Showing 1–${initialRecords.length} of ${catalogEntryCount} catalog games.`
      : !catalogReady
        ? indexStatus === "error" ? `Showing the first ${initialRecords.length} of ${catalogEntryCount} catalog games.` : indexStatus === "idle" ? `Showing the first ${initialRecords.length} of ${catalogEntryCount} catalog games. Browse or use filters to load the full catalog.` : `Loading ${catalogEntryCount} catalog games.`
        : filteredRecords.length > 0 ? `Showing ${page.startIndex + 1}–${page.endIndex} of ${filteredRecords.length} matching games.` : "Showing 0 matching games.";
  const indexStatusMessage = indexStatus === "loading"
    ? "Loading the full catalog. Filter changes will apply when it is ready."
    : indexStatus === "error"
      ? "The full catalog could not load. Filter changes are queued until you retry."
      : `Showing a ${initialRecords.length}-card preview. Browse or use filters to load all ${catalogEntryCount} games.`;

  return <div className="catalog-browser" ref={catalogBrowserRef} data-catalog-index-status={indexStatus} onFocusCapture={() => loadCatalogIndex()} onPointerDownCapture={() => loadCatalogIndex()} onKeyDownCapture={() => loadCatalogIndex()}>
    <form className="browser-panel" id="catalog-search" role="search" aria-label="Catalog search and filters" onSubmit={(event) => event.preventDefault()}>
      <div className="browser-panel-heading">
        <div><p className="eyebrow">Find your next favorite</p><h3>Filter the atlas. <span className="browser-panel-count">{catalogReady ? filteredRecords.length : catalogEntryCount} games</span></h3></div>
        <div className="browser-panel-status"><span>{activeFilterCount ? `${activeFilterCount} active` : pendingFilterQuery ? "Pending filters" : "All picks"}</span>{hasVisibleFilters ? <button className="browser-button browser-button--clear" type="button" onClick={clearFilters}>Clear all</button> : null}</div>
      </div>
      <div className="browser-controls">
        <label className="browser-field browser-field--query" htmlFor="catalog-query"><span>Search games</span><span className="browser-input"><span className="field-icon" aria-hidden="true">⌕</span><input id="catalog-query" type="search" value={state.q} onChange={(event) => updateQuery(event.target.value)} placeholder="Title, person, platform, or keyword" /></span></label>
        <label className="browser-field" htmlFor="catalog-sort"><span>Sort by</span><select id="catalog-sort" value={state.sort ?? "relevance"} onChange={(event) => updateSort(event.target.value)}><option value="score" disabled>Score (licensed data only)</option>{CATALOG_SORT_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
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
        <label className="browser-field browser-facet-field" htmlFor="catalog-year-from"><span>From first release</span><select id="catalog-year-from" value={yearFrom} onChange={(event) => updateYear("yearFrom", event.target.value)}><option value="">Any year</option>{yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
        <label className="browser-field browser-facet-field" htmlFor="catalog-year-to"><span>To first release</span><select id="catalog-year-to" value={yearTo} onChange={(event) => updateYear("yearTo", event.target.value)}><option value="">Any year</option>{yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
        <details className="browser-disclosure browser-disclosure--advanced">
          <summary>More filters <span>{state.developer || state.publisher ? "Active" : "Optional"}</span></summary>
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
              <input type="radio" name="card-columns" value={option.value} aria-label={option.accessibleLabel} checked={state.columns === option.value} onChange={() => updateColumns(option.value)} />
              <span className="layout-option-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
            </label>)}
          </div>
        </fieldset>
        <fieldset className="layout-control layout-control--images">
          <legend>Images</legend>
          <div className="layout-options" role="radiogroup" aria-label="Choose card images">
            <label className={`layout-option${state.images !== "hide" ? " layout-option--active" : ""}`}>
              <input type="radio" name="card-images" value="show" aria-label="Show card images" checked={state.images !== "hide"} onChange={() => updateImages("show")} />
              <span className="layout-option-copy"><strong>On</strong><small>Visual</small></span>
            </label>
            <label className={`layout-option${state.images === "hide" ? " layout-option--active" : ""}`}>
              <input type="radio" name="card-images" value="hide" aria-label="Hide card images" checked={state.images === "hide"} onChange={() => updateImages("hide")} />
              <span className="layout-option-copy"><strong>Off</strong><small>Compact</small></span>
            </label>
          </div>
        </fieldset>
        <p className="layout-mobile-note">Single-column layout on smaller screens.</p>
      </div>
      {activeFilterCount > 0 ? <div className="browser-filter-summary" aria-label="Active filters">
        {state.q ? <button type="button" className="filter-chip" aria-label={`Remove search filter: ${state.q}`} onClick={() => updateQuery("")}>Search: {state.q} <span aria-hidden="true">×</span></button> : null}
        {platformOptions.filter((option) => platforms.includes(option.id)).map((option) => <button type="button" className="filter-chip" aria-label={`Remove platform filter: ${option.label}`} key={`platform-${option.id}`} onClick={() => updateFacet("platform", option.id, false)}>{option.label} <span aria-hidden="true">×</span></button>)}
        {genreOptions.filter((option) => genres.includes(option.id)).map((option) => <button type="button" className="filter-chip" aria-label={`Remove genre filter: ${option.label}`} key={`genre-${option.id}`} onClick={() => updateFacet("genre", option.id, false)}>{option.label} <span aria-hidden="true">×</span></button>)}
        {yearFrom || yearTo ? <button type="button" className="filter-chip" aria-label={`Remove year filter: ${yearFrom || "Any"}–${yearTo || "Any"}`} onClick={() => updateState({ year: "", yearFrom: "", yearTo: "" })}>Years: {yearFrom || "Any"}–{yearTo || "Any"} <span aria-hidden="true">×</span></button> : null}
        {state.developer ? <button type="button" className="filter-chip" aria-label={`Remove developer filter: ${developerLabel}`} onClick={() => updateAdvancedFilter("developer", "")}>Dev: {developerLabel} <span aria-hidden="true">×</span></button> : null}
        {state.publisher ? <button type="button" className="filter-chip" aria-label={`Remove publisher filter: ${publisherLabel}`} onClick={() => updateAdvancedFilter("publisher", "")}>Pub: {publisherLabel} <span aria-hidden="true">×</span></button> : null}
      </div> : null}
      <p className="visually-hidden">Updates apply instantly. Multiple platforms or genres broaden that facet. Years use each title&apos;s first documented release.</p>
    </form>
    {!catalogReady ? <div className={`catalog-index-status catalog-index-status--${indexStatus}`}><span role="status" aria-live="polite">{indexStatusMessage}</span>{indexStatus === "error" ? <button className="browser-button browser-button--retry" type="button" onClick={retryCatalogIndex}>Retry full catalog</button> : null}</div> : null}
    <div className="result-bar"><p className="result-summary" ref={resultSummaryRef} tabIndex={-1} aria-live={catalogReady ? "polite" : "off"}>{resultSummary}</p><div className="result-tools"><span className="result-detail">Signals kept separate</span><label className="page-size-field" htmlFor="catalog-page-size"><span>Cards</span><select id="catalog-page-size" value={state.pageSize ?? DEFAULT_PAGE_SIZE} onChange={(event) => updatePageSize(event.target.value)}>{PAGE_SIZE_OPTIONS.map((size) => <option value={size} key={size}>{size} / page</option>)}</select></label></div></div>
    {indexStatus === "error" ? <p className="catalog-index-error" role="status">The full catalog index could not load.{hasRecognizedUrlQuery ? " The filters in this link have not been applied." : ""} <button className="text-link" type="button" onClick={retryCatalogIndex}>Retry the full catalog</button> or <a href={catalogIndexHref}>browse every game instead.</a></p> : null}
    {!catalogReady || filteredRecords.length > 0 ? <CatalogCards records={displayRecords} basePath={basePath} columns={state.columns} showImages={state.images !== "hide"} showResultPosition resultPositionOffset={resultPositionOffset} resultPositionTotal={resultPositionTotal} /> : <div className="empty-state" role="status"><strong>No games match those filters.</strong><span>Try a broader title, platform, genre, year, developer, or publisher.</span><button className="text-link" type="button" onClick={clearFilters}>Clear the current search <span aria-hidden="true">↗</span></button></div>}
    {hydrated && catalogReady && page.pageCount > 1 ? <nav className="catalog-pagination" aria-label="Catalog pages"><button type="button" className="pagination-button" disabled={page.page === 1} onClick={() => updatePage(page.page - 1)}>Previous</button><div className="pagination-pages">{paginationItems.map((item) => item.type === "ellipsis" ? <span className="pagination-ellipsis" aria-hidden="true" key={`ellipsis-${item.before}-${item.after}`}>…</span> : <button type="button" className={`pagination-button${item.page === page.page ? " pagination-button--current" : ""}`} aria-current={item.page === page.page ? "page" : undefined} aria-label={`Go to page ${item.page}`} key={item.page} onClick={() => updatePage(item.page)}>{item.page}</button>)}</div><button type="button" className="pagination-button" disabled={page.page === page.pageCount} onClick={() => updatePage(page.page + 1)}>Next</button></nav> : null}
  </div>;
}

type CatalogSortValue = NonNullable<CatalogSearchState["sort"]>;
