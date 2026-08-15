# Catalog maintenance

GameAtlas keeps catalog breadth separate from evidence and rights decisions. The maintenance commands below make coverage drift and stale outbound references visible without adding network dependence to the required build gate.

## Coverage report

Generate the deterministic report after a catalog refresh:

```bash
npm run report:coverage -- --write
```

The report is stored at `data/catalog-coverage-report.json`. Required validation checks that it is current:

```bash
npm run report:coverage -- --check
```

The report contains catalog totals, per-platform and per-genre record counts, hub eligibility, link counts by kind, evidence states, licensed numeric-signal count, and optional-field coverage. It intentionally has no timestamps, timings, absolute paths, or network results.

## Optional link check

Run the network check manually against the published URL inventory:

```bash
npm run check:links
```

The inventory covers committed game records, source/rights registries, taxonomy and coverage documents, asset metadata, the README, and the published rights policy. Frozen import and curation snapshots are excluded when their URLs are not published inputs.

- `pass`: HTTPS response or redirect chain completed with a 2xx or 3xx result.
- `warn`: timeout, DNS/network uncertainty, rate limiting, access blocking, or a 5xx response.
- `fail`: invalid/insecure URL, private/local host, disallowed redirect, or definitive 4xx such as 404/410.

Warnings do not fail the command because external providers commonly block automated requests. The checker uses bounded concurrency, timeouts, HTTPS-only redirects, and a HEAD-to-GET fallback. It is not part of `make validate` or Pages CI; run it from a trusted maintenance environment and review warnings before changing catalog data.

## Browser smoke

The static export has a local Chrome/CDP smoke suite for package views, catalog interactions, responsive behavior, accessibility media states, and base-path navigation. Run it after a build:

```bash
npm run build
make browser-e2e
```

The Pages workflow resolves the runner's installed Chrome binary and runs the same suite before artifact validation.

## Correction workflow

Use the public [catalog correction issue form](https://github.com/dmoliveira/best-nintendo-pc-games/issues/new?template=catalog-correction.yml&title=GameAtlas%20catalog%20correction). Include a slug, field, proposed correction, and authoritative source URL. Do not attach copied review text or unlicensed images. After review, update the source record, regenerate any governed output, run `make validate`, refresh the coverage report, and record the recheck date when a source or asset policy changes.
