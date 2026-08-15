export interface CatalogCardLink {
  label: string;
  url: string;
}

export interface CatalogCriticSummary {
  label: "Critic score";
  display: string;
  detail: string;
  provider: string;
  url: string;
}

export interface CatalogSalesSummary {
  label: "Reported sales";
  display: string;
  detail: string;
  provider: string;
  url: string;
}

export interface CatalogPackageThumbnail {
  formatId: string;
  kind: "digital" | "physical";
  aspectRatio: number;
  depthRatio: number;
  frontPath?: string;
  frontAlt?: string;
}
}

export type CatalogColumns = "auto" | "1" | "2" | "3";

export interface CatalogSearchRecord {
  slug: string;
  title: string;
  aliases: string[];
  emoji: string;
  artPath?: string;
  artAlt?: string;
  packageThumbnail: CatalogPackageThumbnail;
  developer?: string;
  publisher?: string;
  editorialLabel?: string;
  criticalLink?: CatalogCardLink;
  criticSummary?: CatalogCriticSummary;
  salesSummary?: CatalogSalesSummary;
  shortDescription: string;
  searchText: string;
  releaseYear: number;
  releaseDate?: string;
  releaseFormat?: "cartridge" | "digital";
  platformIds: string[];
  platformLabels: string[];
  platformDisplayLabels: string[];
  platformHubIds: string[];
  genreIds: string[];
  genreLabels: string[];
  genreHubIds: string[];
  evidenceKinds: string[];
  evidenceLabels: string[];
}

export type CatalogSort = "relevance" | "newest" | "oldest" | "platform" | "title";

export interface CatalogSearchState {
  q: string;
  platform: string;
  genre: string;
  year: string;
  columns?: CatalogColumns;
  yearFrom?: string;
  yearTo?: string;
  developer?: string;
  publisher?: string;
  sort?: CatalogSort;
  page?: number;
  pageSize?: CatalogPageSize;
}

export interface SearchStateOptions {
  platformIds: ReadonlySet<string>;
  genreIds: ReadonlySet<string>;
  years: ReadonlySet<string>;
  developerValues?: ReadonlySet<string>;
  publisherValues?: ReadonlySet<string>;
  yearMin?: number;
  yearMax?: number;
}

export const DEFAULT_PAGE_SIZE = 24;
export const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
export type CatalogPageSize = typeof PAGE_SIZE_OPTIONS[number];

export const CATALOG_SORT_OPTIONS: ReadonlyArray<{ value: CatalogSort; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest release" },
  { value: "oldest", label: "Oldest release" },
  { value: "platform", label: "Platform" },
  { value: "title", label: "Title A–Z" },
];

export const EMPTY_SEARCH_STATE: CatalogSearchState = {
  q: "",
  platform: "",
  genre: "",
  year: "",
  columns: "auto",
  yearFrom: "",
  yearTo: "",
  developer: "",
  publisher: "",
  sort: "relevance",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};
export const SEARCH_STATE_EVENT = "gameatlas:search-state";

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function knownOrEmpty(value: string | null, known: ReadonlySet<string> | undefined, normalize = false): string {
  if (!value || !known) return "";
  const candidate = normalize ? normalizeSearchText(value) : value.trim();
  return known.has(candidate) ? candidate : "";
}

function readKnownList(params: URLSearchParams, key: string, known: ReadonlySet<string>): string {
  const values = params.getAll(key).flatMap((value) => value.split(",")).map((value) => value.trim()).filter((value) => known.has(value));
  return [...new Set(values)].sort(compareStable).join(",");
}

function splitList(value: string | undefined): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function isCatalogSort(value: string | null): value is CatalogSort {
  return CATALOG_SORT_OPTIONS.some((option) => option.value === value);
}

function isPageSize(value: number): value is CatalogPageSize {
  return PAGE_SIZE_OPTIONS.includes(value as CatalogPageSize);
}

function availableYearBounds(options: SearchStateOptions): { min: number; max: number } | undefined {
  const years = [...options.years].map(Number).filter(Number.isInteger);
  if (years.length === 0) return undefined;
  return { min: options.yearMin ?? Math.min(...years), max: options.yearMax ?? Math.max(...years) };
}

function parseYear(value: string | null, options: SearchStateOptions, allowRange: boolean): string {
  if (!value || !/^\d{4}$/.test(value)) return "";
  const year = Number(value);
  if (!allowRange && !options.years.has(value)) return "";
  const bounds = availableYearBounds(options);
  return !allowRange || !bounds || (year >= bounds.min && year <= bounds.max) ? value : "";
}

export function parseSearchState(params: URLSearchParams, options: SearchStateOptions): CatalogSearchState {
  const legacyYear = parseYear(params.get("year"), options, false);
  let yearFrom = parseYear(params.get("from"), options, true);
  let yearTo = parseYear(params.get("to"), options, true);
  if (yearFrom && yearTo && Number(yearFrom) > Number(yearTo)) [yearFrom, yearTo] = [yearTo, yearFrom];
  const hasRange = Boolean(yearFrom || yearTo);
  const rawColumns = params.get("columns");
  const columns: CatalogColumns = rawColumns === "1" || rawColumns === "2" || rawColumns === "3" ? rawColumns : "auto";
  return {
    q: cleanQuery(params.get("q") ?? ""),
    platform: readKnownList(params, "platform", options.platformIds),
    genre: readKnownList(params, "genre", options.genreIds),
    year: hasRange ? "" : legacyYear,
    columns,
    yearFrom,
    yearTo,
    developer: knownOrEmpty(params.get("developer"), options.developerValues, true),
    publisher: knownOrEmpty(params.get("publisher"), options.publisherValues, true),
    sort: isCatalogSort(params.get("sort")) ? params.get("sort") as CatalogSort : "relevance",
    page: parsePositiveInteger(params.get("page"), 1),
    pageSize: parsePageSize(params.get("perPage"), DEFAULT_PAGE_SIZE),
  };
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null, fallback: CatalogPageSize): CatalogPageSize {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && isPageSize(parsed) ? parsed : fallback;
}

export function serializeSearchState(state: CatalogSearchState): string {
  const params = new URLSearchParams();
  const q = cleanQuery(state.q);
  if (q) params.set("q", q);
  const platform = [...new Set(splitList(state.platform))].sort(compareStable).join(",");
  const genre = [...new Set(splitList(state.genre))].sort(compareStable).join(",");
  if (platform) params.set("platform", platform);
  if (genre) params.set("genre", genre);
  const year = state.year || "";
  const yearFrom = state.yearFrom ?? "";
  const yearTo = state.yearTo ?? "";
  if (year) params.set("year", year);
  else if (yearFrom || yearTo) {
    if (yearFrom && yearFrom === yearTo) params.set("year", yearFrom);
    else {
      if (yearFrom) params.set("from", yearFrom);
      if (yearTo) params.set("to", yearTo);
    }
  }
  if (state.developer) params.set("developer", normalizeSearchText(state.developer));
  if (state.publisher) params.set("publisher", normalizeSearchText(state.publisher));
  if (state.sort && state.sort !== "relevance" && isCatalogSort(state.sort)) params.set("sort", state.sort);
  if (state.page && Number.isSafeInteger(state.page) && state.page > 1) params.set("page", String(state.page));
  if (state.pageSize && isPageSize(state.pageSize) && state.pageSize !== DEFAULT_PAGE_SIZE) params.set("perPage", String(state.pageSize));
  if (state.columns && state.columns !== "auto") params.set("columns", state.columns);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function compareStable(left: string, right: string): number {
  const normalizedLeft = normalizeSearchText(left);
  const normalizedRight = normalizeSearchText(right);
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
}

function compareNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function releaseSortKey(record: CatalogSearchRecord): string {
  return record.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(record.releaseDate)
    ? record.releaseDate
    : `${String(record.releaseYear).padStart(4, "0")}-01-01`;
}

function platformSortKey(record: CatalogSearchRecord): string {
  return record.platformDisplayLabels.map(normalizeSearchText).sort()[0] ?? "";
}

function relevanceScore(record: CatalogSearchRecord, query: string, tokens: readonly string[]): number {
  const title = normalizeSearchText(record.title);
  const aliases = record.aliases.map(normalizeSearchText);
  let score = title === query ? 1000 : title.startsWith(query) ? 800 : title.includes(query) ? 600 : 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 120;
    if (aliases.some((alias) => alias.includes(token))) score += 80;
    if (record.searchText.includes(token)) score += 10;
  }
  return score;
}

function compareBySort(left: CatalogSearchRecord, right: CatalogSearchRecord, state: CatalogSearchState, query: string, queryTokens: readonly string[]): number {
  const sort = state.sort ?? "relevance";
  let comparison = 0;
  if (sort === "relevance") comparison = query ? compareNumber(relevanceScore(right, query, queryTokens), relevanceScore(left, query, queryTokens)) : 0;
  else if (sort === "newest") comparison = compareStable(releaseSortKey(right), releaseSortKey(left));
  else if (sort === "oldest") comparison = compareStable(releaseSortKey(left), releaseSortKey(right));
  else if (sort === "platform") comparison = compareStable(platformSortKey(left), platformSortKey(right));
  else if (sort === "title") comparison = compareStable(left.title, right.title);
  return comparison || compareStable(left.title, right.title) || compareStable(left.slug, right.slug);
}

export function filterCatalog(records: readonly CatalogSearchRecord[], state: CatalogSearchState): CatalogSearchRecord[] {
  const query = normalizeSearchText(state.q);
  const queryTokens = query.split(" ").filter(Boolean);
  const platforms = new Set(splitList(state.platform));
  const genres = new Set(splitList(state.genre));
  const yearFrom = state.yearFrom || state.year;
  const yearTo = state.yearTo || state.year;
  const developer = normalizeSearchText(state.developer ?? "");
  const publisher = normalizeSearchText(state.publisher ?? "");
  return records
    .filter((record) => {
      if (platforms.size > 0 && !record.platformIds.some((platform) => platforms.has(platform))) return false;
      if (genres.size > 0 && !record.genreIds.some((genre) => genres.has(genre))) return false;
      if (yearFrom && record.releaseYear < Number(yearFrom)) return false;
      if (yearTo && record.releaseYear > Number(yearTo)) return false;
      if (developer && normalizeSearchText(record.developer ?? "") !== developer) return false;
      if (publisher && normalizeSearchText(record.publisher ?? "") !== publisher) return false;
      return queryTokens.every((token) => record.searchText.includes(token));
    })
    .sort((left, right) => compareBySort(left, right, state, query, queryTokens));
}

export interface CatalogPage {
  records: CatalogSearchRecord[];
  page: number;
  pageSize: CatalogPageSize;
  pageCount: number;
  startIndex: number;
  endIndex: number;
}

export function paginateCatalog(records: readonly CatalogSearchRecord[], requestedPage = 1, requestedPageSize: number = DEFAULT_PAGE_SIZE): CatalogPage {
  const pageSize = isPageSize(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const page = Math.min(Math.max(Number.isSafeInteger(requestedPage) ? requestedPage : 1, 1), pageCount);
  const startIndex = records.length === 0 ? 0 : (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, records.length);
  return { records: records.slice(startIndex, endIndex), page, pageSize, pageCount, startIndex, endIndex };
}
