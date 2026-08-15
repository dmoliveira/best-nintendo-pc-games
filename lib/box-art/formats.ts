import formatDocument from "../../data/box-art-formats.json";

export type BoxArtFormatKind = "digital" | "physical";
export type PackageGeometryBasis = "official-platform-exception" | "representative-estimate" | "retailer-reference" | "supplier-reference";
export type PackageGeometryConfidence = "low" | "medium" | "high";
export type PackageMaterial = "cardboard" | "digital" | "plastic-case" | "plastic-clamshell";
export type PackageOpeningSide = "left" | "none";

export interface PackageDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface BoxArtFormat {
  id: string;
  label: string;
  kind: BoxArtFormatKind;
  dimensions: PackageDimensions;
  image: { width: number; height: number };
  accent: "coral" | "cyan" | "lime" | "violet";
}

export interface PackageGeometrySource {
  id: string;
  title: string;
  sourceUrl: string | null;
  accessedAt: string;
  method: string;
}

export interface PlatformPackageProfile {
  id: string;
  formatId: string;
  kind: BoxArtFormatKind;
  category: string;
  material: PackageMaterial;
  openingSide: PackageOpeningSide;
  dimensions: PackageDimensions;
  sourceId: string;
  basis: PackageGeometryBasis;
  confidence: PackageGeometryConfidence;
  scope: string;
  caveat: string;
}

interface BoxArtFormatDocument {
  schemaVersion: 2;
  policy: string;
  geometryPolicy: string;
  geometrySources: PackageGeometrySource[];
  formats: BoxArtFormat[];
  platformFormatMap: Record<string, string>;
  platformPackageProfiles: Record<string, PlatformPackageProfile>;
}

export type PackageProfileResolution =
  | { status: "resolved"; platformId: string; format: BoxArtFormat; profile: PlatformPackageProfile }
  | { status: "unsupported"; reason: string };

const document = formatDocument as BoxArtFormatDocument;

export const BOX_ART_FORMATS = document.formats;
export const BOX_ART_FORMAT_IDS = new Set(BOX_ART_FORMATS.map((format) => format.id));
export const PLATFORM_BOX_ART_FORMATS = document.platformFormatMap;
export const PLATFORM_PACKAGE_PROFILES = document.platformPackageProfiles;
export const PACKAGE_GEOMETRY_SOURCES = document.geometrySources;

export function getBoxArtFormat(formatId: string): BoxArtFormat | undefined {
  return BOX_ART_FORMATS.find((format) => format.id === formatId);
}

export function getPlatformPackageProfile(platformId: string): PlatformPackageProfile | undefined {
  return PLATFORM_PACKAGE_PROFILES[platformId];
}

export function inferBoxArtFormat(platformIds: readonly string[]): BoxArtFormat | undefined {
  const candidates = new Set(platformIds.map((platformId) => PLATFORM_BOX_ART_FORMATS[platformId]).filter((formatId): formatId is string => Boolean(formatId)));
  return candidates.size === 1 ? getBoxArtFormat([...candidates][0]) : undefined;
}

export function resolvePackageProfile(platformIds: readonly string[], releaseFormat?: "cartridge" | "digital"): PackageProfileResolution {
  const uniquePlatformIds = [...new Set(platformIds)];
  if (uniquePlatformIds.length !== 1) return { status: "unsupported", reason: "package presentation requires exactly one platform" };
  const platformId = uniquePlatformIds[0];
  const profile = getPlatformPackageProfile(platformId);
  if (!profile) return { status: "unsupported", reason: `no package profile is configured for ${platformId}` };
  const format = getBoxArtFormat(profile.formatId);
  if (!format) return { status: "unsupported", reason: `package profile ${profile.id} references an unknown artwork format` };
  if (format.kind !== profile.kind) return { status: "unsupported", reason: `package profile ${profile.id} does not match artwork format kind` };
  if (profile.kind === "digital" && releaseFormat && releaseFormat !== "digital") return { status: "unsupported", reason: `digital package profile ${profile.id} requires digital distribution` };
  return { status: "resolved", platformId, profile, format };
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isCalendarDate(value: unknown): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validDimensions(value: unknown, kind: BoxArtFormatKind): value is PackageDimensions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const dimensions = value as Partial<PackageDimensions>;
  return Number.isFinite(dimensions.width) && Number.isFinite(dimensions.height) && Number.isFinite(dimensions.depth)
    && Number(dimensions.width) > 0 && Number(dimensions.height) > 0
    && (kind === "physical" ? Number(dimensions.depth) > 0 : Number(dimensions.depth) === 0);
}

export function validateBoxArtFormatDocument(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["data/box-art-formats.json: must be an object"];
  const candidate = value as Partial<BoxArtFormatDocument>;
  if (candidate.schemaVersion !== 2) errors.push("data/box-art-formats.json: schemaVersion must be 2");
  if (typeof candidate.policy !== "string" || candidate.policy.trim() === "") errors.push("data/box-art-formats.json: policy must be a non-empty string");
  if (typeof candidate.geometryPolicy !== "string" || candidate.geometryPolicy.trim() === "") errors.push("data/box-art-formats.json: geometryPolicy must be a non-empty string");

  const sourceById = new Map<string, PackageGeometrySource>();
  if (!Array.isArray(candidate.geometrySources) || candidate.geometrySources.length === 0) {
    errors.push("data/box-art-formats.json: geometrySources must be a non-empty array");
  } else {
    for (const [index, source] of candidate.geometrySources.entries()) {
      const location = `data/box-art-formats.json.geometrySources[${index}]`;
      if (!source || typeof source !== "object" || Array.isArray(source) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.id) || sourceById.has(source.id)) {
        errors.push(`${location}: requires a unique kebab-case id`);
        continue;
      }
      if (typeof source.title !== "string" || !source.title.trim() || (source.sourceUrl !== null && !isHttpsUrl(source.sourceUrl)) || !isCalendarDate(source.accessedAt) || typeof source.method !== "string" || !source.method.trim()) {
        errors.push(`${location}: requires title, nullable HTTPS sourceUrl, accessedAt, and method`);
        continue;
      }
      sourceById.set(source.id, source);
    }
  }

  const formatById = new Map<string, BoxArtFormat>();
  if (!Array.isArray(candidate.formats) || candidate.formats.length === 0) {
    errors.push("data/box-art-formats.json: formats must be a non-empty array");
  } else {
    for (const [index, format] of candidate.formats.entries()) {
      const location = `data/box-art-formats.json.formats[${index}]`;
      if (!format || typeof format !== "object" || Array.isArray(format)) {
        errors.push(`${location}: must be an object`);
        continue;
      }
      if (!format.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(format.id)) errors.push(`${location}.id: must be a kebab-case identifier`);
      else if (formatById.has(format.id)) errors.push(`${location}.id: duplicate format ${format.id}`);
      else formatById.set(format.id, format);
      if (!format.label || typeof format.label !== "string") errors.push(`${location}.label: must be a non-empty string`);
      if (format.kind !== "physical" && format.kind !== "digital") errors.push(`${location}.kind: must be physical or digital`);
      else if (!validDimensions(format.dimensions, format.kind)) errors.push(`${location}.dimensions: must contain positive width/height and physical positive or digital zero depth`);
      if (!format.image || !Number.isInteger(format.image.width) || !Number.isInteger(format.image.height) || format.image.width < 1 || format.image.height < 1) errors.push(`${location}.image: must contain positive integer dimensions`);
      if (!['coral', 'cyan', 'lime', 'violet'].includes(format.accent)) errors.push(`${location}.accent: must be a supported accent`);
    }
  }

  if (!candidate.platformFormatMap || typeof candidate.platformFormatMap !== "object" || Array.isArray(candidate.platformFormatMap)) {
    errors.push("data/box-art-formats.json: platformFormatMap must be an object");
  } else {
    for (const [platformId, formatId] of Object.entries(candidate.platformFormatMap)) if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(platformId) || typeof formatId !== "string" || !formatById.has(formatId)) errors.push(`data/box-art-formats.json.platformFormatMap.${platformId}: must reference a declared format`);
  }

  if (!candidate.platformPackageProfiles || typeof candidate.platformPackageProfiles !== "object" || Array.isArray(candidate.platformPackageProfiles)) {
    errors.push("data/box-art-formats.json: platformPackageProfiles must be an object");
  } else {
    const profileIds = new Set<string>();
    const platformIds = new Set(Object.keys(candidate.platformFormatMap ?? {}));
    const profilePlatformIds = Object.keys(candidate.platformPackageProfiles);
    for (const platformId of platformIds) if (!(platformId in candidate.platformPackageProfiles)) errors.push(`data/box-art-formats.json.platformPackageProfiles.${platformId}: missing profile`);
    for (const platformId of profilePlatformIds) {
      const profile = candidate.platformPackageProfiles[platformId];
      const location = `data/box-art-formats.json.platformPackageProfiles.${platformId}`;
      if (!platformIds.has(platformId)) errors.push(`${location}: references an unknown platform mapping`);
      if (!profile || typeof profile !== "object" || Array.isArray(profile) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profile.id) || profileIds.has(profile.id)) {
        errors.push(`${location}: requires a unique kebab-case id`);
        continue;
      }
      profileIds.add(profile.id);
      const format = formatById.get(profile.formatId);
      if (!format || candidate.platformFormatMap?.[platformId] !== profile.formatId) errors.push(`${location}.formatId: must match the platform artwork format mapping`);
      if (profile.kind !== "physical" && profile.kind !== "digital") errors.push(`${location}.kind: must be physical or digital`);
      else if (!validDimensions(profile.dimensions, profile.kind)) errors.push(`${location}.dimensions: must contain positive width/height and physical positive or digital zero depth`);
      if (format && profile.kind !== format.kind) errors.push(`${location}.kind: must match its artwork format kind`);
      if (typeof profile.category !== "string" || !profile.category.trim() || !['cardboard', 'digital', 'plastic-case', 'plastic-clamshell'].includes(profile.material) || !['left', 'none'].includes(profile.openingSide) || (profile.kind === 'physical' && profile.openingSide !== 'left') || (profile.kind === 'digital' && profile.openingSide !== 'none')) errors.push(`${location}: requires a safe category, material, and opening side`);
      if (!sourceById.has(profile.sourceId) || !['official-platform-exception', 'representative-estimate', 'retailer-reference', 'supplier-reference'].includes(profile.basis) || !['low', 'medium', 'high'].includes(profile.confidence) || typeof profile.scope !== 'string' || !profile.scope.trim() || typeof profile.caveat !== 'string' || !profile.caveat.trim()) errors.push(`${location}: requires source, basis, confidence, scope, and caveat`);
      const source = sourceById.get(profile.sourceId);
      if (profile.basis !== 'representative-estimate' && !source?.sourceUrl) errors.push(`${location}: non-estimate geometry requires a source URL`);
    }
  }
  return errors;
}
