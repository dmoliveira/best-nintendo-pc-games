import type { ReactNode } from "react";
import { getPlatformAccentKind, getPlatformIconKind, type PlatformAccentKind, type PlatformIconKind } from "@/lib/catalog/display";

interface PlatformGlyphProps {
  platformId: string;
  className?: string;
}

const devicePaths: Record<PlatformIconKind, ReactNode> = {
  console: <><rect x="4" y="6" width="16" height="11" rx="2" /><path d="M8 20h8M12 17v3" /><circle cx="16.5" cy="10.5" r="1" /><path d="M7 10.5h3M8.5 9v3" /></>,
  handheld: <><rect x="5" y="3" width="14" height="18" rx="3" /><rect x="8" y="6" width="8" height="6" rx="1" /><path d="M8.5 16h3M10 14.5v3M14.5 16h.01M16 17.5h.01" /></>,
  hybrid: <><rect x="7" y="4" width="10" height="16" rx="2" /><path d="M4 7v10M20 7v10M4 9h2M18 9h2M4 15h2M18 15h2" /><circle cx="14.5" cy="8" r=".8" /></>,
  pc: <><rect x="4" y="4" width="16" height="11" rx="1.5" /><path d="M8 20h8M12 15v5" /><circle cx="17" cy="12" r=".7" /></>,
};

const accentPaths: Record<PlatformAccentKind, ReactNode> = {
  signal: <path d="M2.5 5.5h2M2.5 8h2M19.5 16h2M19.5 18.5h2" />,
  orbit: <><circle cx="18.25" cy="5.75" r="1.1" /><path d="M15.8 5.75h1.3" /></>,
  prism: <path d="m18 3.2 2.1 2.1L18 7.4l-2.1-2.1L18 3.2Z" />,
  wave: <path d="M2.6 5.9c1.1-1 2.3-1 3.4 0s2.3 1 3.4 0" />,
  frame: <path d="M2.8 5.8V3.6H5M19 3.6h2.2v2.2" />,
  bridge: <path d="M3 4.2h3M18 4.2h3M12 2.8v2.8" />,
  spark: <path d="M18.1 3.2v4.4M15.9 5.4h4.4" />,
  grid: <path d="M2.8 3.3h3M2.8 5.6h3M18.2 18.4h3M18.2 20.7h3" />,
};

export default function PlatformGlyph({ platformId, className }: PlatformGlyphProps) {
  const kind = getPlatformIconKind(platformId);
  const accent = getPlatformAccentKind(platformId);
  return <svg className={`platform-glyph platform-glyph--${kind}${className ? ` ${className}` : ""}`} data-platform-accent={accent} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">{devicePaths[kind]}<g className={`platform-glyph__accent platform-glyph__accent--${accent}`}>{accentPaths[accent]}</g></svg>;
}
