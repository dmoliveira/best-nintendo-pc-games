# GameAtlas — Best Nintendo & PC Games

> Find the games worth your time.

GameAtlas is a source-aware, static-first guide to acclaimed and popular games. It starts with Nintendo consoles, then expands to PC with searchable platform, genre, year, developer, publisher, and evidence filters.

**Status:** foundation in progress · [planned GitHub Pages site](https://dmoliveira.github.io/best-nintendo-pc-games/)

## What is being built

- fast prefix and partial-match search;
- platform, generation, genre, year, developer, publisher, and quality-signal filters;
- provider-specific critic/community signals, sales facts, popularity signals, and editorial picks kept separate;
- concise game pages with original context, sources, official/store links, and related discovery;
- responsive, keyboard-friendly visual browsing with local/generated editorial art;
- static GitHub Pages deployment with no runtime API keys.

The launch plan and acceptance gates live in [`docs/plan/new/2026-08-15-gameatlas-launch.md`](docs/plan/new/2026-08-15-gameatlas-launch.md). Source, asset, and support constraints live in [`docs/rights-and-support-policy.md`](docs/rights-and-support-policy.md).

The canonical Nintendo platform taxonomy is in [`data/platforms.json`](data/platforms.json), with its checked alpha and expansion coverage matrix in [`data/coverage.json`](data/coverage.json).

## Trust and rights

GameAtlas does not scrape Metacritic/OpenCritic, copy review text or comments, or assume that an API image URL grants redistribution rights. Numeric signals require separate factual verification and rights approval. See the machine-readable registries under [`data/`](data/).

## Development

Requires Node.js 22+ and npm 10–11.

```bash
npm ci
make validate
```

## License

Source code will be released under a code license in a later launch slice. Third-party names, marks, provider content, and assets remain owned by their respective owners; the rights policy is part of the project contract.
