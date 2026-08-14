import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = JSON.parse(fs.readFileSync(path.join(root, "data/source-rights.json"), "utf8"));
const assetPolicy = JSON.parse(fs.readFileSync(path.join(root, "data/asset-rights.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/assets-manifest.json"), "utf8"));
const allowedStatuses = new Set(["approved", "outbound-only", "pending-review", "prohibited"]);
const requiredManifestFields = assetPolicy.manifestRequiredFields;
const failures = [];
const fail = (message) => failures.push(message);

const predicate = source.publicNumericSignalPolicy?.eligiblePredicate;
if (!predicate || !Array.isArray(predicate.all) || !Array.isArray(predicate.requiredFields) || !Array.isArray(predicate.approvedCriticProviders)) fail("numeric eligibility must be a structured predicate with an explicit provider allowlist");
if (predicate?.approvedCriticProviders?.length) fail("no critic provider is authorized in the foundation slice");
for (const record of source.sources ?? []) {
  if (!allowedStatuses.has(record.status)) fail(`${record.id}: unsupported source status`);
  for (const field of ["reviewedBy", "rightsReviewedAt", "recheckAt", "decisionEvidence", "coveredProcess"]) if (!(field in record)) fail(`${record.id}: missing ${field}`);
}
if (typeof source.support?.url === "string" || JSON.stringify(source).includes("buy.stripe.com") || JSON.stringify(source).includes("Codememory memory_")) fail("actionable support URL or internal tracker reference is public");

const manifestByPath = new Map();
for (const record of manifest.assets ?? []) {
  if (manifestByPath.has(record.path)) fail(`duplicate asset path: ${record.path}`);
  manifestByPath.set(record.path, record);
  for (const field of requiredManifestFields) if (!(field in record) || record[field] === "") fail(`${record.path}: missing ${field}`);
  if (!("licenseOrPermissionUrl" in record)) fail(`${record.path}: missing licenseOrPermissionUrl field`);
  if (record.licenseOrPermissionUrl === null && !record.notApplicableReason) fail(`${record.path}: null license URL needs notApplicableReason`);
  const kind = assetPolicy.assetKinds.find((candidate) => candidate.id === record.assetKind);
  if (!kind) fail(`${record.path}: unknown asset kind ${record.assetKind}`);
  else {
    if (!assetPolicy.publishableStatuses.includes(kind.status)) fail(`${record.path}: asset kind is not publishable (${kind.status})`);
    if (!kind.allowedUses.includes(record.intendedUse)) fail(`${record.path}: intended use ${record.intendedUse} is not allowed for ${record.assetKind}`);
    for (const field of assetPolicy.conditionalManifestFields[record.assetKind] ?? []) if (!(field in record) || record[field] === "") fail(`${record.path}: missing conditional field ${field}`);
  }
  const licenseSemantics = assetPolicy.manifestFieldSemantics.licenseOrPermissionUrl;
  const nullableLicenseKinds = new Set(licenseSemantics.nullableAssetKinds);
  if (record.licenseOrPermissionUrl === null && !nullableLicenseKinds.has(record.assetKind)) fail(`${record.path}: null license URL is not allowed for ${record.assetKind}`);
  if (record.licenseOrPermissionUrl === null && !(licenseSemantics.requiresWhenNull in record)) fail(`${record.path}: null license URL requires ${licenseSemantics.requiresWhenNull}`);
  if (!fs.existsSync(path.join(root, record.path))) fail(`${record.path}: manifest target does not exist`);
}

function walk(directory) {
  const files = [];
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(svg|png|jpe?g|webp)$/i.test(entry.name)) files.push(path.relative(root, full));
  }
  return files;
}
const localAssets = [...walk(path.join(root, "public")), fs.existsSync(path.join(root, "app/icon.svg")) ? "app/icon.svg" : null].filter(Boolean);
for (const assetPath of localAssets) if (!manifestByPath.has(assetPath)) fail(`${assetPath}: local asset is not in the manifest`);
for (const record of manifest.assets ?? []) if (!localAssets.includes(record.path)) fail(`${record.path}: manifest points at a non-publishable asset`);

const publicTextFiles = [
  "data/source-rights.json",
  "data/asset-rights.json",
  "data/assets-manifest.json",
  "docs/rights-and-support-policy.md",
  "README.md",
  "app/page.tsx",
  "app/docs/rights-and-support-policy/page.tsx",
  "docs/rights-and-support-policy.md",
  "docs/plan/new/2026-08-15-gameatlas-launch.md",
].filter((file) => fs.existsSync(path.join(root, file)));
for (const file of publicTextFiles) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (/buy\.stripe\.com|\b(?:task|session|epic|memory|doc)_[0-9]+\b/i.test(text)) fail(`${file}: public support/tracker detail found`);
}

if (failures.length) {
  console.error("Rights validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Rights validation passed (${source.sources.length} sources, ${manifest.assets.length} assets, ${predicate.approvedCriticProviders.length} approved critic providers).`);
