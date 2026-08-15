export const DEFAULT_BASE_PATH = "/best-nintendo-pc-games";
export const DEFAULT_SITE_ORIGIN = "https://dmoliveira.github.io";
export const DEFAULT_REPOSITORY_URL = "https://github.com/dmoliveira/best-nintendo-pc-games";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function normalizeBasePath(value: string | undefined): string {
  if (!value || value === "/") return "";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  if (/[?#\\]/.test(withLeadingSlash)) throw new Error(`Invalid Pages base path: ${value}`);
  const normalized = stripTrailingSlash(withLeadingSlash);
  const segments = normalized.slice(1).split("/");
  if (!normalized || segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._~-]+$/.test(segment))) throw new Error(`Invalid Pages base path: ${value}`);
  return normalized;
}

function defaultBasePath(env: NodeJS.ProcessEnv): string {
  return env.NODE_ENV === "development" ? "" : DEFAULT_BASE_PATH;
}

function defaultSiteUrl(env: NodeJS.ProcessEnv, basePath: string): string {
  if (env.NODE_ENV === "development") return `http://localhost:3000${basePath}`;
  return `${DEFAULT_SITE_ORIGIN}${basePath}`;
}

function normalizeSiteUrl(value: string, basePath: string, isDevelopment: boolean): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`Invalid site URL: ${value}`); }
  const localDevelopment = isDevelopment && parsed.protocol === "http:" && parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !localDevelopment) throw new Error(`Site URL must use HTTPS: ${value}`);
  if (parsed.username || parsed.password || parsed.search || parsed.hash || stripTrailingSlash(parsed.pathname) !== basePath) throw new Error(`Site URL path or credentials do not match the Pages base path: ${value}`);
  return stripTrailingSlash(parsed.toString());
}

export function createSiteConfig(env: NodeJS.ProcessEnv = process.env) {
  const basePath = normalizeBasePath(env.PAGES_BASE_PATH ?? env.NEXT_PUBLIC_BASE_PATH ?? defaultBasePath(env));
  const configuredUrl = env.SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl(env, basePath);
  const siteUrl = normalizeSiteUrl(configuredUrl, basePath, env.NODE_ENV === "development");

  return {
    basePath,
    siteUrl,
    canonicalUrl: `${siteUrl}/`,
    repositoryUrl: DEFAULT_REPOSITORY_URL,
    correctionUrl: `${DEFAULT_REPOSITORY_URL}/issues/new?template=catalog-correction.yml&title=GameAtlas%20catalog%20correction`,
    publicUrl(path = ""): string {
      const normalizedPath = path.replace(/^\/+/, "");
      return normalizedPath ? `${siteUrl}/${normalizedPath}` : `${siteUrl}/`;
    },
    assetPath(path: string): string {
      const normalizedPath = path.replace(/^\/+/, "");
      return `${basePath}/${normalizedPath}`.replace(/^\/$/, "/");
    },
  };
}

export type SiteConfig = ReturnType<typeof createSiteConfig>;
