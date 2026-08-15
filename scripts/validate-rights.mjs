import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { localTodayKey, parseCalendarKey } from "../lib/date-policy.mjs";
import { readPng } from "../lib/box-art/png.mjs";
import { isValidHttpsUrl } from "../lib/url-policy.mjs";

const root = process.cwd();
const source = JSON.parse(fs.readFileSync(path.join(root, "data/source-rights.json"), "utf8"));
const assetPolicy = JSON.parse(fs.readFileSync(path.join(root, "data/asset-rights.json"), "utf8"));
const evidencePolicy = JSON.parse(fs.readFileSync(path.join(root, "data/evidence-policy.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/assets-manifest.json"), "utf8"));
const boxArtFormats = JSON.parse(fs.readFileSync(path.join(root, "data/box-art-formats.json"), "utf8"));
const platformChronology = JSON.parse(fs.readFileSync(path.join(root, "data/platform-chronology.json"), "utf8"));
const catalogInventory = JSON.parse(fs.readFileSync(path.join(root, "data/curation/2026-08-15-wikidata-catalog-1000.json"), "utf8"));
const platformTaxonomy = JSON.parse(fs.readFileSync(path.join(root, "data/platforms.json"), "utf8"));
const allowedStatuses = new Set(["approved", "outbound-only", "pending-review", "prohibited"]);
const requiredManifestFields = assetPolicy.manifestRequiredFields;
const failures = [];
const fail = (message) => failures.push(message);
const nonEmpty = (value) => typeof value === "string" && value.trim() !== "";
const todayKey = localTodayKey();
const boxFormatById = new Map();
const maxGeneratedBoxFrontBytes = 12 * 1024 * 1024;
const boxArtApprovalAttestation = "I reviewed this exact asset and confirm it contains no recreated official box art, no logos, no characters, and no screenshots.";
const publicSecretPattern = /(?:\bsk-[A-Za-z0-9_-]{20,}\b|\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b|-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|\b(?:api[_-]?key|authorization|bearer)\s*[:=]\s*[A-Za-z0-9._~+\/-]{12,})/i;

function requirePastDate(value, label) {
  const date = parseCalendarKey(value);
  if (!date) fail(`${label}: must be a valid YYYY-MM-DD date`);
  else if (date > todayKey) fail(`${label}: must not be in the future`);
}
function requireFutureDate(value, label) {
  const date = parseCalendarKey(value);
  if (!date) fail(`${label}: must be a valid YYYY-MM-DD date`);
  else if (date < todayKey) fail(`${label}: recheck date is expired`);
}
function sha256(filePath) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}
function validBoxAttestation(value) {
  return typeof value === "string" && value.trim() === boxArtApprovalAttestation;
}
function hasConditionalValue(record, field) {
  if (field === "pixelWidth" || field === "pixelHeight") return Number.isInteger(record[field]) && record[field] > 0;
  return nonEmpty(record[field]);
}
function validGeometryDimensions(value, kind) {
  return Boolean(
    value
    && Number.isFinite(value.width)
    && Number.isFinite(value.height)
    && Number.isFinite(value.depth)
    && value.width > 0
    && value.height > 0
    && (kind === "physical" ? value.depth > 0 : value.depth === 0),
  );
}

function validateBoxArtFormats() {
  if (boxArtFormats.schemaVersion !== 2 || !nonEmpty(boxArtFormats.policy) || !nonEmpty(boxArtFormats.geometryPolicy) || !Array.isArray(boxArtFormats.geometrySources) || !boxArtFormats.geometrySources.length || !Array.isArray(boxArtFormats.formats) || !boxArtFormats.formats.length || !boxArtFormats.platformFormatMap || typeof boxArtFormats.platformFormatMap !== "object" || Array.isArray(boxArtFormats.platformFormatMap) || !boxArtFormats.platformPackageProfiles || typeof boxArtFormats.platformPackageProfiles !== "object" || Array.isArray(boxArtFormats.platformPackageProfiles)) {
    fail("data/box-art-formats.json: requires schemaVersion 2, policy, geometry provenance, formats, mappings, and package profiles");
    return;
  }
  const sourceById = new Map();
  for (const [index, source] of boxArtFormats.geometrySources.entries()) {
    const label = `data/box-art-formats.json.geometrySources[${index}]`;
    if (!source || !nonEmpty(source.id) || sourceById.has(source.id) || !nonEmpty(source.title) || (source.sourceUrl !== null && !isValidHttpsUrl(source.sourceUrl)) || !parseCalendarKey(source.accessedAt) || !nonEmpty(source.method)) {
      fail(`${label}: requires unique id, title, nullable HTTPS source URL, date, and method`);
      continue;
    }
    sourceById.set(source.id, source);
  }
  for (const [index, format] of boxArtFormats.formats.entries()) {
    const label = `data/box-art-formats.json.formats[${index}]`;
    if (!format || !nonEmpty(format.id) || boxFormatById.has(format.id)) {
      fail(`${label}: requires a unique non-empty id`);
      continue;
    }
    if (!nonEmpty(format.label) || !["physical", "digital"].includes(format.kind) || !validGeometryDimensions(format.dimensions, format.kind) || !format.image || !Number.isInteger(format.image.width) || !Number.isInteger(format.image.height) || format.image.width < 1 || format.image.height < 1) {
      fail(`${label}: has invalid label, kind, dimensions, or image dimensions`);
      continue;
    }
    boxFormatById.set(format.id, format);
  }
  const mappedPlatformIds = new Set(Object.keys(boxArtFormats.platformFormatMap));
  for (const [platformId, formatId] of Object.entries(boxArtFormats.platformFormatMap)) if (!nonEmpty(platformId) || !nonEmpty(formatId) || !boxFormatById.has(formatId)) fail(`data/box-art-formats.json.platformFormatMap.${platformId}: must reference a declared format`);
  const profileIds = new Set();
  for (const platformId of mappedPlatformIds) if (!(platformId in boxArtFormats.platformPackageProfiles)) fail(`data/box-art-formats.json.platformPackageProfiles.${platformId}: missing profile`);
  for (const [platformId, profile] of Object.entries(boxArtFormats.platformPackageProfiles)) {
    const label = `data/box-art-formats.json.platformPackageProfiles.${platformId}`;
    const format = boxFormatById.get(profile?.formatId);
    if (!mappedPlatformIds.has(platformId) || !profile || !nonEmpty(profile.id) || profileIds.has(profile.id) || !format || profile.formatId !== boxArtFormats.platformFormatMap[platformId] || !["physical", "digital"].includes(profile.kind) || !validGeometryDimensions(profile.dimensions, profile.kind) || profile.kind !== format.kind || !nonEmpty(profile.category) || !["cardboard", "digital", "plastic-case", "plastic-clamshell"].includes(profile.material) || !["left", "none"].includes(profile.openingSide) || (profile.kind === "physical" && profile.openingSide !== "left") || (profile.kind === "digital" && profile.openingSide !== "none") || !sourceById.has(profile.sourceId) || !["official-platform-exception", "representative-estimate", "retailer-reference", "supplier-reference"].includes(profile.basis) || !["low", "medium", "high"].includes(profile.confidence) || !nonEmpty(profile.scope) || !nonEmpty(profile.caveat)) {
      fail(`${label}: has invalid format, geometry, material, provenance, or presentation fields`);
      continue;
    }
    if (profile.basis !== "representative-estimate" && !sourceById.get(profile.sourceId).sourceUrl) fail(`${label}: non-estimate geometry requires a source URL`);
    profileIds.add(profile.id);
  }
}

validateBoxArtFormats();

const predicate = source.publicNumericSignalPolicy?.eligiblePredicate;
if (!predicate || !Array.isArray(predicate.all) || !Array.isArray(predicate.requiredFields) || !Array.isArray(predicate.approvedCriticProviders)) fail("numeric eligibility must be a structured predicate with an explicit provider allowlist");
if (predicate?.approvedCriticProviders?.length) fail("no critic provider is authorized in the foundation slice");
if (predicate?.minimumScore !== 80) fail("critic threshold minimumScore must be 80");
if (predicate?.requiredScale !== 100) fail("critic threshold requiredScale must be 100");
const popularityPredicate = source.popularitySignalPolicy?.eligiblePredicate;
if (!popularityPredicate || !Array.isArray(popularityPredicate.all) || !Array.isArray(popularityPredicate.requiredFields) || !Array.isArray(popularityPredicate.approvedPopularityProviders) || popularityPredicate.publicMode !== "outbound-only") fail("popularity eligibility must be a structured outbound-only predicate with an explicit provider allowlist");
if (popularityPredicate?.approvedPopularityProviders?.length) fail("no popularity provider is authorized in the foundation slice");
const expectedEvidenceStates = {
  "link-only": { publicMode: "outbound-reference", numericDisplay: false, allowedKinds: ["critic", "user", "sales", "popularity"], requiredFields: ["sourceId", "sourceUrl", "capturedAt"] },
  "verified-fact": { publicMode: "factual-display", numericDisplay: true, allowedKinds: ["sales"], requiredFields: ["sourceId", "sourceUrl", "territory", "period", "asOf", "reviewedBy"] },
  "licensed-signal": { publicMode: "numeric-display", numericDisplay: true, allowedKinds: ["critic", "user", "popularity"], requiredFields: ["provider", "sourceId", "sourceUrl", "termsUrl", "methodVersionOrScoreType", "capturedAt", "reviewedBy", "rightsReviewedAt", "recheckAt"] },
  "original-editorial": { publicMode: "editorial-display", numericDisplay: false, allowedKinds: ["editorial"], requiredFields: ["provider", "sourceId", "sourceUrl", "rationale", "reviewedBy"] },
  "catalog-method": { publicMode: "catalog-method-display", numericDisplay: false, allowedKinds: ["editorial"], requiredFields: ["provider", "sourceId", "sourceUrl", "rationale", "reviewedBy"] },
};
const evidenceStates = Array.isArray(evidencePolicy.states) ? evidencePolicy.states : [];
const evidenceStateIds = new Set(evidenceStates.map((state) => state.id));
if (evidencePolicy.schemaVersion !== 1 || evidenceStates.length !== 5 || evidenceStateIds.size !== 5) fail("evidence policy must define exactly five publishing states");
for (const [id, expected] of Object.entries(expectedEvidenceStates)) {
  const actual = evidenceStates.find((state) => state.id === id);
  const actualKinds = Array.isArray(actual?.allowedKinds) ? [...actual.allowedKinds].sort() : [];
  const actualFields = Array.isArray(actual?.requiredFields) ? actual.requiredFields : [];
  if (!actual || actual.publicMode !== expected.publicMode || actual.numericDisplay !== expected.numericDisplay || JSON.stringify(actualKinds) !== JSON.stringify([...expected.allowedKinds].sort()) || JSON.stringify(actualFields) !== JSON.stringify(expected.requiredFields)) fail(`evidence policy state ${id}: definition drifted`);
}
const criticThreshold = evidencePolicy.thresholds?.critic80;
if (!criticThreshold || criticThreshold.kind !== "critic" || criticThreshold.minimumScore !== 80 || criticThreshold.requiredScale !== 100 || criticThreshold.requiresState !== "licensed-signal" || criticThreshold.providerAllowlist !== "approvedCriticProviders" || !Array.isArray(criticThreshold.fallbackKinds) || criticThreshold.fallbackKinds.length) fail("critic threshold must require the licensed-signal state and have no fallbacks");
if (evidencePolicy.defaults?.allowNumericFallbacks !== false || evidencePolicy.defaults?.allowProviderContentCopy !== false) fail("evidence policy must disable numeric fallbacks and provider-content copying");
const sourceIds = new Set();
for (const record of source.sources ?? []) {
  if (typeof record.id !== "string" || record.id.trim() === "") fail("source record: id must be a non-empty string");
  else if (sourceIds.has(record.id)) fail(`duplicate source ID: ${record.id}`);
  else sourceIds.add(record.id);
  if (!allowedStatuses.has(record.status)) fail(`${record.id}: unsupported source status`);
  for (const field of ["reviewedBy", "rightsReviewedAt", "recheckAt", "decisionEvidence", "coveredProcess"]) if (!(field in record)) fail(`${record.id}: missing ${field}`);
  for (const field of ["reviewedBy", "decisionEvidence", "coveredProcess"]) if (typeof record[field] !== "string" || record[field].trim() === "") fail(`${record.id}.${field}: must be a non-empty string`);
  if (record.termsUrl !== undefined && record.termsUrl !== null && !isValidHttpsUrl(record.termsUrl)) fail(`${record.id}.termsUrl: must be a valid https URL when present`);
  if (record.allowedFields?.some((field) => ["numericScore", "popularitySignal"].includes(field)) && !isValidHttpsUrl(record.termsUrl)) fail(`${record.id}.termsUrl: required for critic/popularity authorization`);
  requirePastDate(record.rightsReviewedAt, `${record.id}.rightsReviewedAt`);
  if (record.recheckAt === null || record.recheckAt === undefined) fail(`${record.id}.recheckAt: required for source decisions`);
  else requireFutureDate(record.recheckAt, `${record.id}.recheckAt`);
}
const wikidata = (source.sources ?? []).find((record) => record.id === "wikidata-fact-reference");
if (!wikidata) {
  fail("missing approved wikidata-fact-reference source contract");
} else {
  const required = { provider: "Wikidata contributors", role: "CC0 structured-data catalog reference", status: "approved", numericScores: "not-authorized", reviewText: "do-not-copy", images: "do-not-download", termsUrl: "https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/en", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/legalcode", structuredDataPolicyUrl: "https://www.wikidata.org/wiki/Wikidata:Copyright", dataAccessUrl: "https://www.wikidata.org/wiki/Wikidata:Data_access", queryServiceUrl: "https://query.wikidata.org/" };
  for (const [field, expected] of Object.entries(required)) if (wikidata[field] !== expected) fail("wikidata-fact-reference." + field + " must equal the approved source contract");
  const allowedFields = ["wikidataTitleLabel", "wikidataReleaseYear", "wikidataPlatformDebutYear", "wikidataListedPlatform", "wikidataListedGenre", "individualSourceUrl"];
  if (JSON.stringify(wikidata.allowedFields) !== JSON.stringify(allowedFields)) fail("wikidata-fact-reference.allowedFields must be the structured-data whitelist");
  for (const field of ["attribution", "notes", "coveredProcess"]) if (!nonEmpty(wikidata[field])) fail("wikidata-fact-reference." + field + " must be non-empty");
  if (!String(wikidata.notes).includes("Not all Wikidata website content is CC0") || !String(wikidata.notes).includes("Do not copy prose") || !String(wikidata.notes).includes("platform-debut year") || !String(wikidata.coveredProcess).includes("Frozen local import")) fail("wikidata-fact-reference must scope CC0 to structured data, prohibit copied provider content, and constrain platform-debut facts to the chronology audit");
  for (const field of ["termsUrl", "licenseUrl", "structuredDataPolicyUrl", "dataAccessUrl", "queryServiceUrl"]) if (!isValidHttpsUrl(wikidata[field])) fail("wikidata-fact-reference." + field + " must be a valid https URL");
}
const nintendoHistory = (source.sources ?? []).find((record) => record.id === "nintendo-platform-history");
if (!nintendoHistory) {
  fail("missing approved nintendo-platform-history source contract");
} else {
  const required = { provider: "Nintendo", role: "first-party platform debut chronology reference", status: "approved", numericScores: "not-authorized", reviewText: "do-not-copy", images: "do-not-download", decisionEvidence: "https://www.nintendo.co.jp/corporate/history/index.html" };
  for (const [field, expected] of Object.entries(required)) if (nintendoHistory[field] !== expected) fail("nintendo-platform-history." + field + " must equal the approved source contract");
  if (JSON.stringify(nintendoHistory.allowedFields) !== JSON.stringify(["platformDebutYear", "individualSourceUrl"])) fail("nintendo-platform-history.allowedFields must be the chronology whitelist");
  if (JSON.stringify(nintendoHistory.evidenceUrls) !== JSON.stringify(["https://www.nintendo.co.jp/corporate/history/index.html", "https://www.nintendo.co.jp/corporate/release/en/2025/250402.html"])) fail("nintendo-platform-history.evidenceUrls must retain the reviewed corporate-history and Switch 2 announcement links");
  for (const field of ["attribution", "notes", "coveredProcess"]) if (!nonEmpty(nintendoHistory[field])) fail("nintendo-platform-history." + field + " must be non-empty");
  if (!String(nintendoHistory.notes).includes("does not establish an individual title release") || !String(nintendoHistory.coveredProcess).includes("chronology registry")) fail("nintendo-platform-history must limit debut years to chronology audit use");
}

const chronologyEntries = Array.isArray(platformChronology.platforms) ? platformChronology.platforms : [];
const taxonomyPlatformIds = new Set((platformTaxonomy.items ?? []).map((platform) => platform.id));
const chronologyPlatformIds = new Set();
if (platformChronology.schemaVersion !== 1 || platformChronology.reviewedAt !== "2026-08-15" || !nonEmpty(platformChronology.policy) || chronologyEntries.length !== taxonomyPlatformIds.size || taxonomyPlatformIds.size !== 16) fail("platform chronology registry must retain 16 reviewed platform entries");
for (const [index, entry] of chronologyEntries.entries()) {
  const label = `platform chronology registry entry ${index}`;
  if (!entry || !nonEmpty(entry.platformId) || chronologyPlatformIds.has(entry.platformId) || !taxonomyPlatformIds.has(entry.platformId)) {
    fail(`${label}: must reference one unique catalog platform`);
    continue;
  }
  chronologyPlatformIds.add(entry.platformId);
  if (entry.wikidataPlatformId !== catalogInventory.platformQids?.[entry.platformId]) fail(`${label}: Wikidata platform QID must match the frozen catalog inventory`);
  if (!Number.isInteger(entry.debutYear) || entry.debutYear < 1950 || entry.debutYear > 2100 || entry.reviewedAt !== platformChronology.reviewedAt || entry.scope !== "earliest-known-market-debut" || !nonEmpty(entry.caveat) || !isValidHttpsUrl(entry.sourceUrl)) fail(`${label}: must retain valid debut-year evidence, review date, scope, and caveat`);
  if (entry.sourceId === "nintendo-platform-history") {
    if (!nintendoHistory?.allowedFields?.includes("platformDebutYear") || !nintendoHistory.evidenceUrls?.includes(entry.sourceUrl)) fail(`${label}: Nintendo chronology evidence must use an approved recorded URL`);
  } else if (entry.sourceId === "wikidata-fact-reference") {
    if (!wikidata?.allowedFields?.includes("wikidataPlatformDebutYear") || entry.sourceUrl !== `https://www.wikidata.org/wiki/${entry.wikidataPlatformId}`) fail(`${label}: Wikidata chronology evidence must use its approved structured-data item URL`);
  } else {
    fail(`${label}: must use an approved chronology source`);
  }
}
if (chronologyPlatformIds.size !== taxonomyPlatformIds.size || [...taxonomyPlatformIds].some((id) => !chronologyPlatformIds.has(id))) fail("platform chronology registry must cover every catalog platform exactly once");

if (typeof source.support?.url === "string" || JSON.stringify(source).includes("buy.stripe.com") || JSON.stringify(source).includes("Codememory memory_")) fail("actionable support URL or internal tracker reference is public");

const manifestByPath = new Map();
const manifestById = new Map();
for (const record of manifest.assets ?? []) {
  if (manifestByPath.has(record.path)) fail(`duplicate asset path: ${record.path}`);
  manifestByPath.set(record.path, record);
  if (typeof record.assetId !== "string" || record.assetId.trim() === "") fail(`${record.path}: assetId must be a non-empty string`);
  else if (manifestById.has(record.assetId)) fail(`duplicate asset ID: ${record.assetId}`);
  else manifestById.set(record.assetId, record);
  const manifestTextFields = new Set(["assetId", "path", "assetKind", "creatorOrSource", "attribution", "intendedUse", "altText", "reviewedBy"]);
  for (const field of requiredManifestFields) if (!(field in record) || (manifestTextFields.has(field) ? !nonEmpty(record[field]) : record[field] === "")) fail(`${record.path}: missing ${field}`);
  if (!("licenseOrPermissionUrl" in record)) fail(`${record.path}: missing licenseOrPermissionUrl field`);
  if (record.licenseOrPermissionUrl === null && !nonEmpty(record.notApplicableReason)) fail(`${record.path}: null license URL needs notApplicableReason`);
  if (record.licenseOrPermissionUrl !== undefined && record.licenseOrPermissionUrl !== null && !isValidHttpsUrl(record.licenseOrPermissionUrl)) fail(`${record.path}: licenseOrPermissionUrl must be a valid https URL when present`);
  const kind = assetPolicy.assetKinds.find((candidate) => candidate.id === record.assetKind);
  if (!kind) fail(`${record.path}: unknown asset kind ${record.assetKind}`);
  else {
    if (!assetPolicy.publishableStatuses.includes(kind.status)) fail(`${record.path}: asset kind is not publishable (${kind.status})`);
    if (!kind.allowedUses.includes(record.intendedUse)) fail(`${record.path}: intended use ${record.intendedUse} is not allowed for ${record.assetKind}`);
    for (const field of assetPolicy.conditionalManifestFields[record.assetKind] ?? []) if (!(field in record) || !hasConditionalValue(record, field)) fail(`${record.path}: missing conditional field ${field}`);
  }
  const licenseSemantics = assetPolicy.manifestFieldSemantics.licenseOrPermissionUrl;
  const nullableLicenseKinds = new Set(licenseSemantics.nullableAssetKinds);
  if (record.licenseOrPermissionUrl === null && !nullableLicenseKinds.has(record.assetKind)) fail(`${record.path}: null license URL is not allowed for ${record.assetKind}`);
  if (record.licenseOrPermissionUrl === null && !(licenseSemantics.requiresWhenNull in record)) fail(`${record.path}: null license URL requires ${licenseSemantics.requiresWhenNull}`);
  const recheckSemantics = assetPolicy.manifestFieldSemantics.recheckAt;
  const nullableRecheckKinds = new Set(recheckSemantics.nullableAssetKinds);
  if (record.recheckAt === null || record.recheckAt === undefined) {
    if (!nullableRecheckKinds.has(record.assetKind)) fail(`${record.path}: recheckAt is required for ${record.assetKind}`);
  } else requireFutureDate(record.recheckAt, `${record.path}.recheckAt`);
  requirePastDate(record.rightsReviewedAt, `${record.path}.rightsReviewedAt`);
  requirePastDate(record.generatedOrAcquiredAt, `${record.path}.generatedOrAcquiredAt`);
  const assetPath = path.join(root, record.path);
  if (!fs.existsSync(assetPath)) {
    fail(`${record.path}: manifest target does not exist`);
    continue;
  }
  if (record.assetKind === "generated-game-box-front") {
    const format = boxFormatById.get(record.boxFormatId);
    if (!format) fail(`${record.path}: boxFormatId must reference a declared format`);
    if (!isValidHttpsUrl(record.licenseOrPermissionUrl)) fail(`${record.path}: generated box-front requires a provider terms URL`);
    requirePastDate(record.providerTermsEffectiveDate, `${record.path}: providerTermsEffectiveDate`);
    if (!/\bAI-generated\b/i.test(record.aiGeneratedDisclosure ?? "")) fail(`${record.path}: aiGeneratedDisclosure must identify AI generation`);
    if (!record.path.startsWith("public/assets/games/") || !record.path.endsWith(`/front-${record.boxFormatId}.png`)) fail(`${record.path}: generated box-front path must use public/assets/games/<slug>/front-<format>.png`);
    if (!/^sha256:[a-f0-9]{64}$/.test(record.contentChecksum ?? "")) fail(`${record.path}: contentChecksum must be a sha256 digest`);
    else if (sha256(assetPath) !== record.contentChecksum) fail(`${record.path}: contentChecksum does not match file bytes`);
    if (record.outputOrAssetId !== record.contentChecksum) fail(`${record.path}: outputOrAssetId must match the checksum-bound output`);
    if (!validBoxAttestation(record.approvalNote)) fail(`${record.path}: approvalNote must attest to review and no recreated official box art, logos, characters, or screenshots`);
    try {
      const image = readPng(assetPath, maxGeneratedBoxFrontBytes);
      if (!format || image.width !== format.image.width || image.height !== format.image.height || record.pixelWidth !== image.width || record.pixelHeight !== image.height) fail(`${record.path}: PNG dimensions must match the selected format and recorded dimensions`);
    } catch (error) {
      fail(`${record.path}: invalid generated box-front PNG (${error.message})`);
    }
  }
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
  "data/evidence-policy.json",
  "data/asset-rights.json",
  "data/assets-manifest.json",
  "data/box-art-formats.json",
  "data/platform-chronology.json",
  "public/catalog-search-index.json",
  "docs/rights-and-support-policy.md",
  "docs/guides/game-box-art-workflow.md",
  "README.md",
  "app/page.tsx",
  "app/docs/rights-and-support-policy/page.tsx",
  "docs/rights-and-support-policy.md",
  "docs/plan/new/2026-08-15-gameatlas-launch.md",
].filter((file) => fs.existsSync(path.join(root, file)));
for (const file of publicTextFiles) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (/buy\.stripe\.com|\b(?:task|session|epic|memory|doc)_[0-9]+\b/i.test(text)) fail(`${file}: public support/tracker detail found`);
  if (publicSecretPattern.test(text)) fail(`${file}: credential-like value found in public content`);
}

if (failures.length) {
  console.error("Rights validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Rights validation passed (${source.sources.length} sources, ${manifest.assets.length} assets, ${predicate.approvedCriticProviders.length} approved critic providers, ${popularityPredicate.approvedPopularityProviders.length} approved popularity providers).`);
