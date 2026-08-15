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

const catalogSearchRecordKeys = new Set([
  "slug", "title", "aliases", "emoji", "artPath", "artAlt", "packageThumbnail", "developer", "publisher", "editorialLabel", "criticalLink", "criticSummary", "salesSummary", "shortDescription", "searchText", "releaseYear", "releaseDate", "releaseFormat", "platformIds", "platformLabels", "platformDisplayLabels", "platformHubIds", "genreIds", "genreLabels", "genreHubIds", "evidenceKinds", "evidenceLabels",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maximumLength = 4096): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximumLength;
}

function isStringArray(value: unknown, minimumLength = 0): value is string[] {
  return Array.isArray(value) && value.length >= minimumLength && value.every((item) => isNonEmptyString(item));
}

function isSubset(values: readonly string[], candidates: readonly string[]): boolean {
  const allowed = new Set(candidates);
  return values.every((value) => allowed.has(value));
}

function hasNoDuplicateValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function isSafeCatalogArtPath(value: unknown, catalogIndexUrl: string): value is string | undefined {
  if (value === undefined) return true;
  if (!isNonEmptyString(value, 2048)) return false;
  try {
    const indexUrl = new URL(catalogIndexUrl, "https://gameatlas.invalid");
    const assetUrl = new URL(value, indexUrl);
    const basePath = indexUrl.pathname.replace(/\/catalog-search-index\.json$/, "");
    return assetUrl.origin === indexUrl.origin && assetUrl.pathname.startsWith(`${basePath}/assets/games/`) && assetUrl.pathname.endsWith(".svg") && !assetUrl.search && !assetUrl.hash;
  } catch {
    return false;
  }
}

function isSafeCriticalLink(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "label,url" || !isNonEmptyString(value.label, 256) || !isNonEmptyString(value.url, 2048)) return false;
  try {
    return new URL(value.url).protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeSignalSummary(value: unknown, label: "Critic score" | "Reported sales"): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "detail,display,label,provider,url" || value.label !== label || !isNonEmptyString(value.display, 128) || !isNonEmptyString(value.detail, 512) || !isNonEmptyString(value.provider, 256) || !isNonEmptyString(value.url, 2048)) return false;
  try {
    return new URL(value.url).protocol === "https:";
  } catch {
    return false;
  }
}

function isSafePackageThumbnail(value: unknown, catalogIndexUrl: string): boolean {
  if (!isRecord(value) || Object.keys(value).some((key) => !["formatId", "kind", "aspectRatio", "depthRatio", "frontPath", "frontAlt"].includes(key)) || !isNonEmptyString(value.formatId, 128) || (value.kind !== "digital" && value.kind !== "physical") || typeof value.aspectRatio !== "number" || !Number.isFinite(value.aspectRatio) || value.aspectRatio <= 0 || typeof value.depthRatio !== "number" || !Number.isFinite(value.depthRatio) || value.depthRatio < 0) return false;
  if (!isSafeCatalogArtPath(value.frontPath, catalogIndexUrl)) return false;
  return value.frontAlt === undefined || isNonEmptyString(value.frontAlt, 512);
}

function isCatalogSearchRecord(value: unknown, catalogIndexUrl: string): value is CatalogSearchRecord {
  if (!isRecord(value) || Object.keys(value).some((key) => !catalogSearchRecordKeys.has(key))) return false;
  if (!isNonEmptyString(value.slug, 160) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) || !isNonEmptyString(value.title, 512) || !isStringArray(value.aliases) || !isNonEmptyString(value.emoji, 32) || !isNonEmptyString(value.shortDescription, 2048) || !isNonEmptyString(value.searchText, 8192)) return false;
  if (value.artAlt !== undefined && !isNonEmptyString(value.artAlt, 512)) return false;
  if (value.developer !== undefined && !isNonEmptyString(value.developer, 512)) return false;
  if (value.publisher !== undefined && !isNonEmptyString(value.publisher, 512)) return false;
  if (value.editorialLabel !== undefined && !isNonEmptyString(value.editorialLabel, 128)) return false;
  if (!isSafeCatalogArtPath(value.artPath, catalogIndexUrl) || !isSafePackageThumbnail(value.packageThumbnail, catalogIndexUrl) || !isSafeCriticalLink(value.criticalLink) || !isSafeSignalSummary(value.criticSummary, "Critic score") || !isSafeSignalSummary(value.salesSummary, "Reported sales")) return false;
  const releaseYear = value.releaseYear;
  if (typeof releaseYear !== "number" || !Number.isInteger(releaseYear) || releaseYear < 1950 || releaseYear > 2100) return false;
  if (value.releaseDate !== undefined && (!isNonEmptyString(value.releaseDate, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(value.releaseDate))) return false;
  if (value.releaseFormat !== undefined && value.releaseFormat !== "cartridge" && value.releaseFormat !== "digital") return false;
  if (!isStringArray(value.platformIds, 1) || !isStringArray(value.platformLabels, 1) || !isStringArray(value.platformDisplayLabels, 1) || !isStringArray(value.genreIds, 1) || !isStringArray(value.genreLabels, 1)) return false;
  const platformIds = value.platformIds;
  const platformLabels = value.platformLabels;
  const platformDisplayLabels = value.platformDisplayLabels;
  const genreIds = value.genreIds;
  const genreLabels = value.genreLabels;
  if (platformIds.length !== platformLabels.length || platformIds.length !== platformDisplayLabels.length || genreIds.length !== genreLabels.length) return false;
  if (!isStringArray(value.platformHubIds) || !isStringArray(value.genreHubIds)) return false;
  const platformHubIds = value.platformHubIds;
  const genreHubIds = value.genreHubIds;
  if (!hasNoDuplicateValues(platformIds) || !hasNoDuplicateValues(genreIds) || !isSubset(platformHubIds, platformIds) || !isSubset(genreHubIds, genreIds)) return false;
  if (!isStringArray(value.evidenceKinds, 1) || !isStringArray(value.evidenceLabels, 1)) return false;
  if (value.evidenceKinds.length !== value.evidenceLabels.length) return false;
  return true;
}

async function digestCatalogSearchRecords(records: readonly CatalogSearchRecord[]): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const bytes = new TextEncoder().encode(JSON.stringify(records));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function parseCatalogSearchIndex(value: unknown, expectedCount: number, expectedDigest: string, catalogIndexUrl: string): Promise<CatalogSearchRecord[] | undefined> {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "projectionDigest,recordCount,records,schemaVersion" || value.schemaVersion !== 1 || value.recordCount !== expectedCount || value.projectionDigest !== expectedDigest || !/^sha256:[a-f0-9]{64}$/.test(expectedDigest) || !Array.isArray(value.records) || value.records.length !== expectedCount) return undefined;
  const slugs = new Set<string>();
  for (const record of value.records) {
    if (!isCatalogSearchRecord(record, catalogIndexUrl) || slugs.has(record.slug)) return undefined;
    slugs.add(record.slug);
  }
  const records = value.records as CatalogSearchRecord[];
  return await digestCatalogSearchRecords(records) === expectedDigest ? records : undefined;
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

export type CatalogPaginationItem =
  | { type: "page"; page: number }
  | { type: "ellipsis"; before: number; after: number };

export function getCatalogPaginationItems(rawPageCount: number, rawCurrentPage: number, neighborCount = 2): CatalogPaginationItem[] {
  const pageCount = Math.max(1, Number.isSafeInteger(rawPageCount) ? rawPageCount : 1);
  const currentPage = Math.min(Math.max(Number.isSafeInteger(rawCurrentPage) ? rawCurrentPage : 1, 1), pageCount);
  const radius = Math.max(0, Number.isSafeInteger(neighborCount) ? neighborCount : 2);
  const pages = new Set<number>([1, pageCount]);
  const nearStart = currentPage <= radius + 3;
  const nearEnd = currentPage >= pageCount - radius - 2;
  const start = nearStart ? 1 : Math.max(1, currentPage - radius);
  const end = nearEnd ? pageCount : Math.min(pageCount, currentPage + radius);
  for (let page = start; page <= end; page += 1) pages.add(page);
  if (nearStart) for (let page = 1; page <= Math.min(pageCount, radius * 2 + 3); page += 1) pages.add(page);
  if (nearEnd) for (let page = Math.max(1, pageCount - radius * 2 - 2); page <= pageCount; page += 1) pages.add(page);

  const items: CatalogPaginationItem[] = [];
  let previousPage: number | undefined;
  for (const page of [...pages].sort((left, right) => left - right)) {
    if (previousPage !== undefined && page - previousPage > 1) items.push({ type: "ellipsis", before: previousPage, after: page });
    items.push({ type: "page", page });
    previousPage = page;
  }
  return items;
}

export function paginateCatalog(records: readonly CatalogSearchRecord[], requestedPage = 1, requestedPageSize: number = DEFAULT_PAGE_SIZE): CatalogPage {
  const pageSize = isPageSize(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const page = Math.min(Math.max(Number.isSafeInteger(requestedPage) ? requestedPage : 1, 1), pageCount);
  const startIndex = records.length === 0 ? 0 : (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, records.length);
  return { records: records.slice(startIndex, endIndex), page, pageSize, pageCount, startIndex, endIndex };
}
