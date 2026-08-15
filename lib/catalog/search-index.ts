import { createHash } from "node:crypto";
import type { CatalogSearchRecord } from "./search";

export const CATALOG_SEARCH_INDEX_SCHEMA_VERSION = 2;

export interface CatalogSearchIndexEnvelope {
  schemaVersion: typeof CATALOG_SEARCH_INDEX_SCHEMA_VERSION;
  recordCount: number;
  projectionDigest: string;
  records: readonly CatalogSearchRecord[];
}

function serializeRecords(records: readonly CatalogSearchRecord[]): string {
  return JSON.stringify(records);
}

export function getCatalogSearchIndexDigest(records: readonly CatalogSearchRecord[]): string {
  return `sha256:${createHash("sha256").update(serializeRecords(records)).digest("hex")}`;
}

export function createCatalogSearchIndexEnvelope(records: readonly CatalogSearchRecord[]): CatalogSearchIndexEnvelope {
  return {
    schemaVersion: CATALOG_SEARCH_INDEX_SCHEMA_VERSION,
    recordCount: records.length,
    projectionDigest: getCatalogSearchIndexDigest(records),
    records,
  };
}

export function serializeCatalogSearchIndex(records: readonly CatalogSearchRecord[]): string {
  return `${JSON.stringify(createCatalogSearchIndexEnvelope(records))}\n`;
}
