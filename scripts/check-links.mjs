import dns from "node:dns";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { buildMaintenanceUrlInventory } from "./maintenance-url-inventory.mjs";

const DEFAULT_CONCURRENCY = 6;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

function parseIpv4(value) {
  const parts = value.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function privateIpv4(value) {
  const parts = parseIpv4(value);
  if (!parts) return false;
  const [first, second, third] = parts;
  return first === 0 || first === 10 || first === 127 || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && (second === 0 || second === 168)) || (first === 198 && (second === 18 || second === 19 || second === 51))
    || (first === 192 && second === 88 && third === 99) || (first === 203 && second === 0 && third === 113) || first >= 224;
}

function ipv6Words(value) {
  let normalized = value.toLowerCase().split("%")[0];
  if (normalized.includes(".")) {
    const separator = normalized.lastIndexOf(":");
    const ipv4 = parseIpv4(normalized.slice(separator + 1));
    if (!ipv4) return null;
    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    normalized = `${normalized.slice(0, separator + 1)}${high}:${low}`;
  }
  const sections = normalized.split("::");
  if (sections.length > 2) return null;
  const left = sections[0] ? sections[0].split(":") : [];
  const right = sections.length === 2 && sections[1] ? sections[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((sections.length === 1 && missing !== 0) || (sections.length === 2 && missing < 1)) return null;
  const words = [...left, ...Array.from({ length: missing }, () => "0"), ...right].map((word) => Number.parseInt(word, 16));
  return words.length === 8 && words.every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffff) ? words : null;
}

function privateIpv6(value) {
  const words = ipv6Words(value);
  if (!words) return false;
  const first = words[0];
  const allZero = words.every((word) => word === 0);
  const loopback = words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  const mappedIpv4 = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (allZero || loopback || (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00) return true;
  if (mappedIpv4) return privateIpv4(`${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`);
  return words.slice(0, 6).every((word) => word === 0) || (first & 0xffc0) === 0xfec0 || (first === 0x2001 && words[1] === 0x0db8) || (first === 0x2001 && words[1] === 0x0002);
}

function publicIp(value) {
  const hostname = value.toLowerCase().replace(/^\[|\]$/g, "");
  const family = net.isIP(hostname);
  if (family === 4) return !privateIpv4(hostname);
  if (family !== 6) return false;
  const words = ipv6Words(hostname);
  if (!words) return false;
  const mappedIpv4 = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (mappedIpv4) return !privateIpv4(`${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`);
  return words[0] >= 0x2000 && words[0] <= 0x3fff && !privateIpv6(hostname);
}

export function validatePublicUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:") return { ok: false, reason: "non-HTTPS URL" };
  if (url.username || url.password) return { ok: false, reason: "URL contains credentials" };
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal") || (net.isIP(hostname) && !publicIp(hostname))) return { ok: false, reason: "private or local host" };
  return { ok: true, url };
}

function result(url, status, reason, responseStatus) {
  return { url, status, reason, responseStatus };
}

function classifyResponse(url, response) {
  if (response.status >= 200 && response.status < 400) return result(url, "pass", `HTTP ${response.status}`, response.status);
  if (response.status === 401 || response.status === 403 || response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500) return result(url, "warn", `HTTP ${response.status}`, response.status);
  if (response.status >= 400 && response.status < 500) return result(url, "fail", `HTTP ${response.status}`, response.status);
  return result(url, "warn", `HTTP ${response.status}`, response.status);
}

async function request(fetchImpl, url, method, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { method, redirect: "manual", signal: controller.signal, headers: { "user-agent": "GameAtlas-link-check/1.0" } });
  } catch (error) {
    return { error: error?.name === "AbortError" ? "timeout" : "network error" };
  } finally {
    clearTimeout(timer);
  }
}

function publicLookup(hostname, _options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) {
      callback(error);
      return;
    }
    if (!addresses.length || addresses.some(({ address }) => !publicIp(address))) {
      const privateHostError = new Error("private or local host");
      privateHostError.code = "ERR_PRIVATE_OR_LOCAL_HOST";
      callback(privateHostError);
      return;
    }
    if (_options?.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

async function requestHttps(url, method, timeoutMs) {
  return new Promise((resolve) => {
    const request = https.request(new URL(url), {
      method,
      headers: { "user-agent": "GameAtlas-link-check/1.0" },
      lookup: publicLookup,
    }, (response) => resolve({
      status: response.statusCode ?? 0,
      headers: { get: (name) => {
        const value = response.headers[name.toLowerCase()];
        return Array.isArray(value) ? value[0] ?? null : value ?? null;
      } },
      body: { cancel: () => response.resume() },
    }));
    request.setTimeout(timeoutMs, () => {
      const timeoutError = new Error("timeout");
      timeoutError.code = "ETIMEDOUT";
      request.destroy(timeoutError);
    });
    request.once("error", (error) => resolve({
      error: error?.code === "ERR_PRIVATE_OR_LOCAL_HOST" ? "private or local host" : error?.code === "ETIMEDOUT" ? "timeout" : "network error",
      errorStatus: error?.code === "ERR_PRIVATE_OR_LOCAL_HOST" ? "fail" : "warn",
    }));
    request.end();
  });
}

async function disposeResponse(response) {
  try { await response.body?.cancel?.(); } catch { /* best effort before the next request */ }
}

export async function checkUrl(input, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const initial = validatePublicUrl(input);
  if (!initial.ok) return result(input, "fail", initial.reason);
  let current = initial.url;
  let method = "HEAD";
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = options.fetchImpl ? await request(options.fetchImpl, current, method, timeoutMs) : await requestHttps(current, method, timeoutMs);
    if (response.error) return result(input, response.errorStatus === "fail" ? "fail" : "warn", response.error);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.get?.("location");
      if (!location) {
        await disposeResponse(response);
        return result(input, "warn", `HTTP ${response.status} redirect without location`, response.status);
      }
      let redirected;
      try { redirected = new URL(location, current).toString(); } catch {
        await disposeResponse(response);
        return result(input, "fail", "redirect: invalid URL", response.status);
      }
      const next = validatePublicUrl(redirected);
      if (!next.ok) {
        await disposeResponse(response);
        return result(input, "fail", `redirect: ${next.reason}`, response.status);
      }
      if (redirects === MAX_REDIRECTS) {
        await disposeResponse(response);
        return result(input, "warn", "redirect limit exceeded", response.status);
      }
      await disposeResponse(response);
      current = next.url;
      method = "HEAD";
      continue;
    }
    if ((response.status === 405 || response.status === 501 || (response.status === 403 && method === "HEAD")) && method === "HEAD") {
      await disposeResponse(response);
      method = "GET";
      continue;
    }
    await disposeResponse(response);
    return classifyResponse(input, response);
  }
  return result(input, "warn", "redirect limit exceeded");
}

export async function checkInventory(inventory, options = {}) {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, 16));
  const results = [];
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < inventory.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = { ...await checkUrl(inventory[index].url, options), sources: inventory[index].sources };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, inventory.length) }, () => worker()));
  return results.sort((left, right) => left.url.localeCompare(right.url));
}

async function main() {
  const inventory = buildMaintenanceUrlInventory(process.cwd());
  const results = await checkInventory(inventory);
  const counts = results.reduce((all, item) => ({ ...all, [item.status]: (all[item.status] ?? 0) + 1 }), {});
  console.log(`Link check: ${counts.pass ?? 0} pass, ${counts.warn ?? 0} warn, ${counts.fail ?? 0} fail across ${results.length} URLs.`);
  for (const item of results.filter((entry) => entry.status !== "pass")) console.log(`${item.status.toUpperCase()} ${item.url} — ${item.reason} (${item.sources.join(", ")})`);
  if ((counts.fail ?? 0) > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${path.resolve(process.argv[1])}`) main().catch((error) => { console.error(error.message); process.exitCode = 2; });
