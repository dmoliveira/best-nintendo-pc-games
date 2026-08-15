export const DEFAULT_BASE_PATH = "/best-nintendo-pc-games";
export const DEFAULT_SITE_ORIGIN = "https://dmoliveira.github.io";
export const DEFAULT_REPOSITORY_URL = "https://github.com/dmoliveira/best-nintendo-pc-games";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function normalizeBasePath(value: string | undefined): string {
  if (!value || value === "/") return "";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return stripTrailingSlash(withLeadingSlash);
}

function defaultBasePath(env: NodeJS.ProcessEnv): string {
  return env.NODE_ENV === "development" ? "" : DEFAULT_BASE_PATH;
}

function defaultSiteUrl(env: NodeJS.ProcessEnv, basePath: string): string {
  if (env.NODE_ENV === "development") return `http://localhost:3000${basePath}`;
  return `${DEFAULT_SITE_ORIGIN}${basePath || DEFAULT_BASE_PATH}`;
}

export function createSiteConfig(env: NodeJS.ProcessEnv = process.env) {
  const basePath = normalizeBasePath(env.PAGES_BASE_PATH ?? env.NEXT_PUBLIC_BASE_PATH ?? defaultBasePath(env));
  const configuredUrl = env.SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl(env, basePath);
  const siteUrl = stripTrailingSlash(configuredUrl);

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
