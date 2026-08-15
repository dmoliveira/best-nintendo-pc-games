import type { PlatformRecord } from "./types";

export type PlatformIconKind = "console" | "handheld" | "hybrid" | "pc";
export type PlatformAccentKind = "signal" | "orbit" | "prism" | "wave" | "frame" | "bridge" | "spark" | "grid";
export type GenreTone = "amber" | "coral" | "cyan" | "lime" | "violet";

const platformIconKinds: Record<string, PlatformIconKind> = {
  "nintendo-nes": "console",
  "nintendo-snes": "console",
  "nintendo-64": "console",
  "nintendo-gamecube": "console",
  "nintendo-wii": "console",
  "nintendo-wii-u": "console",
  "nintendo-switch": "hybrid",
  "nintendo-switch-2": "hybrid",
  "game-boy": "handheld",
  "game-boy-color": "handheld",
  "game-boy-advance": "handheld",
  "nintendo-ds": "handheld",
  "nintendo-dsi": "handheld",
  "nintendo-3ds": "handheld",
  "nintendo-new-3ds": "handheld",
  "pc-windows": "pc",
};

// These marks are intentionally abstract accents applied to a generic device
// glyph. They identify a catalog category without copying hardware silhouettes,
// logos, controller layouts, or other third-party trade dress.
const platformAccentKinds: Record<string, PlatformAccentKind> = {
  "nintendo-nes": "signal",
  "nintendo-snes": "orbit",
  "nintendo-64": "prism",
  "nintendo-gamecube": "prism",
  "nintendo-wii": "wave",
  "nintendo-wii-u": "frame",
  "nintendo-switch": "bridge",
  "nintendo-switch-2": "bridge",
  "game-boy": "signal",
  "game-boy-color": "orbit",
  "game-boy-advance": "spark",
  "nintendo-ds": "frame",
  "nintendo-dsi": "grid",
  "nintendo-3ds": "prism",
  "nintendo-new-3ds": "spark",
  "pc-windows": "grid",
};

const fallbackAccentByIconKind: Record<PlatformIconKind, PlatformAccentKind> = {
  console: "signal",
  handheld: "orbit",
  hybrid: "bridge",
  pc: "grid",
};

const platformDisplayLabels: Record<string, string> = {
  "nintendo-nes": "NES",
  "nintendo-snes": "SNES",
  "nintendo-64": "N64",
  "nintendo-gamecube": "GameCube",
  "nintendo-wii": "Wii",
  "nintendo-wii-u": "Wii U",
  "nintendo-switch": "Switch",
  "nintendo-switch-2": "Switch 2",
  "game-boy": "Game Boy",
  "game-boy-color": "Game Boy Color",
  "game-boy-advance": "GBA",
  "nintendo-ds": "DS",
  "nintendo-dsi": "DSi",
  "nintendo-3ds": "3DS",
  "nintendo-new-3ds": "New 3DS",
  "pc-windows": "PC / Windows",
};

const genreTones: Record<string, GenreTone> = {
  action: "coral",
  adventure: "cyan",
  platformer: "lime",
  puzzle: "violet",
  simulation: "amber",
  racing: "coral",
  "role-playing": "violet",
  strategy: "amber",
  fighting: "coral",
  shooter: "coral",
  sports: "lime",
  rhythm: "violet",
  horror: "violet",
  stealth: "cyan",
  "visual-novel": "violet",
  sandbox: "lime",
  party: "amber",
  survival: "amber",
  educational: "cyan",
  arcade: "coral",
};

export function getPlatformDisplayLabel(platform: Pick<PlatformRecord, "id" | "name" | "aliases">): string {
  return platformDisplayLabels[platform.id] ?? platform.aliases[0] ?? platform.name;
}

export function getPlatformIconKind(platformId: string): PlatformIconKind {
  return platformIconKinds[platformId] ?? (platformId.startsWith("pc-") ? "pc" : "console");
}

export function getPlatformAccentKind(platformId: string): PlatformAccentKind {
  return platformAccentKinds[platformId] ?? fallbackAccentByIconKind[getPlatformIconKind(platformId)];
}

export function getGenreTone(genreId: string): GenreTone {
  return genreTones[genreId] ?? "cyan";
}
