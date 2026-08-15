import type { ReactNode } from "react";

export type AttributeGlyphKind = "studio" | "publisher" | "genre" | "year" | "digital" | "physical";

interface AttributeGlyphProps {
  kind: AttributeGlyphKind;
  className?: string;
}

// Generic editorial symbols only. These augment nearby text labels; they never
// stand in for a developer, publisher, platform, or product brand mark.
const paths: Record<AttributeGlyphKind, ReactNode> = {
  studio: <><path d="M4 20V10l4-3 4 3v10" /><path d="M14 20V5h6v15M7 13h2M7 16h2M16 9h2M16 13h2M16 17h2" /></>,
  publisher: <><rect x="4" y="4" width="13" height="15" rx="1.5" /><path d="M8 8h5M8 12h5M18 9v9M18 18l3-3-3-3" /></>,
  genre: <><path d="m4 5 8 0 7 7-7 7-8 0Z" /><circle cx="8" cy="9" r="1" /></>,
  year: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M13 14h3" /></>,
  digital: <><path d="M7 18h10a3 3 0 0 0 .4-5.97A5.5 5.5 0 0 0 7.1 10.3 3.9 3.9 0 0 0 7 18Z" /><path d="M12 8v7M9.5 12.5 12 15l2.5-2.5" /></>,
  physical: <><path d="M5 5h14v14H5Z" /><path d="M8 5v4h8V5M8 14h8M8 17h4" /></>,
};

export default function AttributeGlyph({ kind, className }: AttributeGlyphProps) {
  return <svg className={`attribute-glyph attribute-glyph--${kind}${className ? ` ${className}` : ""}`} data-attribute-glyph={kind} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">{paths[kind]}</svg>;
}
