import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { getBoxArtFormat, PLATFORM_BOX_ART_FORMATS, type BoxArtFormat } from "./formats";
import { readPng } from "./png.mjs";

export type BoxArtProvider = "api" | "codex";
export type BoxArtQuality = "low" | "medium" | "high";

interface CatalogGameInput {
  slug: string;
  title: string;
  platforms: string[];
  assets: Array<Record<string, unknown>>;
}

export interface BoxArtDraft {
  schemaVersion: 1;
  slug: string;
  title: string;
  formatId: string;
  prompt: string;
  provider: BoxArtProvider;
  quality: BoxArtQuality;
  generatedAt: string;
  assetFile: "front.png";
  checksum: string;
  pixelWidth: number;
  pixelHeight: number;
  modelOrTool: string;
}

interface CodexResult {
  ok: boolean;
  status: string;
  outputs: string[];
}

interface PublicationJournal {
  schemaVersion: 1;
  imagePath: string;
  manifestPath: string;
  gamePath: string;
  manifestBefore: string;
  gameBefore: string;
}

export const BOX_ART_ARTIFACT_ROOT = "artifacts/box-art";
export const MAX_BOX_ART_BYTES = 12 * 1024 * 1024;
export const BOX_ART_APPROVAL_ATTESTATION = "I reviewed this exact asset and confirm it contains no recreated official box art, no logos, no characters, and no screenshots.";
export const OPENAI_TERMS_OF_USE_URL = "https://openai.com/policies/terms-of-use/";
export const OPENAI_TERMS_OF_USE_EFFECTIVE_DATE = "2026-01-01";
export const GENERATED_BOX_ART_DISCLOSURE = "AI-generated with OpenAI Codex Image; reviewed before publication.";
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9_]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/,
  /\b(?:api[_-]?key|authorization|bearer)\s*[:=]\s*[A-Za-z0-9._~+\/-]{12,}/i,
];

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertNoPotentialSecret(value: string, label: string) {
  invariant(!SECRET_PATTERNS.some((pattern) => pattern.test(value)), `${label} contains a credential-like value`);
}

function sha256(filePath: string): string {
  return `sha256:${createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function todayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function resolveWithin(root: string, relativePath: string): string {
  invariant(!path.isAbsolute(relativePath), "path must be repository-relative");
  const base = path.resolve(root);
  const target = path.resolve(base, relativePath);
  invariant(target === base || target.startsWith(`${base}${path.sep}`), "path escapes the repository");
  return target;
}

function repositoryRelative(root: string, absolutePath: string): string {
  const relative = path.relative(path.resolve(root), absolutePath);
  resolveWithin(root, relative);
  return relative.split(path.sep).join("/");
}

function assertNoSymlinks(root: string, target: string) {
  const base = path.resolve(root);
  const relative = path.relative(base, target);
  resolveWithin(base, relative);
  let current = base;
  const rootStat = fs.lstatSync(current);
  invariant(!rootStat.isSymbolicLink(), "repository root must not be a symlink");
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    invariant(!fs.lstatSync(current).isSymbolicLink(), `symlinked path is not allowed: ${repositoryRelative(base, current)}`);
  }
}

function ensureDirectory(root: string, directory: string) {
  assertNoSymlinks(root, directory);
  fs.mkdirSync(directory, { recursive: true });
  const stat = fs.lstatSync(directory);
  invariant(stat.isDirectory() && !stat.isSymbolicLink(), `expected a regular directory: ${repositoryRelative(root, directory)}`);
}

function readJson(filePath: string): unknown {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink(), `expected a regular JSON file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function atomicWriteText(root: string, target: string, contents: string) {
  assertNoSymlinks(root, path.dirname(target));
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  try {
    fs.writeFileSync(temporary, contents, { encoding: "utf8", flag: "wx" });
    const descriptor = fs.openSync(temporary, "r");
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function atomicCopy(root: string, source: string, target: string) {
  assertNoSymlinks(root, source);
  assertNoSymlinks(root, path.dirname(target));
  invariant(!fs.existsSync(target), `refusing to overwrite existing target: ${repositoryRelative(root, target)}`);
  const sourceStat = fs.lstatSync(source);
  invariant(sourceStat.isFile() && !sourceStat.isSymbolicLink(), "draft artwork must be a regular file");
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  try {
    fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function getCatalogGame(root: string, slug: string): CatalogGameInput {
  invariant(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), "--slug must be a kebab-case game slug");
  const filePath = resolveWithin(root, `data/games/${slug}.json`);
  const value = readJson(filePath);
  invariant(isRecord(value) && value.slug === slug && isNonEmpty(value.title) && Array.isArray(value.platforms), `data/games/${slug}.json is not a valid game record`);
  invariant(value.platforms.every(isNonEmpty), `data/games/${slug}.json has invalid platforms`);
  invariant(Array.isArray(value.assets), `data/games/${slug}.json has invalid assets`);
  return { slug, title: value.title, platforms: value.platforms, assets: value.assets.filter(isRecord) };
}

export function selectBoxArtFormat(platformIds: readonly string[], requestedFormatId?: string): BoxArtFormat {
  if (requestedFormatId) {
    const format = getBoxArtFormat(requestedFormatId);
    invariant(format, `unknown --format ${requestedFormatId}`);
    return format;
  }
  const candidates = [...new Set(platformIds.map((platformId) => PLATFORM_BOX_ART_FORMATS[platformId]).filter((formatId): formatId is string => Boolean(formatId)))];
  invariant(candidates.length === 1, "format inference is ambiguous or unavailable; provide --format explicitly");
  const format = getBoxArtFormat(candidates[0]);
  invariant(format, `configured format ${candidates[0]} is unavailable`);
  return format;
}

export function validateOriginalArtBrief(brief: string) {
  const normalized = brief.trim();
  invariant(normalized.length >= 24 && normalized.length <= 700, "--brief must be 24–700 characters");
  const forbidden = /\b(logo|wordmark|official\s+(?:box|cover|package)|screenshot|recreat(?:e|ion)|replicat(?:e|ion)|copy\s+(?:this|the)|exact\s+style|named\s+character|trademark)\b/i;
  invariant(!forbidden.test(normalized), "--brief contains a prohibited recreation or trademark request; describe original abstract motifs instead");
  assertNoPotentialSecret(normalized, "--brief");
  return normalized;
}

export function buildOriginalArtPrompt(brief: string, format: BoxArtFormat): string {
  return [
    "Create one original abstract editorial key-art illustration for a GameAtlas game catalog.",
    `Art direction: ${brief}.`,
    `Composition: fit the ${format.label.toLowerCase()} ${format.image.width}x${format.image.height} canvas with a strong central silhouette and clean edge space for local HTML labels.`,
    "Do not include text, letters, numbers, logos, publisher marks, platform marks, characters from existing franchises, screenshots, product packaging, copied compositions, or any recreation of an existing game cover.",
    "Do not imitate a living artist or an existing game's visual style. Make the art distinctly original, editorial, and non-branded.",
  ].join(" ");
}

function sanitizeChildEnvironment(provider: BoxArtProvider): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    CI: "true",
    NODE_ENV: process.env.NODE_ENV ?? "production",
    HOME: process.env.HOME,
    PATH: process.env.PATH,
    TMPDIR: process.env.TMPDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    CODEX_HOME: process.env.CODEX_HOME,
    NO_COLOR: "1",
  };
  if (provider === "api" && process.env.OPENAI_API_KEY) environment.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  return environment;
}

export function buildCodexImageArguments(options: { prompt: string; provider: BoxArtProvider; outputDirectory: string; format: BoxArtFormat; quality: BoxArtQuality; timeoutSeconds: number; dryRun: boolean }): string[] {
  return [
    "generate",
    "--prompt", options.prompt,
    "--provider", options.provider,
    "--output-dir", options.outputDirectory,
    "--name", "front",
    "--format", "png",
    "--size", `${options.format.image.width}x${options.format.image.height}`,
    "--quality", options.quality,
    "--n", "1",
    "--timeout-seconds", String(options.timeoutSeconds),
    ...(options.dryRun ? ["--dry-run"] : []),
    "--json",
  ];
}

function invokeCodexImage(root: string, command: string, argumentsList: string[], provider: BoxArtProvider, timeoutSeconds: number): CodexResult {
  const result = spawnSync(command, argumentsList, {
    cwd: root,
    encoding: "utf8",
    env: sanitizeChildEnvironment(provider),
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutSeconds * 1000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw new Error(`codex-image could not start or timed out: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`codex-image failed with status ${result.status}: ${String(result.stderr ?? "").trim()}`);
  const stdout = String(result.stdout ?? "").trim();
  let parsed: unknown;
  try { parsed = JSON.parse(stdout); } catch { throw new Error("codex-image did not return one valid JSON object"); }
  invariant(isRecord(parsed) && parsed.ok === true && isNonEmpty(parsed.status) && Array.isArray(parsed.outputs) && parsed.outputs.every(isNonEmpty), "codex-image returned an unexpected JSON contract");
  return { ok: parsed.ok, status: parsed.status, outputs: parsed.outputs };
}

function verifyCodexOutput(result: CodexResult, outputFile: string, dryRun: boolean) {
  const expectedStatus = dryRun ? "dry_run" : "success";
  invariant(result.status === expectedStatus, `codex-image returned ${result.status}, expected ${expectedStatus}`);
  invariant(result.outputs.length === 1, "codex-image must return exactly one output");
  invariant(path.resolve(result.outputs[0]) === path.resolve(outputFile), "codex-image output escaped the controlled staging location");
}

function toolLabel(command: string, provider: BoxArtProvider): string {
  const result = spawnSync(command, ["--version"], { encoding: "utf8", env: sanitizeChildEnvironment(provider), stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 });
  const version = result.status === 0 ? String(result.stdout ?? "").trim().replace(/\s+/g, " ") : "unknown version";
  return `${version || "codex-image"} (${provider} provider)`;
}

export interface GenerateBoxArtOptions {
  root: string;
  slug: string;
  brief: string;
  formatId?: string;
  quality?: BoxArtQuality;
  provider?: BoxArtProvider;
  allowApiBilling?: boolean;
  dryRun?: boolean;
  timeoutSeconds?: number;
  command?: string;
}

export function generateBoxArt(options: GenerateBoxArtOptions): { draftPath?: string; dryRun: boolean; formatId: string; prompt: string; plannedOutput: string } {
  const root = path.resolve(options.root);
  const game = getCatalogGame(root, options.slug);
  const format = selectBoxArtFormat(game.platforms, options.formatId);
  const provider = options.provider ?? "codex";
  const quality = options.quality ?? "low";
  const timeoutSeconds = options.timeoutSeconds ?? 180;
  const command = options.command ?? "codex-image";
  invariant(provider === "codex" || provider === "api", "--provider must be codex or api");
  invariant(provider !== "api" || options.allowApiBilling, "--provider api requires --allow-api-billing");
  invariant(["low", "medium", "high"].includes(quality), "--quality must be low, medium, or high");
  invariant(Number.isInteger(timeoutSeconds) && timeoutSeconds >= 1 && timeoutSeconds <= 300, "--timeout-seconds must be 1–300");
  const prompt = buildOriginalArtPrompt(validateOriginalArtBrief(options.brief), format);

  if (options.dryRun) {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gameatlas-box-art-dry-run-"));
    try {
      const outputDirectory = path.join(temporaryRoot, "out");
      fs.mkdirSync(outputDirectory);
      const outputFile = path.join(outputDirectory, "front.png");
      const result = invokeCodexImage(root, command, buildCodexImageArguments({ prompt, provider, outputDirectory, format, quality, timeoutSeconds, dryRun: true }), provider, timeoutSeconds);
      verifyCodexOutput(result, outputFile, true);
      return { dryRun: true, formatId: format.id, prompt, plannedOutput: outputFile };
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }

  const artifactRoot = resolveWithin(root, BOX_ART_ARTIFACT_ROOT);
  ensureDirectory(root, artifactRoot);
  const gameArtifactRoot = resolveWithin(root, `${BOX_ART_ARTIFACT_ROOT}/${game.slug}`);
  ensureDirectory(root, gameArtifactRoot);
  const draftDirectory = fs.mkdtempSync(path.join(gameArtifactRoot, "draft-"));
  assertNoSymlinks(root, draftDirectory);
  const outputFile = path.join(draftDirectory, "front.png");
  const result = invokeCodexImage(root, command, buildCodexImageArguments({ prompt, provider, outputDirectory: draftDirectory, format, quality, timeoutSeconds, dryRun: false }), provider, timeoutSeconds);
  verifyCodexOutput(result, outputFile, false);
  const image = readPng(outputFile, MAX_BOX_ART_BYTES);
  invariant(image.width === format.image.width && image.height === format.image.height, `codex-image output dimensions must be ${format.image.width}x${format.image.height}`);
  const draft: BoxArtDraft = {
    schemaVersion: 1,
    slug: game.slug,
    title: game.title,
    formatId: format.id,
    prompt,
    provider,
    quality,
    generatedAt: todayKey(),
    assetFile: "front.png",
    checksum: sha256(outputFile),
    pixelWidth: image.width,
    pixelHeight: image.height,
    modelOrTool: toolLabel(command, provider),
  };
  const draftPath = path.join(draftDirectory, "draft.json");
  atomicWriteText(root, draftPath, `${JSON.stringify(draft, null, 2)}\n`);
  return { draftPath: repositoryRelative(root, draftPath), dryRun: false, formatId: format.id, prompt, plannedOutput: repositoryRelative(root, outputFile) };
}

function validateDraft(value: unknown): asserts value is BoxArtDraft {
  invariant(isRecord(value), "draft metadata must be an object");
  invariant(value.schemaVersion === 1 && typeof value.slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) && isNonEmpty(value.title) && isNonEmpty(value.formatId) && isNonEmpty(value.prompt) && (value.provider === "codex" || value.provider === "api") && ["low", "medium", "high"].includes(String(value.quality)) && /^\d{4}-\d{2}-\d{2}$/.test(String(value.generatedAt)) && value.assetFile === "front.png" && /^sha256:[a-f0-9]{64}$/.test(String(value.checksum)) && typeof value.pixelWidth === "number" && Number.isInteger(value.pixelWidth) && value.pixelWidth > 0 && typeof value.pixelHeight === "number" && Number.isInteger(value.pixelHeight) && value.pixelHeight > 0 && isNonEmpty(value.modelOrTool), "draft metadata has an invalid contract");
  assertNoPotentialSecret(String(value.prompt), "draft prompt");
  assertNoPotentialSecret(String(value.modelOrTool), "draft tool provenance");
}

function readDraft(root: string, draftRelativePath: string): { draft: BoxArtDraft; draftPath: string; imagePath: string; format: BoxArtFormat } {
  const draftPath = resolveWithin(root, draftRelativePath);
  const normalizedDraftPath = repositoryRelative(root, draftPath);
  invariant(normalizedDraftPath === draftRelativePath && normalizedDraftPath.startsWith(`${BOX_ART_ARTIFACT_ROOT}/`), "--draft must be a normalized path under artifacts/box-art");
  assertNoSymlinks(root, draftPath);
  const draft = readJson(draftPath);
  validateDraft(draft);
  const format = getBoxArtFormat(draft.formatId);
  invariant(format, `draft references unknown format ${draft.formatId}`);
  const imagePath = resolveWithin(root, path.posix.join(path.posix.dirname(draftRelativePath), draft.assetFile));
  assertNoSymlinks(root, imagePath);
  const image = readPng(imagePath, MAX_BOX_ART_BYTES);
  invariant(image.width === format.image.width && image.height === format.image.height && image.width === draft.pixelWidth && image.height === draft.pixelHeight, "draft PNG dimensions do not match its format metadata");
  invariant(sha256(imagePath) === draft.checksum, "draft PNG checksum does not match draft metadata");
  return { draft, draftPath, imagePath, format };
}

function journalPath(root: string): string {
  return resolveWithin(root, `${BOX_ART_ARTIFACT_ROOT}/.publish-journal.json`);
}

export function getBoxArtPublicationLeaseInfo(rootInput: string): { repoId: string; port: number } {
  const root = path.resolve(rootInput);
  assertNoSymlinks(root, root);
  const canonicalRoot = fs.realpathSync(root);
  const repoId = createHash("sha256").update(canonicalRoot).digest("hex");
  return { repoId, port: 49152 + (Number.parseInt(repoId.slice(0, 4), 16) % 16384) };
}

function listen(server: net.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({ host: "127.0.0.1", port, exclusive: true });
  });
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function inspectExistingLease(port: number): Promise<unknown> {
  return new Promise((resolve) => {
    let completed = false;
    let timeout: NodeJS.Timeout | undefined;
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (value: unknown) => {
      if (completed) return;
      completed = true;
      if (timeout) clearTimeout(timeout);
      socket.destroy();
      resolve(value);
    };
    let response = "";
    timeout = setTimeout(() => finish(null), 1_000);
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      response += chunk;
      if (response.length > 4_096) finish(null);
    });
    socket.on("end", () => {
      try { finish(JSON.parse(response)); } catch { finish(null); }
    });
    socket.on("error", () => finish(null));
  });
}

async function acquirePublicationLease(root: string): Promise<() => Promise<void>> {
  ensureDirectory(root, resolveWithin(root, BOX_ART_ARTIFACT_ROOT));
  const { repoId, port } = getBoxArtPublicationLeaseInfo(root);
  const lease = { schemaVersion: 1, repoId, owner: randomUUID(), pid: process.pid, acquiredAt: new Date().toISOString() };
  const server = net.createServer((socket) => socket.end(`${JSON.stringify(lease)}\n`));
  try {
    await listen(server, port);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EADDRINUSE") throw error;
    const existing = await inspectExistingLease(port);
    if (isRecord(existing) && existing.schemaVersion === 1 && existing.repoId === repoId) throw new Error("another box-art publication or recovery process holds the repository lease");
    throw new Error("box-art publication lease port is occupied by an unknown process; refusing to proceed");
  }
  return async () => closeServer(server);
}

async function withPublicationLease<T>(root: string, operation: () => T | Promise<T>): Promise<T> {
  const release = await acquirePublicationLease(root);
  try {
    return await operation();
  } finally {
    await release();
  }
}

function parseJournal(value: unknown): PublicationJournal {
  invariant(isRecord(value) && value.schemaVersion === 1 && isNonEmpty(value.imagePath) && isNonEmpty(value.manifestPath) && isNonEmpty(value.gamePath) && isNonEmpty(value.manifestBefore) && isNonEmpty(value.gameBefore), "publish journal has an invalid contract");
  return value as unknown as PublicationJournal;
}

function ensurePublicationTarget(root: string, relativePath: string, prefix: string): string {
  const target = resolveWithin(root, relativePath);
  const normalizedPath = repositoryRelative(root, target);
  invariant(normalizedPath === relativePath, "publish journal path must be normalized");
  const permitted = prefix.endsWith("/") ? normalizedPath.startsWith(prefix) : normalizedPath === prefix;
  invariant(permitted, "publish journal target is outside its permitted location");
  assertNoSymlinks(root, target);
  return target;
}

function recoverPendingBoxArtPublicationUnlocked(root: string): boolean {
  const pending = journalPath(root);
  if (!fs.existsSync(pending)) return false;
  assertNoSymlinks(root, pending);
  const journal = parseJournal(readJson(pending));
  const imagePath = ensurePublicationTarget(root, journal.imagePath, "public/assets/games/");
  const manifestPath = ensurePublicationTarget(root, journal.manifestPath, "data/assets-manifest.json");
  const gamePath = ensurePublicationTarget(root, journal.gamePath, "data/games/");
  atomicWriteText(root, manifestPath, Buffer.from(journal.manifestBefore, "base64").toString("utf8"));
  atomicWriteText(root, gamePath, Buffer.from(journal.gameBefore, "base64").toString("utf8"));
  if (fs.existsSync(imagePath)) {
    const stat = fs.lstatSync(imagePath);
    invariant(stat.isFile() && !stat.isSymbolicLink(), "refusing to remove a non-regular interrupted publish target");
    fs.unlinkSync(imagePath);
  }
  fs.unlinkSync(pending);
  return true;
}

export async function recoverPendingBoxArtPublication(rootInput: string): Promise<boolean> {
  const root = path.resolve(rootInput);
  return withPublicationLease(root, () => recoverPendingBoxArtPublicationUnlocked(root));
}

function validApprovalAttestation(value: string): boolean {
  return value.trim() === BOX_ART_APPROVAL_ATTESTATION;
}

export interface PublishBoxArtOptions {
  root: string;
  draftPath?: string;
  reviewedBy?: string;
  approvalNote?: string;
  recoverOnly?: boolean;
  failureInjector?: (stage: "after-image" | "after-manifest" | "after-game") => void;
}

function publishBoxArtUnlocked(options: PublishBoxArtOptions, root: string): { recovered: boolean; assetPath?: string; provenanceId?: string } {
  const recovered = recoverPendingBoxArtPublicationUnlocked(root);
  if (options.recoverOnly) return { recovered };
  invariant(isNonEmpty(options.draftPath) && isNonEmpty(options.reviewedBy) && isNonEmpty(options.approvalNote), "--draft, --reviewed-by, and --approval-note are required to publish");
  assertNoPotentialSecret(options.reviewedBy, "--reviewed-by");
  invariant(validApprovalAttestation(options.approvalNote), `--approval-note must exactly equal this affirmative attestation: ${BOX_ART_APPROVAL_ATTESTATION}`);
  const { draft, imagePath, format } = readDraft(root, options.draftPath);
  const gamePath = resolveWithin(root, `data/games/${draft.slug}.json`);
  const manifestPath = resolveWithin(root, "data/assets-manifest.json");
  const game = readJson(gamePath);
  const manifest = readJson(manifestPath);
  invariant(isRecord(game) && game.slug === draft.slug && isNonEmpty(game.title) && Array.isArray(game.assets), "target game record is invalid");
  invariant(isRecord(manifest) && Array.isArray(manifest.assets), "asset manifest is invalid");
  const assetId = `game-${draft.slug}-box-front-${format.id}`;
  const targetRelativePath = `public/assets/games/${draft.slug}/front-${format.id}.png`;
  const targetPath = resolveWithin(root, targetRelativePath);
  assertNoSymlinks(root, targetPath);
  invariant(!fs.existsSync(targetPath), `refusing to overwrite ${targetRelativePath}`);
  invariant(!manifest.assets.some((asset) => isRecord(asset) && (asset.assetId === assetId || asset.path === targetRelativePath)), "manifest already contains this box-front asset");
  invariant(!game.assets.some((asset) => isRecord(asset) && asset.role === "box-front" && asset.boxFormatId === format.id), "game already has a box-front asset for this format");
  const altText = `AI-generated GameAtlas editorial front artwork for ${game.title} in the ${format.label} interactive package view.`;
  const manifestRecord = {
    assetId,
    path: targetRelativePath,
    assetKind: "generated-game-box-front",
    creatorOrSource: `Generated with ${draft.modelOrTool}`,
    licenseOrPermissionUrl: OPENAI_TERMS_OF_USE_URL,
    providerTermsEffectiveDate: OPENAI_TERMS_OF_USE_EFFECTIVE_DATE,
    attribution: "AI-generated with OpenAI Codex Image for GameAtlas",
    aiGeneratedDisclosure: GENERATED_BOX_ART_DISCLOSURE,
    generatedOrAcquiredAt: draft.generatedAt,
    intendedUse: "game-box-front",
    altText,
    reviewedBy: options.reviewedBy.trim(),
    rightsReviewedAt: todayKey(),
    recheckAt: null,
    promptOrGenerationBrief: draft.prompt,
    modelOrTool: draft.modelOrTool,
    outputOrAssetId: draft.checksum,
    contentChecksum: draft.checksum,
    boxFormatId: format.id,
    pixelWidth: draft.pixelWidth,
    pixelHeight: draft.pixelHeight,
    approvalNote: options.approvalNote.trim(),
  };
  const nextManifest = { ...manifest, assets: [...manifest.assets, manifestRecord] };
  const nextGame = { ...game, assets: [...game.assets, { path: targetRelativePath, alt: altText, provenanceId: assetId, role: "box-front", boxFormatId: format.id }] };
  const imageDirectory = path.dirname(targetPath);
  ensureDirectory(root, imageDirectory);
  const journal: PublicationJournal = {
    schemaVersion: 1,
    imagePath: targetRelativePath,
    manifestPath: "data/assets-manifest.json",
    gamePath: `data/games/${draft.slug}.json`,
    manifestBefore: Buffer.from(fs.readFileSync(manifestPath, "utf8")).toString("base64"),
    gameBefore: Buffer.from(fs.readFileSync(gamePath, "utf8")).toString("base64"),
  };
  const pending = journalPath(root);
  invariant(!fs.existsSync(pending), "a pending publish journal remains after recovery");
  atomicWriteText(root, pending, `${JSON.stringify(journal, null, 2)}\n`);
  try {
    atomicCopy(root, imagePath, targetPath);
    options.failureInjector?.("after-image");
    atomicWriteText(root, manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
    options.failureInjector?.("after-manifest");
    atomicWriteText(root, gamePath, `${JSON.stringify(nextGame, null, 2)}\n`);
    options.failureInjector?.("after-game");
    fs.unlinkSync(pending);
    return { recovered, assetPath: targetRelativePath, provenanceId: assetId };
  } catch (error) {
    try { recoverPendingBoxArtPublicationUnlocked(root); } catch (recoveryError) { throw new Error(`publish failed (${String(error)}); recovery also failed (${String(recoveryError)})`); }
    throw error;
  }
}

export async function publishBoxArt(options: PublishBoxArtOptions): Promise<{ recovered: boolean; assetPath?: string; provenanceId?: string }> {
  const root = path.resolve(options.root);
  return withPublicationLease(root, () => publishBoxArtUnlocked(options, root));
}
