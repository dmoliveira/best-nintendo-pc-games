export interface CatalogSearchRecord {
  slug: string;
  title: string;
  aliases: string[];
  emoji: string;
  artPath?: string;
  artAlt?: string;
  shortDescription: string;
  searchText: string;
  releaseYear: number;
  releaseFormat?: "cartridge" | "digital";
  platformIds: string[];
  platformLabels: string[];
  platformHubIds: string[];
  genreIds: string[];
  genreLabels: string[];
  genreHubIds: string[];
  evidenceKinds: string[];
  evidenceLabels: string[];
}

export interface CatalogSearchState {
  q: string;
  platform: string;
  genre: string;
  year: string;
}

export interface SearchStateOptions {
  platformIds: ReadonlySet<string>;
  genreIds: ReadonlySet<string>;
  years: ReadonlySet<string>;
}

export const EMPTY_SEARCH_STATE: CatalogSearchState = { q: "", platform: "", genre: "", year: "" };

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

function knownOrEmpty(value: string | null, known: ReadonlySet<string>): string {
  return value && known.has(value) ? value : "";
}

export function parseSearchState(params: URLSearchParams, options: SearchStateOptions): CatalogSearchState {
  const rawYear = params.get("year") ?? "";
  return {
    q: cleanQuery(params.get("q") ?? ""),
    platform: knownOrEmpty(params.get("platform"), options.platformIds),
    genre: knownOrEmpty(params.get("genre"), options.genreIds),
    year: /^\d{4}$/.test(rawYear) && options.years.has(rawYear) ? rawYear : "",
  };
}

export function serializeSearchState(state: CatalogSearchState): string {
  const params = new URLSearchParams();
  const q = cleanQuery(state.q);
  if (q) params.set("q", q);
  if (state.platform) params.set("platform", state.platform);
  if (state.genre) params.set("genre", state.genre);
  if (state.year) params.set("year", state.year);
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

export function filterCatalog(records: readonly CatalogSearchRecord[], state: CatalogSearchState): CatalogSearchRecord[] {
  const queryTokens = normalizeSearchText(state.q).split(" ").filter(Boolean);
  return records
    .filter((record) => {
      if (state.platform && !record.platformIds.includes(state.platform)) return false;
      if (state.genre && !record.genreIds.includes(state.genre)) return false;
      if (state.year && String(record.releaseYear) !== state.year) return false;
      return queryTokens.every((token) => record.searchText.includes(token));
    })
    .sort((left, right) => compareStable(left.title, right.title) || compareStable(left.slug, right.slug));
}
