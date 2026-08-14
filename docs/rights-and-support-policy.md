# GameAtlas rights, sources, and support policy

**Review date:** 2026-08-15
**Repository:** `dmoliveira/best-nintendo-pc-games`
**Status:** launch gate recorded; no numeric provider data, third-party artwork, or payment CTA is enabled by this slice. The live support destination is withheld from public files until activation.

This is an operational publishing policy, not legal advice. Provider terms, licenses, and payment disclosures must be rechecked when the catalog or asset pipeline changes.

## Publishing rule

GameAtlas is a static reference catalog. It may link to an external page without copying that page’s content. A source’s factual accuracy and permission to republish are different decisions.

Before a numeric signal appears in the local search index or rendered HTML, its record must have:

1. `verificationStatus: "verified"` — the value and edition/platform were checked;
2. `rightsStatus: "approved"` — the project is allowed to cache/display the value;
3. provider, score type, scale, count where applicable, edition/platform, capture date, source URL, terms/permission URL, reviewer, and recheck date;
4. a documented threshold predicate if it is used by the `>=80` filter.

`outbound-only`, `pending-review`, and `prohibited` records may keep an external URL and descriptive label, but they must not emit a cached score. GameAtlas must never scrape Metacritic/OpenCritic, copy review text, or merge critic/user/sales/editorial values into a fake overall rating.

## Current source decisions

The machine-readable registry is [`data/source-rights.json`](../data/source-rights.json).

| Source | Current use | Numeric score | Images/text |
| --- | --- | --- | --- |
| Metacritic | External reference link only | Outbound-only until authorized | Do not copy/download |
| OpenCritic | External reference link only | Outbound-only until authorized | Do not copy/download |
| IGDB/Twitch | Discovery candidate only | Not approved | Not approved |
| RAWG | Discovery candidate only | Not approved | Not approved |
| Nintendo Investor Relations | Dated, attributed first-party sales facts where published | Not a critic score | Do not reuse images without permission |
| Official publisher/developer pages | Official/store/availability links | Not approved | A link is not image permission |

The registry deliberately does not claim that an API response or a public web page grants redistribution rights. Any future provider adapter must update the registry first, include the terms URL and recheck date, and add tests proving that unauthorized fields are omitted from the static artifact.

## Asset rule

The machine-readable asset policy is [`data/asset-rights.json`](../data/asset-rights.json). Every local image needs a manifest record before it is referenced by a game or page. The record must identify its source/creator, license or permission, intended use, attribution, alt text, reviewer, and recheck date.

The default launch path is:

- original abstract editorial artwork generated for GameAtlas;
- deterministic CSS/emoji/glyph fallbacks;
- public-domain or compatible-license assets with a recorded license;
- publisher/press assets only after written permission is retained.

Do not download a cover or screenshot merely because a provider returns an image URL. Do not recreate official boxes, logos, characters, or screenshots as generated “fan art” for a card.

## Support CTA gate

A future support destination has been supplied for the later support task. Its live destination is intentionally absent from this public repository until the disclosure gate completes. This rights slice does **not** publish a payment button. Before enabling it in the README, footer, or `/support/` page, the project must document the intended recipient/account context, voluntary-support wording, public correction/contact path, applicable refund/privacy information, and any provider terms affected by the support path. The payment link must not be described as a subscription, tax-deductible donation, or commercial service unless that is verified.

## Refresh checklist

Before each catalog or asset refresh:

- re-open the current official terms for every active provider;
- check whether the support path changes the applicable commercial-use status;
- confirm every numeric signal has both verification and rights approval;
- confirm sales figures retain geography, period, scope, and `asOf` date;
- confirm every local asset has a manifest record and compatible use;
- record reviewed date, reviewer, and an expiry/recheck date;
- run the catalog, source, asset, link, and static-export validators.

## Reporting corrections

Corrections should include the game/platform slug, the field in question, the source URL, and why the current value or asset status is wrong. Do not attach unlicensed screenshots or copied review text to an issue.

## Downstream handoff

- The typed catalog validator owns the structured source predicate and per-source freshness fields.
- The asset-manifest validator owns conditional generated/licensed provenance fields.
- The support activation work owns the withheld destination and must not publish it until every support requirement is documented.
