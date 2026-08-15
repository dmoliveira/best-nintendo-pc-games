import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const outDirectory = path.join(root, "out");
const basePath = "/best-nintendo-pc-games";
const chromeCandidates = [process.env.CHROME_BIN, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);

function fail(message) {
  throw new Error(`Box-art browser validation failed: ${message}`);
}

function catalogResultTotal(summary) {
  const match = summary.match(/\bof\s+([0-9][0-9,\u00a0\u202f ]*)\s+matching games\b/i);
  const normalized = match?.[1].replace(/[,\u00a0\u202f ]/g, "");
  return normalized && /^\d+$/.test(normalized) ? Number(normalized) : undefined;
}

function mimeType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function resolveExportPath(requestPath) {
  const stripped = requestPath === basePath ? "/" : requestPath.startsWith(`${basePath}/`) ? requestPath.slice(basePath.length) : requestPath;
  const normalized = decodeURIComponent(stripped).replace(/^\/+/, "");
  const raw = path.resolve(outDirectory, normalized || "index.html");
  const target = fs.existsSync(raw) && fs.statSync(raw).isDirectory() ? path.join(raw, "index.html") : raw;
  if (!(target === outDirectory || target.startsWith(`${outDirectory}${path.sep}`))) return null;
  return target;
}

async function startServer() {
  const server = http.createServer((request, response) => {
    const requestPath = new URL(request.url ?? "/", "http://localhost").pathname;
    const target = resolveExportPath(requestPath);
    if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": mimeType(target), "cache-control": "no-store" });
    fs.createReadStream(target).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") fail("could not determine local preview port");
  return { server, port: address.port };
}

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") fail("could not reserve Chrome debugging port");
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(check, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw lastError ?? new Error("timed out");
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.socket = new WebSocket(url);
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${message.error.message ?? "CDP error"}`));
        else pending.resolve(message.result);
        return;
      }
      const listeners = this.events.get(message.method) ?? [];
      for (const listener of listeners.splice(0)) listener(message.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const listeners = this.events.get(method) ?? [];
      listeners.push(resolve);
      this.events.set(method, listeners);
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "browser evaluation failed");
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function press(client, key, code, keyCode) {
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}

const desktopMetrics = { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false };

async function catalogIndexRequestCount(client) {
  return client.evaluate('performance.getEntriesByType("resource").filter((entry) => new URL(entry.name).pathname.endsWith("/catalog-search-index.json")).length');
}

async function waitForCatalogShell(client) {
  await waitFor(() => client.evaluate('Boolean(document.querySelector("#catalog-query")) && document.querySelectorAll(".game-card").length === 24'));
}

async function waitForCatalogReady(client) {
  await waitFor(() => client.evaluate('document.querySelector(".catalog-browser")?.dataset.catalogIndexStatus === "ready" && document.querySelector(".result-summary")?.textContent?.includes("matching games")'));
}

async function validateCatalogBrowser(client, catalogUrl, representativeGame, deferredPlatformId, deferredPlatformCount) {
  await client.send("Emulation.setDeviceMetricsOverride", desktopMetrics);
  await client.send("Emulation.setEmulatedMedia", { features: [] });

  await client.send("Page.navigate", { url: catalogUrl });
  await waitForCatalogShell(client);
  await new Promise((resolve) => setTimeout(resolve, 350));
  const idle = await client.evaluate('(() => ({ status: document.querySelector(".catalog-browser")?.dataset.catalogIndexStatus, cards: document.querySelectorAll(".game-card").length, summary: document.querySelector(".result-summary")?.textContent }))()');
  const idleRequests = await catalogIndexRequestCount(client);
  if (idle.status !== "idle" || idle.cards !== 24 || idleRequests !== 0 || !idle.summary?.includes("Browse or use filters to load the full catalog")) fail(`catalog index loaded before intent or viewport proximity: ${JSON.stringify({ idle, idleRequests })}`);

  await client.evaluate('document.querySelector("#catalog-query")?.focus()');
  await client.send("Input.insertText", { text: "celeste" });
  await waitFor(() => client.evaluate('document.querySelector(".catalog-browser")?.dataset.catalogIndexStatus === "ready" && document.activeElement === document.querySelector("#catalog-query") && document.querySelector("#catalog-query")?.value === "celeste" && new URL(window.location.href).searchParams.get("q") === "celeste" && document.querySelector(".result-summary")?.textContent?.includes("matching games")'));
  const focusRequests = await catalogIndexRequestCount(client);
  if (focusRequests !== 1) fail(`catalog focus trigger did not issue exactly one index request: ${focusRequests}`);
  await client.evaluate('document.querySelector(".browser-button--clear")?.click()');
  await waitFor(() => client.evaluate('!new URL(window.location.href).searchParams.has("q") && document.querySelector(".result-summary")?.textContent?.includes("matching games")'));

  const representativeUrl = new URL(catalogUrl);
  representativeUrl.searchParams.set("q", representativeGame.title);
  const representativeSelector = `.game-card-title-link[href="${basePath}/games/${representativeGame.slug}/"]`;
  await client.send("Page.navigate", { url: representativeUrl.toString() });
  await waitFor(() => client.evaluate(`Boolean(document.querySelector(${JSON.stringify(representativeSelector)}))`));
  await waitForCatalogReady(client);
  const representativeRequests = await catalogIndexRequestCount(client);
  if (representativeRequests !== 1) fail(`catalog deep-link query did not issue exactly one index request: ${representativeRequests}`);

  const representative = await client.evaluate(String.raw`
    (() => {
      const card = document.querySelector(${JSON.stringify(representativeSelector)})?.closest(".game-card");
      return {
        foundRepresentativeCard: Boolean(card),
        gameDetailLinks: card ? [...card.querySelectorAll('a[href*="/games/"]')].length : 0,
        titleLink: Boolean(card?.querySelector(".game-card-title-link")),
        artLink: Boolean(card?.querySelector(".game-card-art a")),
        platformList: card?.querySelector(".game-card-topline-platforms")?.tagName,
      };
    })()
  `);
  if (!representative.foundRepresentativeCard || !representative.titleLink || representative.gameDetailLinks !== 1 || representative.artLink || representative.platformList !== "UL") fail(`catalog card semantics are incomplete: ${JSON.stringify(representative)}`);
  const pointerTargets = await client.evaluate(String.raw`
    (() => {
      const card = document.querySelector(${JSON.stringify(representativeSelector)})?.closest(".game-card");
      const art = card?.querySelector(".game-card-art");
      const titleLink = card?.querySelector("a.game-card-title-link");
      const platformLink = card?.querySelector('.game-card-topline a[href*="/platforms/"]');
      const genreLink = card?.querySelector('a.tag[href*="/genres/"]');
      const evidenceLink = card?.querySelector('.game-card-footer a[href^="http"]');
      card?.scrollIntoView({ block: "center" });
      const anchorAtCenter = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest("a");
      };
      return {
        artUsesPrimaryLink: anchorAtCenter(art) === titleLink,
        platformStaysIndependent: anchorAtCenter(platformLink) === platformLink,
        genreStaysIndependent: anchorAtCenter(genreLink) === genreLink,
        evidenceStaysIndependent: anchorAtCenter(evidenceLink) === evidenceLink,
      };
    })()
  `);
  if (!pointerTargets.artUsesPrimaryLink || !pointerTargets.platformStaysIndependent || !pointerTargets.genreStaysIndependent || !pointerTargets.evidenceStaysIndependent) fail(`catalog card pointer targets are not layered safely: ${JSON.stringify(pointerTargets)}`);

  await client.send("Page.navigate", { url: catalogUrl });
  await waitForCatalogShell(client);
  await client.evaluate('document.querySelector("#catalog-query")?.focus()');
  await waitForCatalogReady(client);
  const baselineSnapshot = await client.evaluate('(() => ({ cardCount: document.querySelectorAll(".game-card").length, summary: document.querySelector(".result-summary")?.textContent ?? "" }))()');
  const baseline = { ...baselineSnapshot, total: catalogResultTotal(baselineSnapshot.summary) };
  if (!(baseline.cardCount > 0) || !Number.isFinite(baseline.total) || baseline.total < baseline.cardCount) fail(`catalog baseline did not expose a bounded result total: ${JSON.stringify(baseline)}`);

  await client.evaluate('document.querySelector(\'input[name="card-columns"][value="3"]\')?.click()');
  await waitFor(() => client.evaluate('new URL(window.location.href).searchParams.get("columns") === "3" && document.querySelector(".game-grid")?.classList.contains("game-grid--columns-3")'));

  const foundPlatform = await client.evaluate('(() => { const disclosure = [...document.querySelectorAll(".browser-disclosure")].find((candidate) => candidate.querySelector("summary")?.textContent?.trim().startsWith("Platforms")); if (!disclosure) return false; disclosure.open = true; const label = [...disclosure.querySelectorAll("label.browser-check")].find((candidate) => candidate.textContent?.includes("PC / Windows")); const input = label?.querySelector("input"); input?.click(); return Boolean(input); })()');
  if (!foundPlatform) fail("catalog browser did not expose the PC platform facet");
  await waitFor(() => client.evaluate('(() => { const chip = [...document.querySelectorAll(".filter-chip")].find((candidate) => candidate.getAttribute("aria-label") === "Remove platform filter: PC / Windows"); return new URL(window.location.href).searchParams.get("platform") === "pc-windows" && document.querySelectorAll(".game-card").length > 0 && chip && document.querySelector(".result-summary")?.textContent?.includes("matching games"); })()'));
  const filteredSnapshot = await client.evaluate('(() => { const chip = [...document.querySelectorAll(".filter-chip")].find((candidate) => candidate.getAttribute("aria-label") === "Remove platform filter: PC / Windows"); return { cardCount: document.querySelectorAll(".game-card").length, layout: document.querySelector(".game-grid")?.className, summary: document.querySelector(".result-summary")?.textContent ?? "", chipLabel: chip?.getAttribute("aria-label") }; })()');
  const filtered = { ...filteredSnapshot, total: catalogResultTotal(filteredSnapshot.summary) };
  if (!(filtered.cardCount > 0) || !Number.isFinite(filtered.total) || filtered.total < filtered.cardCount || filtered.total >= baseline.total || !filtered.layout?.includes("game-grid--columns-3") || !filtered.summary.includes("matching games") || filtered.chipLabel !== "Remove platform filter: PC / Windows") fail(`catalog filtering did not update the visible state or expose a clear removal action: ${JSON.stringify({ baseline, filtered })}`);

  await client.evaluate('(() => { const select = document.querySelector("#catalog-page-size"); if (!select) return; select.value = "12"; select.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await waitFor(() => client.evaluate('new URL(window.location.href).searchParams.get("perPage") === "12" && document.querySelectorAll(".game-card").length === 12'));
  const nextActivated = await client.evaluate('(() => { const next = [...document.querySelectorAll(".catalog-pagination button")].find((button) => button.textContent?.trim() === "Next"); next?.click(); return Boolean(next); })()');
  if (!nextActivated) fail("catalog browser did not render a next-page control after page-size change");
  await waitFor(() => client.evaluate('new URL(window.location.href).searchParams.get("page") === "2" && document.activeElement === document.querySelector(".result-summary")'));
  const pageTwo = await client.evaluate('(() => ({ position: document.querySelector(".game-card-position")?.textContent?.replace(/\\s+/g, " ").trim(), current: document.querySelector(".pagination-button--current")?.getAttribute("aria-current") }))()');
  if (!pageTwo.position?.includes("13") || pageTwo.current !== "page") fail(`catalog pagination did not expose the second-page result state: ${JSON.stringify(pageTwo)}`);

  await client.evaluate('history.back()');
  await waitFor(() => client.evaluate('new URL(window.location.href).searchParams.get("page") !== "2" && document.querySelector(".game-grid")?.classList.contains("game-grid--columns-3") && document.querySelector(\'input[name="card-columns"][value="3"]\')?.checked'));

  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await waitFor(() => client.evaluate('getComputedStyle(document.querySelector(".layout-control")).display === "none" && getComputedStyle(document.querySelector(".layout-mobile-note")).display !== "none"'));
  const mobile = await client.evaluate('(() => { const grid = document.querySelector(".game-grid"); const columns = getComputedStyle(grid).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length; return { columns, urlColumns: new URL(window.location.href).searchParams.get("columns"), overflow: document.documentElement.scrollWidth > window.innerWidth }; })()');
  if (mobile.columns !== 1 || mobile.urlColumns !== "3" || mobile.overflow) fail(`mobile catalog layout is not honest or contained: ${JSON.stringify(mobile)}`);

  await client.send("Emulation.setDeviceMetricsOverride", desktopMetrics);
  await waitFor(() => client.evaluate('getComputedStyle(document.querySelector(".layout-control")).display !== "none" && document.querySelector(\'input[name="card-columns"][value="3"]\')?.checked'));

  await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }, { name: "forced-colors", value: "active" }] });
  const accessibilityState = await client.evaluate('(() => { const layout = document.querySelector(".layout-option--active"); const page = document.querySelector(".pagination-button--current"); const chip = [...document.querySelectorAll(".filter-chip")].find((candidate) => candidate.getAttribute("aria-label") === "Remove platform filter: PC / Windows"); chip?.focus(); const duration = getComputedStyle(document.querySelector(".game-card")).transitionDuration; const durationMs = duration.endsWith("ms") ? Number.parseFloat(duration) : Number.parseFloat(duration) * 1000; return { layoutChecked: document.querySelector(\'input[name="card-columns"][value="3"]\')?.checked, layoutOutline: getComputedStyle(layout).outlineStyle, pageCurrent: page?.getAttribute("aria-current"), pageOutline: getComputedStyle(page).outlineStyle, chipTag: chip?.tagName, chipLabel: chip?.getAttribute("aria-label"), chipOutline: chip ? getComputedStyle(chip).outlineStyle : "none", cardTransitionMs: durationMs }; })()');
  if (!accessibilityState.layoutChecked || accessibilityState.layoutOutline === "none" || accessibilityState.pageCurrent !== "page" || accessibilityState.pageOutline === "none" || accessibilityState.chipTag !== "BUTTON" || accessibilityState.chipLabel !== "Remove platform filter: PC / Windows" || accessibilityState.chipOutline === "none" || accessibilityState.cardTransitionMs > 1) fail(`catalog reduced-motion or forced-colors treatment is incomplete: ${JSON.stringify(accessibilityState)}`);
  await client.send("Emulation.setEmulatedMedia", { features: [] });
  const removalActivated = await client.evaluate('(() => { const chip = [...document.querySelectorAll(".filter-chip")].find((candidate) => candidate.getAttribute("aria-label") === "Remove platform filter: PC / Windows"); chip?.click(); return Boolean(chip); })()');
  if (!removalActivated) fail("catalog browser did not retain the platform filter removal action");
  await waitFor(() => client.evaluate('(() => { const url = new URL(window.location.href); const platformDisclosure = [...document.querySelectorAll(".browser-disclosure")].find((candidate) => candidate.querySelector("summary")?.textContent?.trim().startsWith("Platforms")); const platformInput = [...(platformDisclosure?.querySelectorAll("label.browser-check") ?? [])].find((candidate) => candidate.textContent?.includes("PC / Windows"))?.querySelector("input"); const chip = [...document.querySelectorAll(".filter-chip")].find((candidate) => candidate.getAttribute("aria-label") === "Remove platform filter: PC / Windows"); const page = url.searchParams.get("page"); return !url.searchParams.has("platform") && !chip && !platformInput?.checked && url.searchParams.get("columns") === "3" && url.searchParams.get("perPage") === "12" && (!page || page === "1"); })()'));

  await client.send("Page.navigate", { url: catalogUrl });
  await waitForCatalogShell(client);
  await new Promise((resolve) => setTimeout(resolve, 350));
  const beforeIntersectionRequests = await catalogIndexRequestCount(client);
  if (beforeIntersectionRequests !== 0 || await client.evaluate('document.querySelector(".catalog-browser")?.dataset.catalogIndexStatus !== "idle"')) fail(`catalog index did not remain deferred before intersection: ${JSON.stringify({ beforeIntersectionRequests })}`);
  await client.evaluate('document.querySelector(".catalog-browser")?.scrollIntoView({ block: "start" })');
  await waitForCatalogReady(client);
  const intersectionRequests = await catalogIndexRequestCount(client);
  if (intersectionRequests !== 1) fail(`catalog intersection trigger did not issue exactly one index request: ${intersectionRequests}`);

  const summaryObserver = await client.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const summaries = []; const collect = () => { const summary = document.querySelector(".result-summary")?.textContent?.replace(/\\s+/g, " ").trim(); if (summary && summaries.at(-1) !== summary) summaries.push(summary); }; window.__catalogSummaryHistory = summaries; new MutationObserver(collect).observe(document, { childList: true, subtree: true, characterData: true }); document.addEventListener("DOMContentLoaded", collect, { once: true }); })();` });
  await client.send("Page.navigate", { url: `${catalogUrl}?platform=${encodeURIComponent(deferredPlatformId)}` });
  await waitFor(() => client.evaluate('Boolean(document.querySelector("#catalog-query"))'));
  await waitFor(() => client.evaluate(`document.querySelector(".catalog-browser")?.dataset.catalogIndexStatus === "ready" && new URL(window.location.href).searchParams.get("platform") === ${JSON.stringify(deferredPlatformId)} && document.querySelector(".result-summary")?.textContent?.includes("matching games")`));
  const queryState = await client.evaluate('(() => ({ platform: new URL(window.location.href).searchParams.get("platform"), cards: document.querySelectorAll(".game-card").length, summary: document.querySelector(".result-summary")?.textContent, summaries: window.__catalogSummaryHistory ?? [] }))()');
  await client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: summaryObserver.identifier });
  const queryRequests = await catalogIndexRequestCount(client);
  const expectedQuerySummary = `Showing 1–${Math.min(24, deferredPlatformCount)} of ${deferredPlatformCount} matching games.`;
  const unexpectedMatchingSummaries = queryState.summaries.filter((summary) => /^Showing \d+–\d+ of \d+ matching games\.$/.test(summary) && summary !== expectedQuerySummary);
  if (queryRequests !== 1 || queryState.platform !== deferredPlatformId || !(queryState.cards > 0) || queryState.summary !== expectedQuerySummary || unexpectedMatchingSummaries.length > 0) fail(`catalog full-index-only query route did not retain its filter before the first matching result announcement: ${JSON.stringify({ deferredPlatformId, deferredPlatformCount, queryRequests, queryState, unexpectedMatchingSummaries })}`);

  await client.send("Page.navigate", { url: `${catalogUrl}?utm_source=browser-validation` });
  await waitForCatalogShell(client);
  await new Promise((resolve) => setTimeout(resolve, 350));
  const unrelatedQueryState = await client.evaluate('(() => ({ status: document.querySelector(".catalog-browser")?.dataset.catalogIndexStatus, summary: document.querySelector(".result-summary")?.textContent }))()');
  const unrelatedQueryRequests = await catalogIndexRequestCount(client);
  if (unrelatedQueryState.status !== "idle" || unrelatedQueryRequests !== 0 || !unrelatedQueryState.summary?.includes("Browse or use filters to load the full catalog")) fail(`unrelated URL parameters triggered a catalog index request: ${JSON.stringify({ unrelatedQueryState, unrelatedQueryRequests })}`);

}

async function main() {
  if (!fs.existsSync(outDirectory)) fail("missing out/; run npm run build first");
  const gameDirectory = path.join(root, "data/games");
  const games = fs.readdirSync(gameDirectory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(gameDirectory, file), "utf8")));
  const assets = JSON.parse(fs.readFileSync(path.join(root, "data/assets-manifest.json"), "utf8")).assets ?? [];
  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const approvedEditorialAsset = (game) => game.assets?.find((asset) => {
    const manifest = assetById.get(asset?.provenanceId);
    return asset?.role !== "box-front" && manifest
      && asset.path === manifest.path
      && manifest.assetKind === "generated-original-editorial"
      && manifest.intendedUse === "game-card-thumbnail";
  });
  const fallbackGame = games.find((game) => !game.assets?.some((asset) => asset?.role === "box-front"));
  if (!fallbackGame) fail("no game without a published box front is available for fallback validation");
  const publishedBoxGame = games.find((game) => game.assets?.some((asset) => asset?.role === "box-front"));
  if (!publishedBoxGame) fail("no approved published box-front fixture is available for browser validation");
  const digitalGame = games.find((game) => game.releaseFormat === "digital");
  if (!digitalGame) fail("no digital package fixture is available for browser validation");
  const catalogThumbnailGame = games.find((game) => approvedEditorialAsset(game));
  if (!catalogThumbnailGame) fail("no approved editorial-thumbnail fixture is available for browser validation");
  const catalogThumbnailAsset = approvedEditorialAsset(catalogThumbnailGame);
  const catalogRepresentativeGame = games.find((game) => game.slug === "art-of-rally");
  if (!catalogRepresentativeGame) fail("the curated art-of-rally catalog fixture is required for card interaction validation");
  const catalogSearchRecords = JSON.parse(fs.readFileSync(path.join(root, "public/catalog-search-index.json"), "utf8")).records ?? [];
  const initialCatalogPlatformIds = new Set(catalogSearchRecords.slice(0, 24).flatMap((record) => record.platformIds));
  const deferredCatalogPlatformId = catalogSearchRecords.flatMap((record) => record.platformIds).find((platformId) => !initialCatalogPlatformIds.has(platformId));
  if (!deferredCatalogPlatformId) fail("the catalog index needs a platform absent from the first 24 records for deferred query validation");
  const deferredCatalogPlatformCount = catalogSearchRecords.filter((record) => record.platformIds.includes(deferredCatalogPlatformId)).length;
  if (deferredCatalogPlatformCount < 1) fail("the deferred catalog platform fixture must match at least one record");
  const chrome = chromeCandidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (!chrome) fail("Google Chrome was not found; set CHROME_BIN to a local Chrome executable");

  const preview = await startServer();
  const debugPort = await unusedPort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gameatlas-chrome-profile-"));
  let browser;
  let client;
  try {
    browser = spawn(chrome, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      return response.ok;
    });
    const pageUrl = `http://127.0.0.1:${preview.port}${basePath}/games/${fallbackGame.slug}/`;
    const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(pageUrl)}`, { method: "PUT" });
    if (!targetResponse.ok) fail("Chrome did not create a debugging target");
    const target = await targetResponse.json();
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.open();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await waitFor(() => client.evaluate('Boolean(document.querySelector("[data-game-box-stage]"))'));

    const semantics = await client.evaluate('(() => { const stage = document.querySelector("[data-game-box-stage]"); const fallback = document.querySelector(".game-box__reference-art"); return { role: stage?.getAttribute("role"), label: stage?.getAttribute("aria-label"), describedBy: stage?.getAttribute("aria-describedby"), fallback: document.body.textContent.includes("GameAtlas reference case"), fallbackRole: fallback?.getAttribute("role") }; })()');
    if (semantics.role !== "group" || !semantics.label?.includes("Interactive package view") || !semantics.describedBy || !semantics.fallback || semantics.fallbackRole !== "img") fail("viewer baseline semantics or fallback copy is missing");
    const physicalGeometry = await client.evaluate('(() => { const stage = document.querySelector("[data-game-box-stage]"); const box = document.querySelector(".game-box"); return { kind: stage?.dataset.packageKind, depth: Number(stage?.dataset.packageDepth), restAngle: stage?.dataset.packageRestAngle, hasSpine: Boolean(document.querySelector(".game-box__spine")), transform: box?.style.transform }; })()');
    if (physicalGeometry.kind !== "physical" || physicalGeometry.depth < 8 || physicalGeometry.restAngle !== "-24" || !physicalGeometry.hasSpine || !physicalGeometry.transform?.includes("rotateY(-24deg)")) fail(`physical profile did not render a visible dimensional rest pose: ${JSON.stringify(physicalGeometry)}`);

    await client.evaluate('document.querySelector("[data-game-box-stage]").focus()');
    await press(client, "ArrowRight", "ArrowRight", 39);
    await waitFor(() => client.evaluate('document.querySelector("[data-game-box-stage]").dataset.boxAngle === "90"'));
    await client.evaluate('document.querySelector("[data-box-action=reset]").click()');
    await waitFor(() => client.evaluate('document.querySelector("[data-game-box-stage]").dataset.boxAngle === "0"'));
    for (let index = 0; index < 4; index += 1) await client.evaluate('document.querySelector("[data-box-action=zoom-in]").click()');
    const zoomState = await client.evaluate('(() => { const button = document.querySelector("[data-box-action=zoom-in]"); return { zoom: document.querySelector("[data-game-box-stage]").dataset.boxZoom, disabled: button.disabled }; })()');
    if (zoomState.zoom !== "1.45" || !zoomState.disabled) fail("zoom did not reach its bounded maximum");

    await client.evaluate('document.querySelector(".game-box-viewer").requestFullscreen = () => Promise.reject(new Error("forced fallback"))');
    await client.evaluate('document.querySelector("[data-box-action=fullscreen]").click()');
    await waitFor(() => client.evaluate('document.querySelector(".game-box-viewer").getAttribute("role") === "dialog"'));
    const dialogState = await client.evaluate('(() => { const topbar = document.querySelector(".topbar"); return { modal: document.querySelector(".game-box-viewer").getAttribute("aria-modal"), focusedStage: document.activeElement?.matches("[data-game-box-stage]"), topbarInert: topbar?.hasAttribute("inert"), topbarHidden: topbar?.getAttribute("aria-hidden") }; })()');
    if (dialogState.modal !== "true" || !dialogState.focusedStage || !dialogState.topbarInert || dialogState.topbarHidden !== "true") fail("fullscreen fallback did not create an isolated, focused modal dialog");
    await press(client, "Escape", "Escape", 27);
    await waitFor(() => client.evaluate('document.querySelector(".game-box-viewer").getAttribute("role") !== "dialog"'));
    await waitFor(() => client.evaluate('!document.querySelector(".topbar").hasAttribute("inert") && document.querySelector(".topbar").getAttribute("aria-hidden") === null'));
    await waitFor(() => client.evaluate('document.activeElement?.matches("[data-box-action=fullscreen]")'));

    const publishedFront = publishedBoxGame.assets.find((asset) => asset?.role === "box-front");
    const expectedFrontSrc = `${basePath}/${publishedFront.path.replace(/^public\//, "")}`;
    const publishedPageUrl = `http://127.0.0.1:${preview.port}${basePath}/games/${publishedBoxGame.slug}/`;
    await client.send("Page.navigate", { url: publishedPageUrl });
    await waitFor(() => client.evaluate(`document.querySelector("h1")?.textContent?.trim() === ${JSON.stringify(publishedBoxGame.title)}`));
    const publishedState = await waitFor(async () => {
      const state = await client.evaluate('(() => { const front = document.querySelector(".game-box__front img"); const editorial = document.querySelector(".game-box-stage__editorial-art"); if (!front || !editorial) return null; const resources = performance.getEntriesByType("resource"); const startFor = (element) => { const pathname = new URL(element.src, document.baseURI).pathname; return resources.find((entry) => new URL(entry.name).pathname === pathname)?.startTime; }; return { src: front.getAttribute("src"), loaded: front.complete && front.naturalWidth > 0 && front.naturalHeight > 0, disclosure: document.body.textContent.includes("AI-generated GameAtlas editorial art"), frontLoading: front.getAttribute("loading"), frontDecoding: front.getAttribute("decoding"), frontPriority: front.getAttribute("fetchpriority"), editorialLoading: editorial.getAttribute("loading"), editorialDecoding: editorial.getAttribute("decoding"), editorialPriority: editorial.getAttribute("fetchpriority"), frontBeforeEditorial: Boolean(front.compareDocumentPosition(editorial) & Node.DOCUMENT_POSITION_FOLLOWING), frontStart: startFor(front), editorialStart: startFor(editorial) }; })()');
      return state?.loaded ? state : null;
    });
    if (publishedState.src !== expectedFrontSrc || !publishedState.loaded || !publishedState.disclosure || publishedState.frontLoading !== "eager" || publishedState.frontDecoding !== "async" || publishedState.frontPriority !== "high" || publishedState.editorialLoading !== "lazy" || publishedState.editorialDecoding !== "async" || publishedState.editorialPriority !== "low" || !publishedState.frontBeforeEditorial) fail(`published ${publishedBoxGame.slug} front did not retain governed load scheduling: ${JSON.stringify(publishedState)}`);
    if (typeof publishedState.frontStart === "number" && typeof publishedState.editorialStart === "number" && publishedState.frontStart > publishedState.editorialStart) fail(`primary package front began after editorial reference art: ${JSON.stringify(publishedState)}`);

    const digitalPageUrl = `http://127.0.0.1:${preview.port}${basePath}/games/${digitalGame.slug}/`;
    await client.send("Page.navigate", { url: digitalPageUrl });
    await waitFor(() => client.evaluate(`document.querySelector("h1")?.textContent?.trim() === ${JSON.stringify(digitalGame.title)}`));
    const digitalState = await client.evaluate('(() => { const stage = document.querySelector("[data-game-box-stage]"); return { kind: stage?.dataset.packageKind, depth: stage?.dataset.packageDepth, restAngle: stage?.dataset.packageRestAngle, hasSpine: Boolean(document.querySelector(".game-box__spine")), hasRotate: Boolean(document.querySelector("[data-box-action=rotate-left]")) }; })()');
    if (digitalState.kind !== "digital" || digitalState.depth !== "0" || digitalState.restAngle !== "0" || digitalState.hasSpine || digitalState.hasRotate) fail(`digital profile implied a physical package: ${JSON.stringify(digitalState)}`);

    await client.send("Page.navigate", { url: `http://127.0.0.1:${preview.port}${basePath}/` });
    const catalogSelector = `.game-card-title-link[href="${basePath}/games/${catalogThumbnailGame.slug}/"]`;
    await waitFor(() => client.evaluate(`Boolean(document.querySelector(${JSON.stringify(catalogSelector)})?.closest(".game-card")?.querySelector(".package-thumbnail"))`));
    const thumbnailState = await client.evaluate(`(() => { const titleLink = document.querySelector(${JSON.stringify(catalogSelector)}); const thumbnail = titleLink?.closest(".game-card")?.querySelector(".package-thumbnail"); const object = thumbnail?.querySelector(".package-thumbnail__object"); const image = thumbnail?.querySelector(".package-thumbnail__front img"); return { format: thumbnail?.dataset.packageFormat, kind: thumbnail?.dataset.packageKind, hasSpine: Boolean(thumbnail?.querySelector(".package-thumbnail__spine")), source: image?.getAttribute("src"), loading: image?.getAttribute("loading"), decoding: image?.getAttribute("decoding"), priority: image?.getAttribute("fetchpriority"), transform: object ? getComputedStyle(object).transform : "" }; })()`);
    const expectedThumbnailSuffix = `/${catalogThumbnailAsset.path.replace(/^public\//, "")}`;
    if (!thumbnailState.format || thumbnailState.kind !== "physical" || !thumbnailState.hasSpine || thumbnailState.transform === "none" || !thumbnailState.source?.endsWith(expectedThumbnailSuffix) || thumbnailState.loading !== "lazy" || thumbnailState.decoding !== "async" || thumbnailState.priority === "high") fail(`catalog package thumbnail did not retain approved low-impact loading behavior: ${JSON.stringify(thumbnailState)}`);

    await validateCatalogBrowser(client, `http://127.0.0.1:${preview.port}${basePath}/`, catalogRepresentativeGame, deferredCatalogPlatformId, deferredCatalogPlatformCount);

    await client.send("Page.navigate", { url: pageUrl });
    await waitFor(() => client.evaluate('Boolean(document.querySelector("[data-game-box-stage]"))'));
    await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }, { name: "forced-colors", value: "active" }] });
    const mediaState = await client.evaluate('(() => ({ reduce: matchMedia("(prefers-reduced-motion: reduce)").matches, forced: matchMedia("(forced-colors: active)").matches, duration: getComputedStyle(document.querySelector(".game-box")).transitionDuration, willChange: getComputedStyle(document.querySelector(".game-box")).willChange }))()');
    if (!mediaState.reduce || !mediaState.forced || Number.parseFloat(mediaState.duration) > 0.001 || mediaState.willChange !== "auto") fail(`reduced-motion, forced-colors, or compositor fallback is not active: ${JSON.stringify(mediaState)}`);
    console.log(`Browser validation passed (${fallbackGame.slug} fallback, ${publishedBoxGame ? `${publishedBoxGame.slug} published front` : "no published front"}, front-first image scheduling, package profiles, catalog filters/layout/pagination, mobile layout, keyboard, zoom, fullscreen fallback, focus restoration, background isolation, reduced motion, forced colors).`);
  } finally {
    client?.close();
    if (browser && browser.exitCode === null && browser.signalCode === null) {
      await new Promise((resolve) => {
        browser.once("close", resolve);
        browser.kill("SIGTERM");
      });
    }
    await new Promise((resolve) => preview.server.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
