# Catalog visual system

GameAtlas uses a vector-first visual system for platform and metadata context.
It provides a compact, responsive marker beside the existing text label without
copying a console, publisher, developer, game, or store mark.

## What ships

- `PlatformGlyph` combines one existing **generic** device category with a
  small abstract accent selected from the platform ID.
- `AttributeGlyph` supplies generic studio, publisher, genre, year, digital,
  and physical-release symbols beside visible metadata text.
- Taxonomy headers use a discriminated platform-or-genre visual selector.

The glyphs are inline React SVG code rather than public image files. They are
covered by the `emoji-and-generic-glyph` policy as platform, card, and metadata
markers; they are not a replacement for an official mark and have no standalone
meaning. Every instance is `aria-hidden`, non-focusable, and paired with a
visible text label.

## Rights and originality gate

Do not add official logos, wordmarks, product silhouettes, controller-button
layouts, screen arrangements, docks, trade dress, screenshots, box art, or
company-specific monograms. New glyph paths must remain category-generic and
independently authored.

Initial review recorded 2026-08-15: the platform marks retain the existing
generic console/handheld/hybrid/PC base and add only abstract signal, orbit,
prism, wave, frame, bridge, spark, or grid accents. The metadata marks are
generic editorial symbols. No third-party marks, identifying hardware outlines,
or raster asset files are included.

Before changing a glyph, perform and record a visual review against this list:

1. It does not identify a specific product or company without the adjacent text.
2. It has no copied proportions, badge, logo, or signature control layout.
3. Its meaning remains available in visible text and the SVG stays decorative.
4. It remains legible with `currentColor`, forced colors, and at 16 px.

## Codex Image decision

`codex-image` is configured and its zero-cost dry-run accepts a text-free,
non-branded original editorial tile request. It is deliberately not used for
this glyph system: a raster grid would download unused cells, cannot safely
provide individual responsive meaning, and creates extra provenance/review
work. Use the governed box-art workflow only for an approved, text-free,
abstract editorial image where a raster focal image adds value.
