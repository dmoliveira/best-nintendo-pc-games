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

const genreTones: Record<string, GenreTone> = {
  action: "coral",
  adventure: "cyan",
  platformer: "lime",
  puzzle: "violet",
  simulation: "amber",
  racing: "coral",
  "role-playing": "violet",
};

export function getPlatformIconKind(platformId: string): PlatformIconKind {
  return platformIconKinds[platformId] ?? (platformId.startsWith("pc-") ? "pc" : "console");
}

export function getGenreTone(genreId: string): GenreTone {
  return genreTones[genreId] ?? "cyan";
}
