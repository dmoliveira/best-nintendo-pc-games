# Correct catalog platform chronology semantics

**Status:** complete
**Date:** 2026-08-15
**Risk / depth:** high / large
**Scope:** platform/date data semantics, deterministic chronology audit, generated catalog validation, search/card/detail wording, and source policy

## Problem

The 897 generated records independently combine an earliest Wikidata `P577` title date with a Wikidata `P400` platform association. The current UI places them together, which can read as a platform release claim. The user correctly found examples such as a 2013 `Tomb Raider` record on Nintendo Switch 2, whose earliest platform debut is 2025.

A local audit using documented platform debut years finds **153** title-year/platform associations where the title's earliest documented year precedes the platform debut. Those are not automatically incorrect: they can represent ports, re-releases, backwards-compatible listings, or incomplete Wikidata statements. They are evidence gaps/semantic ambiguity, not grounds to invent a platform release date or remove a title.

## Decision

Preserve the exact 1,000 identities and source-listed `P400` associations. Correct the false implication instead of filtering/reassigning legitimate later ports:

1. Define generated `release.year` as an **earliest documented title release** derived from `P577`, never a platform-release year.
2. Present generated platform membership as a **Wikidata-listed platform**. Only a separately qualified/verified source may establish a platform-specific release date in a future slice.
3. Add a reviewed platform-debut registry and a deterministic frozen audit of every title year that precedes its source-listed platform debut. The audit is informational and explicit; it must not manufacture availability or date facts.
4. Remove the unsupported Switch 2 description that claims native releases/platform-specific official pages. Keep current Switch 2 entries only as source-listed associations unless later evidence supports a dated platform release.

## Evidence policy

- `wdt:P577` / `MIN(P577)` is an earliest global title-release value, not platform-specific evidence.
- `wdt:P400` is a Wikidata-listed platform relationship, not a native-release or date claim.
- Platform-specific Wikidata dates require a full `p:P577` statement with `ps:P577` and matching `pq:P400`; absence means **not recorded**, not absent availability.
- The chronology registry uses earliest known market debut years only as a review guard. It never converts a platform debut into a game's date.
- Nintendo debut data uses the Nintendo corporate history page, with the Switch 2 official 2025 announcement. Game Boy Color and Windows use recorded Wikidata structured-data source links until a primary source is retained.

## Planned implementation

1. Add `data/platform-chronology.json` with all 16 catalog platform IDs, their Wikidata IDs, earliest known debut year, evidence URL, and a scope/caveat.
2. Add a deterministic `generate-platform-chronology-audit` script with `--write` and `--check` modes. It writes a frozen curation audit containing every association whose **title** year predates platform debut, including its classification and no inferred platform date.
3. Add a `validate:catalog-chronology` gate that validates the registry/audit closure, all 1,000 records, expected generated-source semantics, and the known Switch 2 examples. Wire it into `make validate`.
4. Mark generated records' release scope as `earliest-title-release`; enforce it in the inventory/generator/catalog-1000 validator without changing QIDs, slugs, quotas, assets, or record count.
5. Update cards, filters, sort labels, detail pages, platform copy, and source documentation so a title year is visibly labeled as a title release and a generated platform is explicitly source-listed. Do not emit wording such as "released on", "native", or "available on" without separately recorded evidence.
6. Add regression tests for title-year-before-debut cases, Switch 2 wording, audit closure, deterministic generation, and unchanged 1,000-record/search/static-export limits.

## Non-goals

- Do not delete/reassign titles merely because their earliest title release predates a platform.
- Do not claim platform-specific release dates from global `P577`, platform debut years, or unqualified `P400` statements.
- Do not re-query or mutate the 897-QID selection during this fix.
- Do not alter the 103 pre-existing curated records beyond shared UI labels/policy behavior.

## Acceptance criteria

- Every generated title year is explicitly scoped as an earliest title release.
- Every generated P400 platform is visibly and accessibly labeled as source-listed, not as a dated/native platform release.
- The chronology registry covers all 16 platform IDs and cites source evidence/caveats.
- The frozen audit deterministically reports all qualifying associations (currently 153) and includes the four Switch 2 examples.
- Existing exact-count, QID, asset, source, rights, digest, search, and export contracts remain green.
- `make validate`, targeted chronology tests, full static export, and final review pass.

## Validation plan

```sh
npm run validate:catalog-chronology
npm run validate:catalog-1000
npm run validate:catalog-search-index
npm test
npm run lint
npm run typecheck
make validate
```

## Plan-review amendments: semantic/API contract

### Resolved per-record semantics

The raw catalog and public search projection use these two fields:

| Record class | `release.scope` | `platformAssociationScope` | Presentation |
| --- | --- | --- | --- |
| 897 frozen Wikidata-generated records | `earliest-title-release` | `source-listed` | “Earliest documented title release” and “Wikidata-listed platform” |
| Existing curated records | legacy raw field absent; resolved as `platform-release` | resolved as `verified-release` | retain platform-release wording |

`release.scope` is an optional `GameRelease` discriminant with only `earliest-title-release` and `platform-release`. `platformAssociationScope` is an optional `GameRecord` discriminant with only `source-listed` and `verified-release`. The generator writes both explicitly for all 897 generated records. The catalog resolver derives the legacy curated defaults only for records that do not include `wikidata-fact-reference`; validators reject a Wikidata-generated record missing either explicit generated semantic.

The public `CatalogSearchRecord` always exposes resolved `releaseScope` and `platformAssociationScope`. Its envelope moves from schema version 1 to schema version 2; the parser accepts only v2 and fails closed for v1/unknown shapes. Server generation, client parsing, public index tests, cache-busting digest, static output, cards, filters, and sort labels change together.

### Immutable factual projection

Before changing generated semantics, freeze `data/curation/2026-08-15-catalog-fact-snapshot.json`. Its stable, sorted 1,000-record projection includes slug, title, release year, platform IDs, genre IDs, source IDs, asset path/provenance IDs, plus generated QID/entity URL. A check script recomputes it after generation. Any change outside the new semantic fields, copy wording, search schema, audit metadata, and approved docs is a failure.

### Machine-readable debut evidence

`data/platform-chronology.json` contains exactly 16 entries with platform ID, matching Wikidata platform QID, earliest-known market debut year, source ID, HTTPS evidence URL, reviewed date, scope, and caveat. It does not state an individual game's availability.

- Add a first-party `nintendo-platform-history` source-policy record authorizing `platformDebutYear`, with review/recheck metadata and the Nintendo corporate-history/official Switch 2 release links.
- Extend `wikidata-fact-reference` with the explicit structured-data field `wikidataPlatformDebutYear` for the Game Boy Color and Windows guard entries; retain its CC0 structured-data caveats.
- Extend `validate:rights` to require both contracts and validate the chronology registry's source IDs/URLs/dates/QIDs.

### Neutral audit contract

The generated audit has one sorted row per qualifying association with only:

```json
{
  "slug": "tomb-raider",
  "titleReleaseYear": 2013,
  "platformId": "nintendo-switch-2",
  "platformDebutYear": 2025,
  "platformReleaseYear": null,
  "interpretation": "unresolved"
}
```

No row may call an item a port, re-release, compatible, native, available, or platform-released. The audit is recomputed from the frozen records plus registry; it has a reviewed count of 153 only while the input digests are unchanged. Validation requires exact closure, no duplicate/stale rows, all-null platform release years, and the named Switch 2 fixtures: Tomb Raider (2013), Cyberpunk 2077 (2020), Apex Legends (2019), and Hogwarts Legacy (2023), all against 2025.

### User-visible coverage

- Cards visibly label generated years as **Title year** and use a **Wikidata-listed** platform list label; curated cards keep their existing platform/release labels.
- Detail pages conditionally use “Earliest documented title release” / “Wikidata-listed platform,” explain that the two source statements do not establish a platform release date, and retain the existing curated wording.
- Filters/sorting use neutral “catalog year” wording and accessible explanation; their numeric behavior stays unchanged.
- Platform hubs/metadata, generated descriptions, Switch 2 platform copy, and static output must not claim “released on,” “native,” or “available on” for source-listed generated associations.
- Static tests must cover cards, detail pages, platform hubs/metadata, the full no-JavaScript catalog, and the named Switch 2 fixtures.

### Execution order and gates

1. Add the semantic types, resolver defaults, validator contract, v2 search envelope/parser, and focused fixtures.
2. Add policy-approved chronology registry, immutable fact snapshot, deterministic audit generator/checker, and package/Make gates.
3. Regenerate the 897 records/inventory/search index/audit; assert the factual snapshot is unchanged.
4. Apply conditional UI, copy, hub/metadata, and documentation changes; run targeted static-render assertions.
5. Run full `make validate`, final high-risk review, current-main rebase, and PR delivery flow.
