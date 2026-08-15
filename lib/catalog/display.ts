import type { PlatformRecord } from "./types";

export type PlatformIconKind = "console" | "handheld" | "hybrid" | "pc";
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
};

export function getPlatformDisplayLabel(platform: Pick<PlatformRecord, "id" | "name" | "aliases">): string {
  return platformDisplayLabels[platform.id] ?? platform.aliases[0] ?? platform.name;
}

export function getPlatformIconKind(platformId: string): PlatformIconKind {
  return platformIconKinds[platformId] ?? (platformId.startsWith("pc-") ? "pc" : "console");
}

export function getGenreTone(genreId: string): GenreTone {
  return genreTones[genreId] ?? "cyan";
}
