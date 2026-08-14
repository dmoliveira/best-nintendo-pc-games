# GameAtlas — Best Nintendo & PC Games

**Status:** planning / approved with required changes incorporated
**Date:** 2026-08-15
**Proposed repository:** `dmoliveira/best-nintendo-pc-games`
**Proposed Pages URL:** `https://dmoliveira.github.io/best-nintendo-pc-games/`
**Brand:** **GameAtlas** — *Find the games worth your time.*

## 1. Product brief

GameAtlas will be a fast, visual, trustworthy catalog for finding acclaimed and popular games across Nintendo consoles first and PC second. A visitor should be able to choose a platform, search by a partial title or keyword, narrow by year/genre/developer/publisher/quality signal, understand why a game is included, and reach official or authoritative external resources in one or two clicks.

The site is a **static-first public reference**, not a scraper, review mirror, or storefront. Every score, sales claim, link, and image must carry its own provenance. The UI can use expressive game-inspired colors, emoji, glyphs, generated abstract thumbnails, and local assets, but it must not imply that third-party artwork or proprietary review data is freely redistributable.

## 2. Decisions for the first implementation slice

| Decision | Default | Rationale |
| --- | --- | --- |
| Repository name | `best-nintendo-pc-games` | Exact intent keywords are discoverable while the visible brand remains memorable. A shorter brand-only slug would lose useful query context. |
| Visible brand | `GameAtlas` | Distinctive enough for return visits and social sharing; the title/subtitle carries Nintendo, PC, best games, and ratings terms. |
| Framework | Next.js + React + TypeScript, App Router | Matches a proven local GitHub Pages pattern and supports static generation, metadata, JSON-LD, and typed content. |
| Hosting | GitHub Pages Actions | No server is needed for the catalog; build output can be validated before deployment. |
| Runtime data | Committed, reviewed catalog and generated search index | No API key or provider secret can be shipped to a browser or stored in a Pages artifact. |
| Search | URL-backed client interaction over a normalized static index | Supports prefix, partial match, filters, sorting, and shareable results without a backend. |
| Nintendo scope | Home + handheld families, with explicit coverage status | “All Nintendo consoles” becomes a checkable taxonomy rather than an unprovable marketing claim. |
| PC scope | Starts after the Nintendo taxonomy and seed content are stable | Honors the requested Nintendo-first sequence and prevents a shallow “everything” catalog. |
| Score semantics | Provider-specific signals, never one blended score | Metacritic, OpenCritic, user ratings, sales, and editorial picks measure different things. Verification and redistribution authorization are separate fields. |
| Launch media | Rights-cleared assets, original abstract generated art, emoji/glyph fallback | An API image URL is not evidence of permission to download, crop, commit, or redistribute an image. |
| Support | Existing Master Philosophers Stripe link in a non-intrusive support page/footer/README | Reuses the requested link while keeping the catalog free and transparent. |

### Source and rights guardrail

The site must not scrape Metacritic/OpenCritic, copy review excerpts or user comments, or bulk-download cover art without a documented permission/license path. OpenCritic has no documented public API in the research snapshot; Metacritic’s terms govern its content; IGDB and RAWG free plans have non-commercial/attribution constraints that require rechecking because the project includes a Stripe support path.

Until an authorized feed or written permission is confirmed:

- show external Metacritic/OpenCritic links as references, not as an unlabeled local database;
- populate numeric signals only from an approved provider adapter or an explicitly approved, documented manual process; “fact checked” alone is not permission to republish;
- label each score with provider, scale, score type, platform/edition, count, capture date, and source URL;
- keep “critic 80+”, “Nintendo-reported sales”, “community signal”, and “Atlas editorial pick” as different badges;
- use official Nintendo IR sales figures only where Nintendo publishes them, with date and scope;
- use generated abstract art or explicitly licensed assets rather than assumed cover-art rights;
- link to external communities instead of copying comments into the repository.

This lets the implementation support the requested `>=80` filter without making an unsupported claim. The launch can show separate lists such as **Critic 80+ (authorized signals only)**, **Nintendo sales legends**, and **Atlas picks**. A signal is eligible for a public numeric filter only when both its factual verification and its redistribution authorization are approved.

## 3. Goals and non-goals

### Goals

1. Make the best Nintendo games easy to find by console, generation, genre, year, developer, publisher, keyword, and evidence type.
2. Add PC as a second-class platform family without mixing its signals with Nintendo sales data.
3. Give every game a useful detail page: original short description, highlights, platform/year metadata, quality evidence, official/store links, external critical/community links, and related games.
4. Deliver professional responsive UI: dark retro-future atlas aesthetic, strong typography, clear badges, emoji/glyph affordances, accessible controls, and performant local imagery.
5. Make every public page indexable with unique metadata, internal links, canonical URLs, sitemap/robots, Open Graph cards, and appropriate Schema.org data.
6. Provide an auditable catalog update workflow that a future contributor or agent can resume.
7. Publish a public README with status/data badges, scope explanation, attribution, contribution guidance, and the Stripe support path.

### Non-goals for MVP

- Scraping or mirroring Metacritic, OpenCritic, Steam, Reddit, blogs, or user comments.
- A login system, server database, hosted user reviews, or personalized recommendations requiring an account.
- Claiming complete worldwide game coverage or universal sales rankings without a source and date.
- Copying publisher logos, game box art, screenshots, character art, or review text without rights evidence.
- A commercial affiliate engine; official/store links may be added, but affiliate disclosure is a later decision.
- A custom domain or paid analytics platform before the public Pages experience is stable.

## 4. Audience and core journeys

### Primary journeys

1. **Platform-first:** choose Nintendo Switch or SNES → see qualified/highlighted games → filter by genre or year → open a detail page → follow an official or critical resource.
2. **Title-first:** type a prefix or partial title/alias → see ranked matches → refine by platform/year/score/provider → copy a shareable URL.
3. **People-first:** search a developer or publisher → browse their games by platform and release date.
4. **Quality-first:** choose a signal type such as critic 80+, Nintendo-reported sales, community signal, or Atlas pick → inspect the evidence explanation before trusting the badge. Numeric `>=80` means an approved 0–100 critic signal with a selected provider/type, not any arbitrary score.
5. **Exploration:** choose “surprise me” or a collection such as “best couch co-op” → save a favorite locally or compare two games.
6. **Contribution/support:** read the source and asset policy → report a stale link or missing game → support maintenance through the existing Stripe link.

### Required search fields

- title and aliases;
- short description and highlight keywords;
- developer and publisher;
- release year/date and year range;
- genre and subgenre;
- canonical platform, generation, and platform aliases;
- score/evidence provider, score type, score range, score count, and threshold;
- popularity/sales signal type and capture date;
- official/store/resource links.

### Required filters and sorting

Filters: platform, platform family/generation, genre, year from/to, developer, publisher, approved score provider/type, `>=80` qualifying signal, popularity/sales/editorial signal, availability/link type, and “has local art”.

Sort: relevance (query-aware), provider-specific score after selecting a provider/type, newest release, oldest release, title A–Z, genre, and platform. “Most acclaimed” and popularity/sales ordering are deferred until a comparable method/version is defined. The UI must explain what each sort means and must not call a provider score “overall” unless it is explicitly calculated and documented.

## 5. Information architecture

```text
/
├── games/
│   └── [slug]/
├── platforms/
│   └── [platform-id]/
├── genres/
│   └── [genre-id]/
├── collections/
│   └── [collection-id]/
├── search/                  # optional shareable landing route; home also supports q
├── about/
├── sources/
├── support/
├── contribute/
├── sitemap.xml
├── robots.txt
└── feed.xml                 # or RSS-compatible update route if content volume warrants it
```

The home page should be a usable browse/search experience, not only a marketing hero. The hero introduces the value proposition and routes users into platform collections. Platform and collection hubs should have enough original content to be useful and indexable, rather than being thin copies of filtered query results.

### Static GitHub Pages contract

The app must remain a true static export:

- Next config sets `output: "export"`, `trailingSlash: true`, `images.unoptimized: true`, and a Pages-derived `basePath`.
- Every dynamic route uses `generateStaticParams`; there are no server actions, API routes, middleware, runtime database calls, or secret-dependent browser requests.
- Build and browser smoke tests serve `out/` mounted at `/best-nintendo-pc-games/`, then direct-load and refresh representative nested routes.
- `sitemap.xml`, canonical URLs, Open Graph URLs, JSON-LD URLs, and internal links all include the repository prefix.
- A project Pages site cannot provide origin-root `/robots.txt` under the owner domain. Publish the best-effort subpath `robots.txt`/page metadata and document the limitation; use the subpath sitemap in Search Console. Do not treat the presence of a local file as proof that crawlers will receive root-level directives.
- Root-relative asset paths are forbidden; use framework URL helpers or a tested base-path utility.

## 6. Data contract

Recommended repository layout:

```text
data/
├── games/*.json             # one reviewed record per game or small reviewed shards
├── platforms.json
├── genres.json
├── collections.json
├── sources.json
└── coverage.json            # generated/checked coverage summary
public/
├── assets/games/<slug>.*
├── assets/hero/*
└── search-index.json        # generated from validated data
scripts/
├── validate-catalog.ts
├── build-search-index.ts
├── check-links.ts
├── check-assets.ts
└── report-coverage.ts
```

Each game record should include at least:

```ts
{
  slug: string,
  title: string,
  aliases: string[],
  emoji: string,
  shortDescription: string,
  highlights: string[],
  release: { date?: string, year: number, region?: string },
  platforms: string[],
  genres: string[],
  developer?: string,
  publisher?: string,
  keywords: string[],
  signals: Array<{
    kind: "critic" | "user" | "sales" | "popularity" | "editorial",
    provider: string,
    label: string,
    score?: number,
    scale?: number,
    count?: number,
    editionOrPlatform?: string,
    territory?: string,
    period?: string,
    asOf?: string,
    methodVersion?: string,
    rationale?: string,
    capturedAt: string,
    sourceUrl: string,
    termsUrl?: string,
    verificationStatus: "verified" | "unverified",
    rightsStatus: "approved" | "outbound-only" | "pending-review" | "prohibited",
    rightsReviewedAt?: string,
    rightsExpiresAt?: string,
    allowedUses?: string[]
  }>,
  links: Array<{ label: string, url: string, kind: string }>,
  assets: Array<{ path?: string, alt: string, provenanceId: string }>,
  sources: string[]
}
```

Validation rules should fail the build for missing slugs, duplicate aliases, unknown platform/genre IDs, invalid dates/years, empty descriptions, unsupported URL protocols, unlabeled numeric scores, missing source URLs, missing asset provenance, or a `verified` signal without a current capture date. A public numeric signal must have both `verificationStatus: "verified"` and `rightsStatus: "approved"`, plus a terms/permission reference and a recheck date when the source requires one. `rightsStatus: "outbound-only"` or `"prohibited"` must never emit the cached score into the search index or rendered HTML.

### Source-rights registry

Add a reviewed registry before bulk catalog work. It records provider, data fields allowed, image/text permissions, attribution, caching/redistribution terms, commercial/support status, reviewer, decision date, expiry/recheck date, and the exact adapter/manual process covered by the decision. A factual verification is not a rights approval. This registry is the gate used by both catalog and asset validators.

## 7. Ranking and evidence model

The catalog should expose evidence, not manufacture certainty:

- **Critic score:** provider-specific numeric score, exact scale and edition/platform.
- **User/community score:** separate from critic score, with provider and count.
- **Sales:** only a source-reported number/rank with geography, lifetime/period, and `asOf` date.
- **Popularity:** provider-defined or project-defined measure with its algorithm/date and `methodVersion`; never silently substitute for sales.
- **Editorial:** original Atlas selection with a short rationale, not a fake aggregate.

For relevance, normalize Unicode/diacritics and tokenize fields with weights approximately: exact title > title prefix > title substring/alias > platform/genre > developer/publisher > description/keywords. Keep scoring deterministic and unit-tested. Index only normalized discovery fields; omit raw URLs and full evidence objects from the client search index. A missing score must sort below a populated score only for an explicitly selected provider/type; it must not be coerced to zero in the displayed evidence.

## 8. Visual and asset strategy

### Art direction

- **Mood:** confident editorial atlas, dark ink/navy base, luminous coral/cyan/lime signals, paper-map grid, subtle scanline texture, high legibility.
- **Hero:** original abstract map/constellation of console eras and PC pathways; no Nintendo/game logos or copied characters.
- **Game cards:** local thumbnail first; generated abstract “edition card” with title text, platform glyph, release year, and a game-specific color motif; emoji is an accent, never the only label.
- **Icons:** accessible inline SVG/generic symbols and text labels; avoid copying proprietary platform logo files.
- **Fallback:** deterministic CSS gradient + emoji + platform label when no image is available.

Codex-image generation belongs in the media task after the design direction is fixed. Store prompts/asset IDs and provenance metadata, but never commit API keys. Generated art should be clearly original editorial artwork rather than a recreation of a game’s official box or character.

### Asset gate

Every local asset must have a manifest entry with creator/source, permission/license category, generated date, intended use, alt text, and whether attribution is required. CI must reject an asset path that has no manifest entry. Remote image URLs may appear as outbound links but must not be silently downloaded into `public/`.

## 9. SEO and growth plan

1. Use unique title/description/canonical/Open Graph/Twitter metadata for home, platform, genre, collection, and game pages.
2. Generate `sitemap.xml` from only public, indexable pages; generate `robots.txt` with the correct Pages base path.
3. Add `VideoGame`, `BreadcrumbList`, and relevant `CollectionPage` JSON-LD without embedding unsupported review data.
4. Build useful query-intent hubs: best games by Nintendo platform, generation, genre, year, critic signal, and “where to start” collections. Each hub gets original intro copy and related links.
5. Use internal links from hero → platform → genre/collection → game → official/critical source. Add “related games” by shared platform/genre/signal.
6. Use stable slugs and retained alias pages/canonical tags when titles change; Pages has no general server redirect layer. Avoid indexable duplicate query URLs unless they have curated landing content.
7. Add a lightweight update feed and a Search Console ownership/indexing runbook. Do not add invasive tracking by default; consider privacy-friendly aggregate analytics only after consent/legal review.
8. Optimize README discovery with a clear title, badges, screenshots/hero, feature list, source/rights policy, Pages link, contribution path, and support badge.

## 10. Delivery sequence and acceptance gates

### MVP boundary versus the full requested catalog

The requested outcome remains full Nintendo-family coverage followed by PC. The first public **validated alpha** is intentionally smaller so that the search, evidence, rights, and Pages contracts are proven before content volume makes defects expensive:

- taxonomy lists every supported Nintendo family and explicitly marks coverage status;
- populated alpha platforms are Nintendo Switch plus NES and SNES as legacy exemplars;
- alpha search covers title/alias, platform, genre, year, and approved critic signals;
- alpha pages are game and platform pages; broad genre/collection hubs are added only when they have original content;
- alpha art is generated/fallback art only;
- favorites, compare, surprise-me, feed, popularity/sales sorting, and PC promotion are expansion work.

After the alpha passes its deployed smoke and review gates, expand home consoles and handhelds, then add PC. This is a scope reduction for the first safe release, not a change to the product destination.

### Slice A — plan and foundation

Sequence: reviewed plan → static shell plus rights gate → typed data/asset validation → accessible visual shell.

Deliver: reviewed plan, public-repo bootstrap, static export contract, source-rights registry, typed data model, asset manifest contract, validator, and design shell. Gate: lint/typecheck/unit/build plus exported artifact smoke. No catalog numeric signal, local image, or support CTA is publishable before the rights gate is resolved.

### Slice B — Nintendo alpha content and evidence

Sequence: platform taxonomy → evidence predicate → Switch/NES/SNES alpha → editorial copy and search fixtures.

Deliver: complete platform taxonomy, approved evidence predicates, a small validated alpha seed, original descriptions, and search fixtures. Gate: coverage report shows every canonical Nintendo family and only the alpha platforms are marked populated; all records validate; every numeric signal is dual-approved; unsupported platforms are visible as planned/partial rather than represented by thin pages.

### Slice C — discovery and indexable pages

Sequence: filters and URL state → static detail/platform pages → optional local retention features after alpha.

Deliver: alpha filters/sorts/shareable URLs, static detail/platform pages, schema, and internal links. Gate: keyboard/mobile smoke path, all static routes build, search tests cover every alpha field, and no thin/uncurated hub is indexable. Local favorites/compare/surprise-me remain post-MVP.

### Slice D — media and visual quality

Sequence: rights manifest → generated/fallback image system → responsive visual QA.

Deliver: rights manifest, generated/fallback image system, polished responsive UI, accessible fallbacks. Gate: asset validator, visual QA at target widths, no high-severity accessibility/performance issue, and no unmanifested local asset.

### Slice E — Nintendo expansion, PC, and public launch

Sequence: full Nintendo home/handheld coverage → PC catalog → Pages deployment → README/support → SEO operations → maintenance automation.

Deliver: full Nintendo home/handheld expansion, curated PC catalog after the Nintendo baseline, Pages deployment, README/support after the support gate, SEO operations, and maintenance automation. Gate: clean PR CI, deployed URL smoke, sitemap/robots/OG checks, coverage report, source/asset policy review, and explicit supported-platform status.

### Parallelism

The data schema and rights policy can be researched in parallel with the visual shell after the plan gate. The alpha can use Switch/NES/SNES while the rest of the Nintendo taxonomy is documented. Home-console and handheld curation can proceed in parallel after the taxonomy and rights gate. Search fixtures can start as soon as the first validated records exist. PC curation remains intentionally downstream of the Nintendo baseline.

## 11. Validation definition

For every code slice:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
```

For the static contract, additionally validate:

- exported `out/` contains `.nojekyll`, home, sitemap, robots, OG/icon assets, and representative game/platform pages;
- all local asset references resolve under `/best-nintendo-pc-games/`;
- no page or bundle contains provider secrets;
- representative browser flow: home → platform filter → partial search → year/genre/rating filter → detail page → external resource;
- direct-load and refresh of nested routes from an HTTP server mounted at the repository subpath;
- keyboard navigation, focus visibility, reduced motion, contrast, and empty/error states, with WCAG 2.2 AA automated checks where tooling supports them;
- compressed initial search index and JavaScript budgets are recorded and enforced (initial target: search index ≤250 KB gzip, route initial JS ≤180 KB gzip);
- zero unauthorized numeric signals, zero unmanifested local assets, and zero unapproved support/payment CTAs;
- link and asset validators pass or report each reviewed failure with owner, reason, and expiry date.

The first planning slice requires `git diff --check`, plan review, and Codememory plan health/queue checks. Runtime slices use the medium-risk budget: two review/fix passes when changed evidence or findings justify them, followed by verifier validation on the final diff.

## 12. Launch acceptance checklist

- [ ] Public repository is `dmoliveira/best-nintendo-pc-games` and Pages is enabled through Actions.
- [ ] Alpha coverage is explicit: Switch, NES, and SNES are populated; all other Nintendo families are labeled planned/partial until their seed task completes.
- [ ] Home page clearly explains what “best” means and separates critic, user, sales, popularity, and editorial signals.
- [ ] Nintendo platform taxonomy is visible, searchable, and coverage-reported before PC is promoted.
- [ ] Search supports prefix/partial title, alias, description, developer, publisher, year, rating/evidence, genre, platform, and keywords.
- [ ] Sorting/filtering is URL-shareable and accessible on mobile/keyboard; score sorting requires an explicitly selected comparable provider/type.
- [ ] Every published game has original description, sources, official/external links, asset provenance, and related navigation.
- [ ] Numeric `>=80` filters only use labeled, permission-checked signals; no scraped or mislabeled provider data.
- [ ] Game thumbnails/hero/OG images are local and rights-cleared/generated, with deterministic fallback and alt text.
- [ ] Platform/game pages have unique SEO metadata, canonical URLs, JSON-LD, sitemap inclusion, and correct base paths; genre/collection pages are indexed only when they meet content thresholds.
- [ ] README badges, contribution guidance, source/asset policy, Pages link, and Stripe support link are present only after support ownership/disclosure checks pass.
- [ ] CI validates lint, types, tests, static export, asset/source contracts, and deployment smoke.
- [ ] Maintenance docs define source rechecks, coverage updates, stale-link review, and how to report corrections.

## 13. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Provider terms change or prohibit caching/redistribution | High | Keep provider adapters build-time and optional; store provenance; default to outbound links; recheck terms before each data refresh. |
| Cover art/character/logo rights are unclear | High | Asset manifest gate; generated abstract art; no remote download by default; request publisher permission where needed. |
| “All Nintendo consoles” becomes too broad for a useful catalog | Medium | Canonical taxonomy + coverage report + platform landing pages; publish coverage status instead of claiming completeness prematurely. |
| Static Pages base path breaks links or metadata | Medium | Derive `basePath` from Pages outputs; build and mounted-export smoke tests; never hard-code root-relative assets. |
| Search bundle becomes large | Medium | Generate compact normalized index, split data/detail pages, lazy-load optional features, enforce bundle budgets. |
| Donations make free API terms unsuitable | High | Treat non-commercial provider plans as non-default; use rights-cleared/manual data until commercial/public-use terms are confirmed. Keep the Stripe CTA disabled until the support gate has a documented verdict. |
| SEO pages are thin duplicates | Medium | Curated hub intros, unique metadata, canonical policy, noindex for uncurated query combinations. |
| User comments invite moderation/privacy burden | Medium | Outbound community links first; optional GitHub Discussions/submission workflow later with moderation policy. |

## 14. Immediate next actions

Foundation status: the static shell, source-rights registry, asset manifest, route metadata, and CI validators are encoded in the current implementation slice.

1. Define the canonical Nintendo platform taxonomy and coverage matrix before adding broad catalog content.
2. Implement the typed game/signal schema and connect its validators to the approved source predicate.
3. Curate and publish the Switch/NES/SNES alpha, then validate the real Pages subpath.
4. Expand every Nintendo family before promoting PC coverage.
5. Reconfirm provider terms and image policy immediately before adding any numeric score or downloaded asset.

## References consulted

- Next.js/GitHub Pages local pattern: an adjacent static Next.js project’s `next.config.ts` and `.github/workflows/deploy-pages.yml`.
- GitHub Pages: <https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages>
- IGDB API: <https://api-docs.igdb.com/>
- RAWG API: <https://rawg.io/apidocs> and <https://rawg.io/terms>
- OpenCritic API FAQ: <https://help.opencritic.com/knowledge-base/articles/6333223-are-there-any-opencritic-api-s>
- Metacritic terms: <https://www.metacritic.com/legal/terms-of-use/>
- Nintendo sales reporting: <https://www.nintendo.co.jp/ir/en/finance/hard_soft/> and <https://www.nintendo.co.jp/ir/en/finance/software/index.html>
- Schema.org VideoGame: <https://schema.org/VideoGame>
- Support link supplied from `dmoliveira/master-philosophers`; the live destination is held in Codememory until the support disclosure gate passes.
