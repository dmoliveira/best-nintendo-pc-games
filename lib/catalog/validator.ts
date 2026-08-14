import { parseCalendarKey } from "../date-policy.mjs";
import { isValidHttpsUrl } from "../url-policy.mjs";
import type {
  CatalogContext,
  CriticOrUserSignal,
  GameRecord,
  GameSignal,
  GenreRecord,
  PlatformRecord,
  SourcePolicy,
  ValidationIssue,
} from "./types";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_VERIFICATION = new Set(["verified", "unverified"]);
const VALID_RIGHTS = new Set(["approved", "outbound-only", "pending-review", "prohibited"]);
const BASE_SIGNAL_FIELDS = new Set(["kind", "sourceId", "sourceUrl", "capturedAt", "verificationStatus", "rightsStatus", "rightsReviewedAt", "recheckAt", "termsUrl", "reviewedBy", "provider", "label"]);
const KIND_FIELDS: Record<GameSignal["kind"], Set<string>> = {
  critic: new Set(["score", "scale", "scoreType", "count", "editionOrPlatform"]),
  user: new Set(["score", "scale", "scoreType", "count", "editionOrPlatform"]),
  sales: new Set(["value", "unit", "rank", "territory", "period", "asOf"]),
  popularity: new Set(["value", "rank", "methodVersion", "asOf"]),
  editorial: new Set(["rationale"]),
};
const SOURCE_FIELD_BY_KIND: Record<GameSignal["kind"], string> = {
  critic: "numericScore",
  user: "numericScore",
  sales: "manuallyReviewedSalesFact",
  popularity: "popularitySignal",
  editorial: "editorialRationale",
};

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateDate(value: unknown, path: string, context: CatalogContext, errors: ValidationIssue[], mode: "past-or-today" | "future-or-today" | "any") {
  const candidate = parseCalendarKey(value);
  if (!candidate) {
    errors.push(issue(path, "must be a valid YYYY-MM-DD calendar date"));
    return;
  }
  if (mode === "past-or-today" && candidate > context.todayKey) errors.push(issue(path, "must not be in the future"));
  if (mode === "future-or-today" && candidate < context.todayKey) errors.push(issue(path, "must be today or a future recheck date"));
}

function validateStringList(value: unknown, path: string, errors: ValidationIssue[], minimumLength = 1): value is string[] {
  if (!Array.isArray(value) || value.length < minimumLength || value.some((item) => !nonEmpty(item))) {
    errors.push(issue(path, `must contain at least ${minimumLength} non-empty string${minimumLength === 1 ? "" : "s"}`));
    return false;
  }
  return true;
}

function numericFieldPresent(signal: Record<string, unknown>): boolean {
  return ["score", "value", "rank", "count"].some((field) => field in signal);
}

function sourceAllowsSignal(source: SourcePolicy | undefined, signal: GameSignal): boolean {
  if (!source) return false;
  return source.allowedFields.includes(SOURCE_FIELD_BY_KIND[signal.kind]);
}

function validateBaseSignal(signal: GameSignal, path: string, context: CatalogContext, errors: ValidationIssue[]) {
  const record = signal as unknown as Record<string, unknown>;
  const source = context.sourceById.get(signal.sourceId);
  if (!source) errors.push(issue(`${path}.sourceId`, `unknown source ${signal.sourceId}`));
  if (!isValidHttpsUrl(signal.sourceUrl)) errors.push(issue(`${path}.sourceUrl`, "must be a valid https URL"));
  if (signal.termsUrl !== undefined && signal.termsUrl !== null && !isValidHttpsUrl(signal.termsUrl)) errors.push(issue(`${path}.termsUrl`, "must be a valid https URL when present"));
  if (!VALID_VERIFICATION.has(signal.verificationStatus)) errors.push(issue(`${path}.verificationStatus`, "unsupported verification status"));
  if (!VALID_RIGHTS.has(signal.rightsStatus)) errors.push(issue(`${path}.rightsStatus`, "unsupported rights status"));
  validateDate(signal.capturedAt, `${path}.capturedAt`, context, errors, "past-or-today");
  if (signal.rightsReviewedAt !== undefined) validateDate(signal.rightsReviewedAt, `${path}.rightsReviewedAt`, context, errors, "past-or-today");
  if (signal.recheckAt !== undefined && signal.recheckAt !== null) validateDate(signal.recheckAt, `${path}.recheckAt`, context, errors, "future-or-today");
  if (numericFieldPresent(record)) {
    if (signal.verificationStatus !== "verified") errors.push(issue(path, "numeric fields require verified facts"));
    if (signal.rightsStatus !== "approved") errors.push(issue(path, "numeric fields require approved rights"));
    if (source?.status !== "approved") errors.push(issue(path, "numeric fields require an approved source registry entry"));
    if (!sourceAllowsSignal(source, signal)) errors.push(issue(path, `source does not authorize ${signal.kind} fields`));
  }
  if (source?.status === "approved") {
    validateDate(source.rightsReviewedAt, `${path}.source.rightsReviewedAt`, context, errors, "past-or-today");
    if (!source.recheckAt) errors.push(issue(`${path}.source.recheckAt`, "approved source requires a recheck date"));
    else validateDate(source.recheckAt, `${path}.source.recheckAt`, context, errors, "future-or-today");
  }
  if (signal.rightsStatus === "approved") {
    if (!signal.rightsReviewedAt || !signal.recheckAt) errors.push(issue(path, "approved signals require rightsReviewedAt and recheckAt"));
    if (!nonEmpty(signal.reviewedBy)) errors.push(issue(path, "approved signals require reviewedBy"));
    if (source?.status !== "approved") errors.push(issue(path, "approved signal requires an approved source registry entry"));
    if (!sourceAllowsSignal(source, signal)) errors.push(issue(path, `source does not authorize ${signal.kind} fields`));
    if (source?.termsUrl && signal.termsUrl !== source.termsUrl) errors.push(issue(path, "signal termsUrl must match the source registry"));
  }
}

function validateKnownFields(signal: Record<string, unknown>, path: string, kind: GameSignal["kind"], errors: ValidationIssue[]) {
  const allowed = new Set([...BASE_SIGNAL_FIELDS, ...KIND_FIELDS[kind]]);
  for (const key of Object.keys(signal)) if (!allowed.has(key)) errors.push(issue(`${path}.${key}`, "unknown signal field for this signal kind"));
}

function validateNumericSignal(signal: CriticOrUserSignal, path: string, context: CatalogContext, errors: ValidationIssue[]) {
  validateBaseSignal(signal, path, context, errors);
  if (!nonEmpty(signal.provider) || !nonEmpty(signal.label) || !nonEmpty(signal.scoreType)) errors.push(issue(path, "numeric signals require provider, label, and scoreType"));
  if (!Number.isFinite(signal.score) || !Number.isFinite(signal.scale) || signal.scale <= 0 || signal.score < 0 || signal.score > signal.scale) errors.push(issue(path, "score must be within its declared scale"));
  if (signal.count !== undefined && (!Number.isInteger(signal.count) || signal.count < 0)) errors.push(issue(`${path}.count`, "must be a non-negative integer"));
  if (signal.kind === "critic" && signal.rightsStatus === "approved" && !context.approvedCriticProviders.has(signal.provider)) errors.push(issue(path, `critic provider ${signal.provider} is not authorized`));
  const source = context.sourceById.get(signal.sourceId);
  if (source && source.provider !== signal.provider) errors.push(issue(`${path}.provider`, "must match the source registry provider"));
}

export function normalizeCatalogKey(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export interface CatalogIdentityRecord {
  file: string;
  slug: string;
  title: string;
  aliases: string[];
}

export function findDuplicateRecordIds(records: unknown[], field: string): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const record of records) {
    if (!record || typeof record !== "object" || Array.isArray(record)) continue;
    const value = (record as Record<string, unknown>)[field];
    if (!nonEmpty(value)) continue;
    if (seen.has(value)) duplicates.add(value);
    else seen.add(value);
  }
  return [...duplicates];
}

export function findCatalogIdentityCollisions(records: CatalogIdentityRecord[]): string[] {
  const namespace = new Map<string, { owner: string; field: string }>();
  const collisions: string[] = [];
  const register = (value: string, owner: string, field: string, file: string) => {
    const key = normalizeCatalogKey(value);
    if (!key) return;
    const previous = namespace.get(key);
    const sameCanonical = previous && previous.owner === owner && ((field === "title" && previous.field === "slug") || (field === "slug" && previous.field === "title"));
    if (previous && !sameCanonical) collisions.push(`${file}: catalog name/alias ${JSON.stringify(value)} collides with ${previous.owner}`);
    else if (!previous) namespace.set(key, { owner, field });
  };
  for (const record of records) {
    register(record.slug, record.slug, "slug", record.file);
    register(record.title, record.slug, "title", record.file);
    for (const alias of record.aliases) register(alias, record.slug, "alias", record.file);
  }
  return collisions;
}

export function isEligibleCritic80(signal: GameSignal, context: CatalogContext): boolean {
  if (signal.kind !== "critic") return false;
  if (validateSignal(signal, "signal", context).length > 0) return false;
  const source = context.sourceById.get(signal.sourceId);
  return signal.score >= context.criticMinimumScore && signal.scale === context.criticRequiredScale && signal.verificationStatus === "verified" && signal.rightsStatus === "approved" && context.approvedCriticProviders.has(signal.provider) && nonEmpty(signal.editionOrPlatform) && nonEmpty(signal.termsUrl) && nonEmpty(signal.reviewedBy) && source?.provider === signal.provider;
}

export function validateSignal(signal: unknown, path: string, context: CatalogContext): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  if (!signal || typeof signal !== "object" || !("kind" in signal)) return [issue(path, "must be a signal object")];
  const record = signal as Record<string, unknown>;
  const kind = record.kind;
  if (typeof kind !== "string" || !KIND_FIELDS[kind as GameSignal["kind"]]) return [issue(`${path}.kind`, "unsupported signal kind")];
  validateKnownFields(record, path, kind as GameSignal["kind"], errors);
  const typed = signal as GameSignal;
  validateBaseSignal(typed, path, context, errors);
  if (!nonEmpty(typed.provider) || !nonEmpty(typed.label)) errors.push(issue(path, "signals require provider and label"));
  if (typed.kind === "critic" || typed.kind === "user") validateNumericSignal(typed, path, context, errors);
  if (typed.kind === "sales") {
    if ((typed.value === undefined || !Number.isFinite(typed.value)) && (typed.rank === undefined || !Number.isInteger(typed.rank))) errors.push(issue(path, "sales signals require value or rank"));
    if ("value" in (typed as unknown as Record<string, unknown>) && !Number.isFinite(typed.value)) errors.push(issue(`${path}.value`, "must be a finite number when present"));
    if (typed.value !== undefined && typeof typed.value === "number" && typed.value < 0) errors.push(issue(`${path}.value`, "must be non-negative"));
    if (typed.value !== undefined && !nonEmpty(typed.unit)) errors.push(issue(`${path}.unit`, "is required when sales value is present"));
    if (typed.rank !== undefined && (!Number.isInteger(typed.rank) || typed.rank < 1)) errors.push(issue(`${path}.rank`, "must be a positive integer"));
    if (!nonEmpty(typed.territory) || !nonEmpty(typed.period)) errors.push(issue(path, "sales signals require territory and period"));
    validateDate(typed.asOf, `${path}.asOf`, context, errors, "past-or-today");
  }
  if (typed.kind === "popularity") {
    if ((typed.value === undefined || !Number.isFinite(typed.value)) && (typed.rank === undefined || !Number.isInteger(typed.rank))) errors.push(issue(path, "popularity signals require value or rank"));
    if ("value" in (typed as unknown as Record<string, unknown>) && !Number.isFinite(typed.value)) errors.push(issue(`${path}.value`, "must be a finite number when present"));
    if (typed.value !== undefined && typeof typed.value === "number" && typed.value < 0) errors.push(issue(`${path}.value`, "must be non-negative"));
    if (typed.rank !== undefined && (!Number.isInteger(typed.rank) || typed.rank < 1)) errors.push(issue(`${path}.rank`, "must be a positive integer"));
    if (!nonEmpty(typed.methodVersion)) errors.push(issue(`${path}.methodVersion`, "is required"));
    validateDate(typed.asOf, `${path}.asOf`, context, errors, "past-or-today");
  }
  if (typed.kind === "editorial") {
    if (typed.provider !== "GameAtlas") errors.push(issue(`${path}.provider`, "editorial provider must be GameAtlas"));
    if (!nonEmpty(typed.rationale)) errors.push(issue(`${path}.rationale`, "is required"));
  }
  return errors;
}

export function validateGameRecord(record: unknown, path: string, context: CatalogContext): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  if (!record || typeof record !== "object") return [issue(path, "must be an object")];
  const game = record as Partial<GameRecord>;
  if (game.schemaVersion !== 1) errors.push(issue(`${path}.schemaVersion`, "must be 1"));
  if (!nonEmpty(game.slug) || !SLUG.test(game.slug)) errors.push(issue(`${path}.slug`, "must be a kebab-case slug"));
  for (const field of ["title", "shortDescription", "emoji"] as const) if (!nonEmpty(game[field])) errors.push(issue(`${path}.${field}`, "must be non-empty"));
  validateStringList(game.aliases, `${path}.aliases`, errors, 0);
  validateStringList(game.highlights, `${path}.highlights`, errors);
  validateStringList(game.keywords, `${path}.keywords`, errors);
  validateStringList(game.platforms, `${path}.platforms`, errors);
  validateStringList(game.genres, `${path}.genres`, errors);
  validateStringList(game.sources, `${path}.sources`, errors);
  for (const platform of game.platforms ?? []) if (!context.platformIds.has(platform)) errors.push(issue(`${path}.platforms`, `unknown platform ${platform}`));
  for (const genre of game.genres ?? []) if (!context.genreIds.has(genre)) errors.push(issue(`${path}.genres`, `unknown genre ${genre}`));
  for (const source of game.sources ?? []) if (!context.sourceById.has(source)) errors.push(issue(`${path}.sources`, `unknown source ${source}`));
  if (!game.release || !Number.isInteger(game.release.year) || game.release.year < 1950 || game.release.year > 2100) errors.push(issue(`${path}.release.year`, "must be an integer year from 1950 to 2100"));
  if (game.release?.date) validateDate(game.release.date, `${path}.release.date`, context, errors, "any");
  if (!Array.isArray(game.signals)) errors.push(issue(`${path}.signals`, "must be an array"));
  else game.signals.forEach((signal, index) => errors.push(...validateSignal(signal, `${path}.signals[${index}]`, context)));
  if (!Array.isArray(game.links) || game.links.length < 1) errors.push(issue(`${path}.links`, "must contain at least one official or reference link"));
  else {
    if (!game.links.some((link) => link.kind === "official" || link.kind === "reference")) errors.push(issue(`${path}.links`, "must contain an official or reference link"));
    game.links.forEach((link, index) => { if (!link || !nonEmpty(link.label) || !isValidHttpsUrl(link.url) || !["official", "store", "critical", "community", "reference"].includes(link.kind)) errors.push(issue(`${path}.links[${index}]`, "requires label, valid https URL, and supported kind")); });
  }
  if (!Array.isArray(game.assets)) errors.push(issue(`${path}.assets`, "must be an array"));
  else game.assets.forEach((asset, index) => { const known = asset && context.assetById.get(asset.provenanceId); if (!known || known.path !== asset.path) errors.push(issue(`${path}.assets[${index}]`, "asset provenance does not match the approved manifest")); if (!nonEmpty(asset.alt)) errors.push(issue(`${path}.assets[${index}].alt`, "must be non-empty")); });
  return errors;
}

export function validatePlatformRecord(record: unknown, path: string): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const platform = record as Partial<PlatformRecord>;
  if (platform.schemaVersion !== 1 || !nonEmpty(platform.id) || !SLUG.test(platform.id)) errors.push(issue(path, "invalid platform schema/id"));
  if (!nonEmpty(platform.name) || !["nintendo", "pc"].includes(platform.family ?? "") || !nonEmpty(platform.emoji) || !nonEmpty(platform.description)) errors.push(issue(path, "platform requires name, family, emoji, and description"));
  if (!Array.isArray(platform.aliases) || platform.aliases.some((alias) => !nonEmpty(alias))) errors.push(issue(`${path}.aliases`, "must be a string array"));
  if (!["planned", "partial", "populated"].includes(platform.coverage ?? "")) errors.push(issue(`${path}.coverage`, "unsupported coverage status"));
  return errors;
}

export function validateGenreRecord(record: unknown, path: string): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const genre = record as Partial<GenreRecord>;
  if (genre.schemaVersion !== 1 || !nonEmpty(genre.id) || !SLUG.test(genre.id) || !nonEmpty(genre.name) || !nonEmpty(genre.description)) errors.push(issue(path, "invalid genre schema/id/name/description"));
  if (!Array.isArray(genre.aliases) || genre.aliases.some((alias) => !nonEmpty(alias))) errors.push(issue(`${path}.aliases`, "must be a string array"));
  return errors;
}
