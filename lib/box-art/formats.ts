import formatDocument from "../../data/box-art-formats.json";

export type BoxArtFormatKind = "digital" | "physical";

export interface BoxArtFormat {
  id: string;
  label: string;
  kind: BoxArtFormatKind;
  dimensions: { width: number; height: number; depth: number };
  image: { width: number; height: number };
  accent: "coral" | "cyan" | "lime" | "violet";
}

interface BoxArtFormatDocument {
  schemaVersion: number;
  policy: string;
  formats: BoxArtFormat[];
  platformFormatMap: Record<string, string>;
}

const document = formatDocument as BoxArtFormatDocument;

export const BOX_ART_FORMATS = document.formats;
export const BOX_ART_FORMAT_IDS = new Set(BOX_ART_FORMATS.map((format) => format.id));
export const PLATFORM_BOX_ART_FORMATS = document.platformFormatMap;

export function getBoxArtFormat(formatId: string): BoxArtFormat | undefined {
  return BOX_ART_FORMATS.find((format) => format.id === formatId);
}

export function inferBoxArtFormat(platformIds: readonly string[]): BoxArtFormat | undefined {
  const candidates = new Set(platformIds.map((platformId) => PLATFORM_BOX_ART_FORMATS[platformId]).filter((formatId): formatId is string => Boolean(formatId)));
  return candidates.size === 1 ? getBoxArtFormat([...candidates][0]) : undefined;
}

export function validateBoxArtFormatDocument(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["data/box-art-formats.json: must be an object"];
  const candidate = value as Partial<BoxArtFormatDocument>;
  if (candidate.schemaVersion !== 1) errors.push("data/box-art-formats.json: schemaVersion must be 1");
  if (typeof candidate.policy !== "string" || candidate.policy.trim() === "") errors.push("data/box-art-formats.json: policy must be a non-empty string");
  if (!Array.isArray(candidate.formats) || candidate.formats.length === 0) {
    errors.push("data/box-art-formats.json: formats must be a non-empty array");
  } else {
    const ids = new Set<string>();
    for (const [index, format] of candidate.formats.entries()) {
      const location = `data/box-art-formats.json.formats[${index}]`;
      if (!format || typeof format !== "object" || Array.isArray(format)) {
        errors.push(`${location}: must be an object`);
        continue;
      }
      if (!format.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(format.id)) errors.push(`${location}.id: must be a kebab-case identifier`);
      else if (ids.has(format.id)) errors.push(`${location}.id: duplicate format ${format.id}`);
      else ids.add(format.id);
      if (!format.label || typeof format.label !== "string") errors.push(`${location}.label: must be a non-empty string`);
      if (format.kind !== "physical" && format.kind !== "digital") errors.push(`${location}.kind: must be physical or digital`);
      if (!format.dimensions || !Number.isFinite(format.dimensions.width) || !Number.isFinite(format.dimensions.height) || !Number.isFinite(format.dimensions.depth) || format.dimensions.width <= 0 || format.dimensions.height <= 0 || format.dimensions.depth < 0) errors.push(`${location}.dimensions: must contain positive width/height and non-negative depth`);
      if (!format.image || !Number.isInteger(format.image.width) || !Number.isInteger(format.image.height) || format.image.width < 1 || format.image.height < 1) errors.push(`${location}.image: must contain positive integer dimensions`);
      if (!["coral", "cyan", "lime", "violet"].includes(format.accent)) errors.push(`${location}.accent: must be a supported accent`);
    }
  }
  if (!candidate.platformFormatMap || typeof candidate.platformFormatMap !== "object" || Array.isArray(candidate.platformFormatMap)) {
    errors.push("data/box-art-formats.json: platformFormatMap must be an object");
  } else {
    const formatIds = new Set((candidate.formats ?? []).map((format) => format.id));
    for (const [platformId, formatId] of Object.entries(candidate.platformFormatMap)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(platformId) || typeof formatId !== "string" || !formatIds.has(formatId)) errors.push(`data/box-art-formats.json.platformFormatMap.${platformId}: must reference a declared format`);
    }
  }
  return errors;
}
