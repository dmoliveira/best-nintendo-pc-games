import fs from "node:fs";
import path from "node:path";
import { serializeCatalogSearchIndex } from "../lib/catalog/search-index";
import { getCatalogSearchRecords } from "../lib/catalog/site-data";

const root = process.cwd();
const records = getCatalogSearchRecords();
const expectedCount = 1000;

if (records.length !== expectedCount) throw new Error(`Catalog search index requires exactly ${expectedCount} records, found ${records.length}`);
const expected = serializeCatalogSearchIndex(records);
const check = process.argv.includes("--check");
const write = process.argv.includes("--write");
const outputArgumentIndex = process.argv.indexOf("--output");
const output = outputArgumentIndex === -1 ? undefined : process.argv[outputArgumentIndex + 1];
const targetPath = path.resolve(root, output ?? "public/catalog-search-index.json");

if ((check && write) || (!check && !write) || (outputArgumentIndex !== -1 && (!output || output.startsWith("--")))) {
  console.error("Usage: tsx scripts/generate-catalog-search-index.ts --check|--write [--output path]");
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
