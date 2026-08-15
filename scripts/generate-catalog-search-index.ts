import fs from "node:fs";
import path from "node:path";
import { serializeCatalogSearchIndex } from "../lib/catalog/search-index";
import { getCatalogSearchRecords } from "../lib/catalog/site-data";

const root = process.cwd();
const targetPath = path.join(root, "public/catalog-search-index.json");
const records = getCatalogSearchRecords();
const expectedCount = 1000;

if (records.length !== expectedCount) throw new Error(`Catalog search index requires exactly ${expectedCount} records, found ${records.length}`);
const expected = serializeCatalogSearchIndex(records);
const check = process.argv.includes("--check");
const write = process.argv.includes("--write");

if ((check && write) || (!check && !write)) {
  console.error("Usage: tsx scripts/generate-catalog-search-index.ts --check|--write");
  process.exit(1);
}

if (check) {
  if (!fs.existsSync(targetPath)) throw new Error("Catalog search index is missing");
  const actual = fs.readFileSync(targetPath, "utf8");
  if (actual !== expected) throw new Error("Catalog search index differs from the validated catalog projection");
  console.log(`Catalog search index check passed (${records.length} records).`);
} else {
  fs.writeFileSync(targetPath, expected);
  console.log(`Generated catalog search index (${records.length} records).`);
}
