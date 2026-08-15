"use client";
/* eslint-disable @next/next/no-img-element -- static export keeps approved local thumbnail URLs base-prefixed. */

import { useState, type CSSProperties } from "react";
import type { CatalogPackageThumbnail } from "@/lib/catalog/search";

type ThumbnailStyle = CSSProperties & Record<"--package-thumb-aspect" | "--package-thumb-depth", string>;

function boundedDepth(depthRatio: number, isPhysical: boolean): string {
  if (!isPhysical) return "0px";
  return `${Math.min(12, Math.max(4, Math.round(depthRatio * 92)))}px`;
}

export default function PackageThumbnail({ thumbnail, emoji }: { thumbnail: CatalogPackageThumbnail; emoji: string }) {
  const [failed, setFailed] = useState(false);
  const source = failed ? undefined : thumbnail.frontPath;
  const style: ThumbnailStyle = {
    "--package-thumb-aspect": String(Math.min(1.8, Math.max(0.55, thumbnail.aspectRatio))),
    "--package-thumb-depth": boundedDepth(thumbnail.depthRatio, thumbnail.kind === "physical"),
  };
  return <span className={`package-thumbnail package-thumbnail--${thumbnail.kind}`} data-package-thumbnail="true" data-package-format={thumbnail.formatId} data-package-kind={thumbnail.kind} style={style} aria-hidden="true">
    <span className="package-thumbnail__object">
      {thumbnail.kind === "physical" ? <span className="package-thumbnail__spine" /> : null}
      <span className="package-thumbnail__front">
        {source ? <img src={source} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <span className="package-thumbnail__fallback">{emoji}</span>}
      </span>
    </span>
  </span>;
}
