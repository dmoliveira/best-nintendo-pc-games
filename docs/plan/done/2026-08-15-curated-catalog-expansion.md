# Curated catalog expansion

**Status:** completed
**Date:** 2026-08-15
**Scope:** GameAtlas editorial catalog data, original abstract art, source policy, and catalog assertions

## Goal

Maximize useful catalog breadth within the existing Nintendo-family and Windows PC scope without claiming exhaustive worldwide coverage or introducing unlicensed scores, review text, screenshots, or box art.

The delivery target is **60 new, individually reviewed editorial records**, expanding the catalog from 43 to **103** games. This is a substantial curated expansion, not a claim that every eligible game has been cataloged.

## Canonical candidate inventory

[`data/curation/2026-08-15-curated-catalog-expansion.json`](../../../data/curation/2026-08-15-curated-catalog-expansion.json) is the single source of truth for this batch. It names exactly 60 unique slugs and, for each one, records the canonical title, selected-platform release year, primary platform, existing genre IDs, developer/publisher, original GameAtlas copy, and title-specific outbound URL/source.

The inventory is platform-balanced as follows:

| Platform | New records | Resulting depth |
| --- | ---: | ---: |
| NES | 4 | 5 |
| SNES | 5 | 6 |
| Nintendo 64 | 3 | 7 |
| GameCube | 4 | 8 |
| Wii | 4 | 8 |
| Wii U | 4 | 8 |
| Switch | 5 | 6 |
| Switch 2 | 2 | 4 |
| Game Boy | 3 | 4 |
| Game Boy Color | 2 | 6 |
| Game Boy Advance | 4 | 5 |
| Nintendo DS | 5 | 6 |
| Nintendo DSi | 2 | 5 |
| Nintendo 3DS | 4 | 5 |
| New Nintendo 3DS | 2 | 3 |
| Windows PC | 7 | 17 |

The New Nintendo 3DS remains deliberately smaller because it has a narrow exclusive library; the catalog does not pad it with ordinary compatible 3DS releases.

## Selection and source rules

- Keep the existing canonical platforms and seven genre IDs; do not force strategy, sports, fighting, or rhythm titles into unrelated categories.
- Add durable editorial picks that improve thin platform coverage and provide meaningful genre/platform discovery.
- Every record uses original GameAtlas copy, exactly one `GameAtlas` `original-editorial` signal, a valid title-specific official/store/reference URL, and one manifest-backed original abstract SVG tile.
- Retain the no-numeric policy: no cached critic, user, popularity, or sales values; external pages remain outbound links only.
- Prefer title-specific first-party/store links. Historical entries may use Nintendo Life only as a documented, same-edition fallback title reference when a durable first-party historical page is unavailable. That source must continue to forbid scores, review prose, images, or local provider-content ingestion and carry fresh review/decision evidence.
- The inventory's `review.copyPolicy` attests that every description, highlight, and rationale is independently authored. The final data review must spot-check every group against the linked page and reject text that appears copied or closely paraphrased.

## Delivery batches

1. **Legacy home (16):** NES, SNES, Nintendo 64, GameCube.
2. **Modern home (15):** Wii, Wii U, Switch, Switch 2.
3. **Legacy handheld (14):** Game Boy, Game Boy Color, Game Boy Advance, Nintendo DS.
4. **Modern handheld and PC (15):** Nintendo DSi, Nintendo 3DS, New Nintendo 3DS, Windows PC.

A deterministic local generator will materialize records, tiles, and manifest entries from the canonical inventory. After each group, run `npm run validate:rights` and `npm run validate:catalog`; after the final group, run the focused expansion tests and the full validation bundle.

## Enforced acceptance criteria

- A focused test reads the inventory and proves it has exactly 60 unique candidates, each represented once in `data/games/`, with matching title/platform/genres and link URL.
- All 103 records have one editorial-only signal; the 60 additions have no critic, user, sales, popularity, score, count, rank, or value fields.
- Every supported platform has at least three records. Set `coverage.minimumHubRecords` to `3` and assert all 16 platform hubs resolve.
- Every catalog game has exactly one local game-card asset. Asset paths and provenance IDs are unique across all 103 games and each resolves one-to-one to the manifest.
- The 60 inventory URLs are title-specific `https` URLs with a supported `official` or `reference` kind. Review them in grouped live-link checks; if a host rejects automated requests, record the response and retain only the title-specific browser-facing destination.
- No new numeric evidence, provider text, third-party artwork, or unmanifested asset is introduced.
- `npm run validate:catalog-expansion`, `npm run validate:rights`, `npm run validate:catalog`, `npm test`, and `make validate` pass.

## Outcome

Completed as a 103-record catalog: 60 original editorial picks now add balanced depth across all 16 supported Nintendo and Windows PC platform families. Every addition has one deterministic, manifest-backed abstract SVG, nonnumeric GameAtlas editorial evidence, and a title-specific outbound link.

Validation completed with the full local bundle, the static export gate, browser fallback smoke, and a 60-link HEAD review (39 Nintendo Life references and 21 official pages, all HTTP 200 at review time).

## Risk and review budget

This is a **medium-risk, large data slice**. Complete two independent review/fix passes—one focused on data/evidence/asset policy and one on generated output/UI regressions—then obtain final verifier validation. Data correctness and rights-policy conformance take precedence over marginal title volume.
