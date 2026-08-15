# Game box-art workflow

This workflow produces **AI-generated GameAtlas editorial art**, not a replacement for an official cover scan. It is designed for a static GitHub Pages site: no generation key reaches the browser, and a reviewed image becomes a normal committed `public/` asset only after the local gates pass.

## Design model

The viewer is a lightweight CSS 2.5D package view, not a WebGL model or a 360° scan. It composes separate front, spine, back, base, and HTML/CSS label layers at runtime:

- the **front** is the only generated raster asset;
- the **labels** use site text, not AI-rendered typography;
- the **spine, back, and base** are neutral GameAtlas layers;
- `data/box-art-formats.json` maps platform families to configurable display proportions, depth, and Codex Image dimensions.

Those proportions are intentionally neutral display profiles. Do not copy official logos, stripe layouts, color trade dress, package templates, ratings badges, screenshots, characters, or official box art.

## Fast, safe generation loop

Start with one candidate at low quality, inspect it, then make one selected final at medium quality. Keep the prompt about original visual motifs rather than a game title, publisher, franchise, or character.

```bash
npm run art:doctor
npm run art:generate -- \
  --slug <game-slug> \
  --brief "Original abstract visual motifs only: ..." \
  --quality low \
  --dry-run
```

`--dry-run` validates the exact non-interactive `codex-image` request in an OS temporary directory. It neither contacts the image service nor writes a repository asset.

When the request is ready, omit `--dry-run`. The command stages a PNG and checksum-bound `draft.json` under ignored `artifacts/box-art/`; it never modifies `public/`, a game record, or the asset manifest.

```bash
npm run art:generate -- \
  --slug <game-slug> \
  --brief "Original abstract visual motifs only: ..." \
  --quality medium
```

The default provider is the authenticated Codex CLI. API billing is intentionally opt-in: use `--provider api --allow-api-billing` only when that cost has been deliberately approved. Generation is one image per request, uses PNG, runs without stdin, and fails closed on a timeout, nonzero result, malformed JSON, unexpected output count, output-path escape, invalid PNG, or wrong dimensions.

## Review and publication

Inspect the staged PNG before publication. Reject it if it includes text, numbers, marks, a logo, a character, screenshot, official-cover composition, package trade dress, a recognizable existing-game style, or a living-artist imitation. The reviewer must attest to the exact checksum-bound output:

```bash
npm run art:publish -- \
  --draft artifacts/box-art/<game-slug>/<draft-directory>/draft.json \
  --reviewed-by "GameAtlas editorial review" \
  --approval-note "I reviewed this exact asset and confirm it contains no recreated official box art, no logos, no characters, and no screenshots."
```

Publication verifies the PNG signature, CRC/chunk structure, dimensions, 12 MB size limit, SHA-256 checksum, intended format, and the exact attestation. The public manifest records an AI-generation disclosure plus the OpenAI Terms of Use URL and effective date alongside the tool, prompt, dimensions, and review record. It then holds a kernel-owned, repository-specific loopback lease and writes the image, manifest entry, and typed game-asset reference as a journaled transaction. A crashed process releases that lease automatically; the next invocation can safely restore the journal before retrying. If the process is interrupted, recover the exact pre-publication state before retrying:

```bash
npm run art:publish -- --recover
```

Do not add the ignored `artifacts/` directory to Git. The publish command creates only the approved image beneath `public/assets/games/`, its provenance record in `data/assets-manifest.json`, and the matching `role: "box-front"` game asset. GitHub Pages will include it automatically after normal validation, commit, PR, and merge; no browser-side upload is needed.

## Required gates

```bash
make validate
npm run validate:box-art-browser
```

The browser gate requires a local Chrome binary and verifies keyboard rotation, zoom bounds, fullscreen fallback, focus restoration, `aria-live` updates, reduced-motion behavior, and the no-art reference package. Also perform the visual checklist below before merging a real asset:

- front, spine, back, and base are distinguishable after rotate controls;
- controls have visible focus and remain usable at mobile width;
- Left/Right, plus/minus, Home/0 work only while the package stage has focus;
- fullscreen failure opens the labelled fallback dialog; Escape closes it and returns focus;
- reduced motion removes interpolation; forced colors keeps boundaries and controls visible;
- generated front art is visibly distinct from official game imagery, clear of text/marks/characters/screenshots/trade dress/style imitation, and the local HTML label remains readable;
- the exported game page uses the Pages base path and a game without approved art still says **GameAtlas reference case**.

## AI contributor contract

An AI adding a game may infer the format only when the game maps to exactly one profile. Multi-platform ambiguity must be resolved with `--format`; never silently choose a package style. Use the game’s written metadata for HTML labels and an abstract, text-free art brief for the image. Keep credentials, hidden prompts, provider responses, and failed drafts outside the repository.
