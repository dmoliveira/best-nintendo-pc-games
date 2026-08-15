"use client";
/* eslint-disable @next/next/no-img-element -- static export uses locally governed, base-prefixed asset URLs. */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { BOX_VIEW_ZOOMS, describeBoxView, INITIAL_BOX_VIEW_STATE, reduceBoxView, type BoxViewAction, type BoxViewState } from "@/lib/box-art/view-state";
import type { PackagePresentation } from "@/lib/box-art/package-engine";

type BoxStyle = CSSProperties & Record<"--box-width" | "--box-height" | "--box-depth", string>;

function readableProfileCategory(value: string): string {
  return value.replace(/-/g, " ");
}

export default function GameBoxViewer({ presentation }: { presentation: PackagePresentation }) {
  const [view, setView] = useState<BoxViewState>(INITIAL_BOX_VIEW_STATE);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const viewerRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fullscreenControlRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasNativeFullscreenRef = useRef(false);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const { viewer, profile, governedFront } = presentation;
  const approvedFrontSrc = governedFront?.src;
  const frontSrc = failedSource === approvedFrontSrc ? undefined : approvedFrontSrc;
  const canRotate = viewer.canRotate;

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === viewerRef.current;
      setNativeFullscreen(active);
      if (wasNativeFullscreenRef.current && !active) requestAnimationFrame(() => fullscreenControlRef.current?.focus());
      wasNativeFullscreenRef.current = active;
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (fallbackFullscreen) requestAnimationFrame(() => stageRef.current?.focus());
  }, [fallbackFullscreen]);

  useEffect(() => {
    if (!fallbackFullscreen || !viewerRef.current) return;
    const restored: Array<{ element: HTMLElement; inert: string | null; ariaHidden: string | null }> = [];
    let branch: HTMLElement = viewerRef.current;
    let parent = branch.parentElement;
    while (parent && parent !== document.body) {
      for (const sibling of parent.children) {
        if (!(sibling instanceof HTMLElement) || sibling === branch) continue;
        restored.push({ element: sibling, inert: sibling.getAttribute("inert"), ariaHidden: sibling.getAttribute("aria-hidden") });
        sibling.setAttribute("inert", "");
        sibling.setAttribute("aria-hidden", "true");
      }
      branch = parent;
      parent = parent.parentElement;
    }
    return () => {
      for (const item of restored) {
        if (item.inert === null) item.element.removeAttribute("inert");
        else item.element.setAttribute("inert", item.inert);
        if (item.ariaHidden === null) item.element.removeAttribute("aria-hidden");
        else item.element.setAttribute("aria-hidden", item.ariaHidden);
      }
    };
  }, [fallbackFullscreen]);

  const isExpanded = nativeFullscreen || fallbackFullscreen;
  const isAtMinimumZoom = view.zoom === BOX_VIEW_ZOOMS[0];
  const isAtMaximumZoom = view.zoom === BOX_VIEW_ZOOMS[BOX_VIEW_ZOOMS.length - 1];
  const isInitialView = view.angle === INITIAL_BOX_VIEW_STATE.angle && view.zoom === INITIAL_BOX_VIEW_STATE.zoom;
  const boxStyle: BoxStyle = {
    "--box-width": `${viewer.widthPx}px`,
    "--box-height": `${viewer.heightPx}px`,
    "--box-depth": `${viewer.depthPx}px`,
  };

  const applyAction = (action: BoxViewAction) => {
    if (!canRotate && (action === "rotate-left" || action === "rotate-right")) return;
    setView((current) => reduceBoxView(current, action));
  };
  const exitFallbackFullscreen = () => {
    setFallbackFullscreen(false);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  };
  const toggleFullscreen = async () => {
    if (fallbackFullscreen) {
      exitFallbackFullscreen();
      return;
    }
    if (nativeFullscreen) {
      await document.exitFullscreen?.();
      return;
    }
    returnFocusRef.current = fullscreenControlRef.current;
    try {
      if (!viewerRef.current?.requestFullscreen) throw new Error("Fullscreen API is unavailable");
      await viewerRef.current.requestFullscreen();
    } catch {
      setFallbackFullscreen(true);
    }
  };
  const onStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const actionByKey: Record<string, BoxViewAction | undefined> = {
      "+": "zoom-in",
      "=": "zoom-in",
      "-": "zoom-out",
      Home: "reset",
      "0": "reset",
      ...(canRotate ? { ArrowLeft: "rotate-left" as const, ArrowRight: "rotate-right" as const } : {}),
    };
    if (event.key === "Escape" && fallbackFullscreen) {
      event.preventDefault();
      exitFallbackFullscreen();
      return;
    }
    const action = actionByKey[event.key];
    if (action) {
      event.preventDefault();
      applyAction(action);
    }
  };
  const onDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && fallbackFullscreen) {
      event.preventDefault();
      exitFallbackFullscreen();
      return;
    }
    if (event.key !== "Tab" || !fallbackFullscreen || !viewerRef.current) return;
    const focusable = [...viewerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [data-game-box-stage][tabindex="0"]')];
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    if (currentIndex === -1) return;
    const nextIndex = event.shiftKey ? (currentIndex - 1 + focusable.length) % focusable.length : (currentIndex + 1) % focusable.length;
    event.preventDefault();
    focusable[nextIndex]?.focus();
  };

  const statusText = frontSrc
    ? "Published AI-generated GameAtlas editorial art on a governed package front"
    : approvedFrontSrc
      ? "Approved package front unavailable — GameAtlas reference case shown"
      : "GameAtlas reference case — a package front has not been published";
  const profileCategory = readableProfileCategory(profile.category);
  const viewerDescription = presentation.formatKind === "physical"
    ? `${profileCategory} model with a visible spine and proportional package depth.`
    : "Flat digital presentation with no invented physical package.";
  const renderedAngle = viewer.restAngle + (canRotate ? view.angle : 0);

  return <section
    className={`game-box-viewer game-box-viewer--${presentation.formatKind}${fallbackFullscreen ? " game-box-viewer--fallback-fullscreen" : ""}`}
    ref={viewerRef}
    aria-labelledby="package-view-heading"
    role={fallbackFullscreen ? "dialog" : undefined}
    aria-modal={fallbackFullscreen || undefined}
    onKeyDownCapture={onDialogKeyDown}
  >
    <div className="game-box-viewer-heading">
      <p className="eyebrow">Interactive package view</p>
      <h2 id="package-view-heading">{presentation.platformLabel}</h2>
      <p>{viewerDescription}</p>
      <p className="game-box-viewer-status" data-art-state={frontSrc ? "approved" : approvedFrontSrc ? "fallback" : "reference"}><span className="game-box-viewer-status-dot" aria-hidden="true" />{statusText}</p>
      <p className="game-box-viewer-note">Only approved AI-generated fronts appear as package art. Editorial images remain separate reference art and never become package faces.</p>
    </div>
    <div
      className="game-box-stage"
      ref={stageRef}
      data-game-box-stage="true"
      data-package-profile={profile.id}
      data-package-kind={presentation.formatKind}
      data-package-depth={viewer.depthPx}
      data-package-rest-angle={viewer.restAngle}
      data-box-angle={view.angle}
      data-box-zoom={view.zoom}
      tabIndex={0}
      role="group"
      aria-label={`Interactive package view for ${presentation.title}`}
      aria-describedby="package-view-instructions"
      onKeyDown={onStageKeyDown}
    >
      {presentation.editorialThumbnail ? <img className="game-box-stage__editorial-art" src={presentation.editorialThumbnail.src} alt={presentation.editorialThumbnail.alt} /> : null}
      <div className="game-box" style={{ ...boxStyle, transform: `rotateX(${viewer.tiltAngle}deg) rotateY(${renderedAngle}deg) scale(${view.zoom})` }}>
        <div className="game-box__face game-box__front">
          {frontSrc ? <img src={frontSrc} alt={governedFront?.alt ?? `AI-generated GameAtlas package front for ${presentation.title}`} onError={() => setFailedSource(frontSrc)} /> : <div className="game-box__reference-art" aria-label={`GameAtlas reference front for ${presentation.title}`}><span aria-hidden="true">✦</span></div>}
        </div>
        {presentation.formatKind === "physical" ? <>
          <div className="game-box__face game-box__spine" aria-hidden="true"><span>{presentation.platformLabel}</span></div>
          <div className="game-box__face game-box__back" aria-hidden="true"><span>GAMEATLAS PACKAGE VIEW</span><strong>{profileCategory}</strong><small>Geometry is modeled from a cited platform profile, not copied packaging.</small></div>
          <div className="game-box__face game-box__base" aria-hidden="true" />
        </> : null}
      </div>
    </div>
    <p className="game-box-instructions" id="package-view-instructions">{canRotate ? "Use the controls, or focus the package and press Left/Right to rotate, plus/minus to zoom, and Home or 0 to reset." : "Use plus/minus to zoom and Home or 0 to reset. Digital profiles stay flat."}</p>
    <div className={`game-box-controls${canRotate ? "" : " game-box-controls--flat"}`} aria-label="Package view controls">
      {canRotate ? <>
        <button type="button" data-box-action="rotate-left" onClick={() => applyAction("rotate-left")}>Rotate left</button>
        <button type="button" data-box-action="rotate-right" onClick={() => applyAction("rotate-right")}>Rotate right</button>
      </> : null}
      <button type="button" data-box-action="zoom-out" onClick={() => applyAction("zoom-out")} disabled={isAtMinimumZoom}>Zoom out</button>
      <button type="button" data-box-action="zoom-in" onClick={() => applyAction("zoom-in")} disabled={isAtMaximumZoom}>Zoom in</button>
      <button type="button" data-box-action="reset" onClick={() => applyAction("reset")} disabled={isInitialView}>Reset view</button>
      <button type="button" data-box-action="fullscreen" ref={fullscreenControlRef} onClick={() => void toggleFullscreen()}>{isExpanded ? "Exit fullscreen" : "Fullscreen"}</button>
    </div>
    <p className="visually-hidden" aria-live="polite">{`${describeBoxView(view)}${isExpanded ? " Fullscreen package view." : ""}`}</p>
  </section>;
}
