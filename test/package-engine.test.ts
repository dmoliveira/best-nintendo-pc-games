import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { BOX_ART_FORMATS, PLATFORM_BOX_ART_FORMATS, PLATFORM_PACKAGE_PROFILES, getBoxArtFormat, resolvePackageProfile, validateBoxArtFormatDocument } from "../lib/box-art/formats";
import { createPackagePresentation } from "../lib/box-art/package-engine";

const root = process.cwd();
const formatDocument = JSON.parse(fs.readFileSync(path.join(root, "data/box-art-formats.json"), "utf8"));

test("keeps artwork formats stable while covering every supported platform with a presentation profile", () => {
  assert.equal(getBoxArtFormat("pc-big-box")?.image.width, 1024);
  assert.equal(getBoxArtFormat("pc-big-box")?.image.height, 1536);
  assert.equal(BOX_ART_FORMATS.length, 13);
  assert.equal(Object.keys(PLATFORM_BOX_ART_FORMATS).length, 16);
  assert.deepEqual(Object.keys(PLATFORM_PACKAGE_PROFILES).sort(), Object.keys(PLATFORM_BOX_ART_FORMATS).sort());
  assert.deepEqual(validateBoxArtFormatDocument(formatDocument), []);
  for (const platformId of Object.keys(PLATFORM_BOX_ART_FORMATS)) {
    const resolution = resolvePackageProfile([platformId]);
    assert.equal(resolution.status, "resolved", `${platformId} should resolve`);
    if (resolution.status === "resolved") assert.equal(resolution.profile.formatId, PLATFORM_BOX_ART_FORMATS[platformId]);
  }
});

test("rejects incomplete or dangling package profile schemas", () => {
  const invalid = structuredClone(formatDocument);
  delete invalid.platformPackageProfiles["nintendo-switch"];
  invalid.platformPackageProfiles["pc-windows"].dimensions.depth = 0;
  const errors = validateBoxArtFormatDocument(invalid);
  assert.ok(errors.some((error) => error.includes("nintendo-switch") && error.includes("missing profile")));
  assert.ok(errors.some((error) => error.includes("pc-windows") && error.includes("dimensions")));
});

test("creates a visibly dimensional physical presentation and rejects a mismatched governed front", () => {
  const presentation = createPackagePresentation({
    title: "Celeste",
    platformIds: ["pc-windows"],
    platformLabel: "PC (Windows)",
    governedFront: { src: "/assets/games/celeste/front-pc-big-box.png", alt: "Approved Celeste package front", formatId: "pc-big-box" },
    editorialThumbnail: { src: "/assets/games/celeste.svg", alt: "Abstract Celeste thumbnail" },
  });
  assert.equal(presentation.formatId, "pc-big-box");
  assert.equal(presentation.formatKind, "physical");
  assert.equal(presentation.viewer.restAngle, -24);
  assert.ok(presentation.viewer.depthPx >= 8);
  assert.equal(presentation.viewer.canRotate, true);
  assert.equal(presentation.governedFront?.src, "/assets/games/celeste/front-pc-big-box.png");
  assert.equal(presentation.thumbnail.frontSrc, "/assets/games/celeste.svg");
  assert.equal(presentation.editorialThumbnail?.src, "/assets/games/celeste.svg");

  const mismatched = createPackagePresentation({
    title: "Celeste",
    platformIds: ["pc-windows"],
    platformLabel: "PC (Windows)",
    governedFront: { src: "/assets/games/celeste/front-wrong.png", alt: "Wrong", formatId: "cartridge-portrait" },
  });
  assert.equal(mismatched.governedFront, undefined);
});

test("keeps digital presentation flat and fails closed for unsupported platform input", () => {
  const digital = createPackagePresentation({
    title: "Mighty Flip Champs",
    platformIds: ["nintendo-dsi"],
    platformLabel: "Nintendo DSi",
    releaseFormat: "digital",
  });
  assert.equal(digital.formatKind, "digital");
  assert.equal(digital.viewer.depthPx, 0);
  assert.equal(digital.viewer.restAngle, 0);
  assert.equal(digital.viewer.canRotate, false);
  assert.equal(digital.thumbnail.isPhysical, false);

  assert.throws(() => createPackagePresentation({ title: "Unknown", platformIds: ["missing-platform"], platformLabel: "Unknown" }), /cannot create package presentation/);
  assert.throws(() => createPackagePresentation({ title: "Ambiguous", platformIds: ["nintendo-switch", "pc-windows"], platformLabel: "Ambiguous" }), /exactly one platform/);
});

test("uses a neutral flat reference presentation for source-listed platform associations", () => {
  const presentation = createPackagePresentation({
    title: "Tomb Raider",
    platformIds: ["nintendo-switch-2"],
    platformLabel: "Wikidata-listed: Switch 2",
    platformAssociationScope: "source-listed",
    governedFront: { src: "/assets/games/tomb-raider/front-switch-2.png", alt: "Unsupported platform-specific front", formatId: "switch-2-game-case" },
    editorialThumbnail: { src: "/assets/games/tomb-raider.svg", alt: "Abstract Tomb Raider reference art" },
  });
  assert.equal(presentation.presentationMode, "source-listed-reference");
  assert.equal(presentation.formatId, "catalog-reference");
  assert.equal(presentation.formatKind, "digital");
  assert.equal(presentation.profile.category, "source-listed catalog reference");
  assert.equal(presentation.viewer.depthPx, 0);
  assert.equal(presentation.viewer.canRotate, false);
  assert.equal(presentation.thumbnail.depthRatio, 0);
  assert.equal(presentation.governedFront, undefined);
});

test("keeps every platform profile inside viewer and thumbnail safety bounds", () => {
  for (const [platformId, profile] of Object.entries(PLATFORM_PACKAGE_PROFILES)) {
    const presentation = createPackagePresentation({
      title: platformId,
      platformIds: [platformId],
      platformLabel: platformId,
      releaseFormat: profile.kind === "digital" ? "digital" : undefined,
    });
    assert.ok(Number.isInteger(presentation.viewer.widthPx) && presentation.viewer.widthPx > 0 && presentation.viewer.widthPx <= 282, `${platformId}: width`);
    assert.ok(Number.isInteger(presentation.viewer.heightPx) && presentation.viewer.heightPx > 0 && presentation.viewer.heightPx <= 296, `${platformId}: height`);
    assert.ok(Number.isFinite(presentation.thumbnail.aspectRatio) && presentation.thumbnail.aspectRatio > 0, `${platformId}: aspect ratio`);
    if (profile.kind === "physical") {
      assert.ok(presentation.viewer.depthPx >= 8 && presentation.viewer.depthPx <= 46, `${platformId}: physical depth`);
      assert.equal(presentation.viewer.restAngle, -24, `${platformId}: rest angle`);
      assert.equal(presentation.viewer.canRotate, true, `${platformId}: rotation`);
      assert.ok(presentation.thumbnail.depthRatio > 0, `${platformId}: thumbnail depth`);
    } else {
      assert.equal(presentation.viewer.depthPx, 0, `${platformId}: digital depth`);
      assert.equal(presentation.viewer.restAngle, 0, `${platformId}: digital rest angle`);
      assert.equal(presentation.viewer.canRotate, false, `${platformId}: digital rotation`);
      assert.equal(presentation.thumbnail.depthRatio, 0, `${platformId}: digital thumbnail depth`);
    }
  }
});

test("uses platform package profiles only for verified-release records", () => {
  const games = fs.readdirSync(path.join(root, "data/games")).filter((file) => file.endsWith(".json"));
  assert.ok(games.length > 0);
  for (const file of games) {
    const game = JSON.parse(fs.readFileSync(path.join(root, "data/games", file), "utf8"));
    const presentation = createPackagePresentation({
      title: game.title,
      platformIds: game.platforms,
      platformLabel: game.platforms.join(", "),
      platformAssociationScope: game.platformAssociationScope ?? "verified-release",
      releaseFormat: game.releaseFormat,
    });
    if (game.platformAssociationScope === "source-listed") {
      assert.equal(presentation.presentationMode, "source-listed-reference", `${game.slug}: source-listed records must not select a platform package`);
      assert.equal(presentation.viewer.depthPx, 0, `${game.slug}: source-listed reference depth`);
    } else {
      const resolution = resolvePackageProfile(game.platforms, game.releaseFormat);
      assert.equal(resolution.status, "resolved", `${game.slug}: ${resolution.status === "unsupported" ? resolution.reason : ""}`);
      assert.equal(presentation.presentationMode, "platform-package", `${game.slug}: verified release uses package profile`);
    }
  }
});
