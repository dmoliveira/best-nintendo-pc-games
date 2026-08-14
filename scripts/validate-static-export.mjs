import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(process.env.OUT_DIR ?? "out");
const expectedBasePath = (process.env.EXPECTED_BASE_PATH ?? "/best-nintendo-pc-games").replace(/\/$/, "");
const requiredFiles = ["index.html", ".nojekyll", "robots.txt", "sitemap.xml", "og-image.png", "mark.svg", "docs/rights-and-support-policy/index.html"];

function fail(message) { console.error(`Static export validation failed: ${message}`); process.exitCode = 1; }
if (!fs.existsSync(outDir)) { fail(`missing output directory ${outDir}`); process.exit(1); }
for (const file of requiredFiles) if (!fs.existsSync(path.join(outDir, file))) fail(`missing ${file}`);
const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
for (const expected of ["GameAtlas", "Best Nintendo", "Find the games", "worth your time."]) if (!html.includes(expected)) fail(`home page does not contain ${JSON.stringify(expected)}`);
if (!html.includes("docs/rights-and-support-policy")) fail("home page is missing the policy link");
if (html.includes("action=\"/\"")) fail("home page contains a root-relative form action that bypasses the Pages base path");
const sitemap = fs.readFileSync(path.join(outDir, "sitemap.xml"), "utf8");
if (expectedBasePath && !sitemap.includes(expectedBasePath)) fail(`sitemap does not include ${expectedBasePath}`);
const allFiles = [];
function walk(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const fullPath = path.join(directory, entry.name); if (entry.isDirectory()) walk(fullPath); else allFiles.push(fullPath); } }
walk(outDir);
for (const file of allFiles.filter((candidate) => /\.(html|js|css|xml|txt)$/.test(candidate))) if (/buy\.stripe\.com|\b(?:task|session|epic|memory|doc)_[0-9]+\b/i.test(fs.readFileSync(file, "utf8"))) fail(`public support/tracker detail found in ${path.relative(outDir, file)}`);
if (!process.exitCode) console.log(`Static export validation passed (${allFiles.length} files, base path ${expectedBasePath || "/"}).`);
