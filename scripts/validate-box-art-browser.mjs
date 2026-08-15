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

    const semantics = await client.evaluate('(() => { const stage = document.querySelector("[data-game-box-stage]"); return { role: stage?.getAttribute("role"), label: stage?.getAttribute("aria-label"), describedBy: stage?.getAttribute("aria-describedby"), fallback: document.body.textContent.includes("GameAtlas reference case") }; })()');
    if (semantics.role !== "group" || !semantics.label?.includes("Interactive package view") || !semantics.describedBy || !semantics.fallback) fail("viewer baseline semantics or fallback copy is missing");
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
    const publishedState = await waitFor(() => client.evaluate('(() => { const front = document.querySelector(".game-box__front img"); if (!front) return null; return { src: front.getAttribute("src"), loaded: front.complete && front.naturalWidth > 0 && front.naturalHeight > 0, disclosure: document.body.textContent.includes("AI-generated GameAtlas editorial art") }; })()'));
    if (publishedState.src !== expectedFrontSrc || !publishedState.loaded || !publishedState.disclosure) fail(`published ${publishedBoxGame.slug} front did not load with its base-prefixed source and AI disclosure`);

    const digitalPageUrl = `http://127.0.0.1:${preview.port}${basePath}/games/${digitalGame.slug}/`;
    await client.send("Page.navigate", { url: digitalPageUrl });
    await waitFor(() => client.evaluate(`document.querySelector("h1")?.textContent?.trim() === ${JSON.stringify(digitalGame.title)}`));
    const digitalState = await client.evaluate('(() => { const stage = document.querySelector("[data-game-box-stage]"); return { kind: stage?.dataset.packageKind, depth: stage?.dataset.packageDepth, restAngle: stage?.dataset.packageRestAngle, hasSpine: Boolean(document.querySelector(".game-box__spine")), hasRotate: Boolean(document.querySelector("[data-box-action=rotate-left]")) }; })()');
    if (digitalState.kind !== "digital" || digitalState.depth !== "0" || digitalState.restAngle !== "0" || digitalState.hasSpine || digitalState.hasRotate) fail(`digital profile implied a physical package: ${JSON.stringify(digitalState)}`);

    await client.send("Page.navigate", { url: `http://127.0.0.1:${preview.port}${basePath}/` });
    const catalogSelector = `.game-card-art[href="${basePath}/games/${catalogThumbnailGame.slug}/"] .package-thumbnail`;
    await waitFor(() => client.evaluate(`Boolean(document.querySelector(${JSON.stringify(catalogSelector)}))`));
    const thumbnailState = await client.evaluate(`(() => { const thumbnail = document.querySelector(${JSON.stringify(catalogSelector)}); const object = thumbnail?.querySelector(".package-thumbnail__object"); const image = thumbnail?.querySelector(".package-thumbnail__front img"); return { format: thumbnail?.dataset.packageFormat, kind: thumbnail?.dataset.packageKind, hasSpine: Boolean(thumbnail?.querySelector(".package-thumbnail__spine")), source: image?.getAttribute("src"), transform: object ? getComputedStyle(object).transform : "" }; })()`);
    const expectedThumbnailSuffix = `/${catalogThumbnailAsset.path.replace(/^public\//, "")}`;
    if (!thumbnailState.format || thumbnailState.kind !== "physical" || !thumbnailState.hasSpine || thumbnailState.transform === "none" || !thumbnailState.source?.endsWith(expectedThumbnailSuffix)) fail(`catalog package thumbnail did not render the approved editorial asset in a dimensional physical card: ${JSON.stringify(thumbnailState)}`);

    await client.send("Page.navigate", { url: pageUrl });
    await waitFor(() => client.evaluate('Boolean(document.querySelector("[data-game-box-stage]"))'));
    await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }, { name: "forced-colors", value: "active" }] });
    const mediaState = await client.evaluate('(() => ({ reduce: matchMedia("(prefers-reduced-motion: reduce)").matches, forced: matchMedia("(forced-colors: active)").matches, duration: getComputedStyle(document.querySelector(".game-box")).transitionDuration }))()');
    if (!mediaState.reduce || !mediaState.forced || Number.parseFloat(mediaState.duration) > 0.001) fail(`reduced-motion or forced-colors fallback is not active: ${JSON.stringify(mediaState)}`);
    console.log(`Box-art browser validation passed (${fallbackGame.slug} fallback, ${publishedBoxGame ? `${publishedBoxGame.slug} published front` : "no published front"}, physical rest pose, digital flat mode, catalog thumbnails, keyboard, zoom, fullscreen fallback, focus restoration, background isolation, reduced motion, forced colors).`);
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
