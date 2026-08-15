import fs from "node:fs";
import path from "node:path";

const fixedSources = [
  "README.md",
  "docs/rights-and-support-policy.md",
  "docs/guides/game-box-art-workflow.md",
  "data/platforms.json",
  "data/genres.json",
  "data/coverage.json",
  "data/source-rights.json",
  "data/assets-manifest.json",
  "data/box-art-formats.json",
];
const urlPattern = /https?:\/\/[^\s"'<>`]+/g;

function cleanUrl(value) {
  let cleaned = value.replace(/[.,;:]+$/, "");
  while (cleaned.endsWith(")") && (cleaned.match(/\(/g) ?? []).length < (cleaned.match(/\)/g) ?? []).length) cleaned = cleaned.slice(0, -1);
  while (cleaned.endsWith("]") && (cleaned.match(/\[/g) ?? []).length < (cleaned.match(/\]/g) ?? []).length) cleaned = cleaned.slice(0, -1);
  return cleaned;
}

function sourceFiles(root) {
  const gameDirectory = path.join(root, "data/games");
  const games = fs.existsSync(gameDirectory)
    ? fs.readdirSync(gameDirectory).filter((file) => file.endsWith(".json")).sort().map((file) => path.join("data/games", file))
    : [];
  return [...fixedSources, ...games].filter((file) => fs.existsSync(path.join(root, file))).sort();
}

export function buildMaintenanceUrlInventory(root = process.cwd()) {
  const entries = new Map();
  for (const relativePath of sourceFiles(root)) {
    const content = fs.readFileSync(path.join(root, relativePath), "utf8");
    content.split(/\r?\n/).forEach((line, index) => {
      for (const match of line.matchAll(urlPattern)) {
        const url = cleanUrl(match[0]);
        const sources = entries.get(url) ?? [];
        sources.push(`${relativePath}:${index + 1}`);
        entries.set(url, sources);
      }
    });
  }
  return [...entries.entries()]
    .map(([url, sources]) => ({ url, sources: [...new Set(sources)].sort() }))
    .sort((left, right) => left.url.localeCompare(right.url));
}

export function maintenanceSourceFiles(root = process.cwd()) {
  return sourceFiles(root);
}
