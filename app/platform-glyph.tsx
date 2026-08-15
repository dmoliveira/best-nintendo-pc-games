import type { ReactNode } from "react";
import { getPlatformIconKind, type PlatformIconKind } from "@/lib/catalog/display";

interface PlatformGlyphProps {
  platformId: string;
  className?: string;
}

const paths: Record<PlatformIconKind, ReactNode> = {
  console: <><rect x="4" y="6" width="16" height="11" rx="2" /><path d="M8 20h8M12 17v3" /><circle cx="16.5" cy="10.5" r="1" /><path d="M7 10.5h3M8.5 9v3" /></>,
  handheld: <><rect x="5" y="3" width="14" height="18" rx="3" /><rect x="8" y="6" width="8" height="6" rx="1" /><path d="M8.5 16h3M10 14.5v3M14.5 16h.01M16 17.5h.01" /></>,
  hybrid: <><rect x="7" y="4" width="10" height="16" rx="2" /><path d="M4 7v10M20 7v10M4 9h2M18 9h2M4 15h2M18 15h2" /><circle cx="14.5" cy="8" r=".8" /></>,
  pc: <><rect x="4" y="4" width="16" height="11" rx="1.5" /><path d="M8 20h8M12 15v5" /><circle cx="17" cy="12" r=".7" /></>,
};

export default function PlatformGlyph({ platformId, className }: PlatformGlyphProps) {
  const kind = getPlatformIconKind(platformId);
  return <svg className={`platform-glyph platform-glyph--${kind}${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">{paths[kind]}</svg>;
}
