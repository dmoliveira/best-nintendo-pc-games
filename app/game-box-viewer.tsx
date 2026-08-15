"use client";
/* eslint-disable @next/next/no-img-element -- image optimization is disabled for this static GitHub Pages export; this source is manifest-governed. */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { getBoxArtFormat } from "@/lib/box-art/formats";
import { BOX_VIEW_ZOOMS, describeBoxView, INITIAL_BOX_VIEW_STATE, reduceBoxView, type BoxViewAction, type BoxViewState } from "@/lib/box-art/view-state";

interface GameBoxViewerProps {
  title: string;
  platformLabel: string;
  formatId: string;
  frontSrc?: string;
  frontAlt?: string;
  editorialArtSrc?: string;
  editorialArtAlt?: string;
}

type BoxStyle = CSSProperties & Record<"--box-width" | "--box-height" | "--box-depth", string>;

export default function GameBoxViewer({ title, platformLabel, formatId, frontSrc, frontAlt, editorialArtSrc, editorialArtAlt }: GameBoxViewerProps) {
  const format = getBoxArtFormat(formatId);
  const [view, setView] = useState<BoxViewState>(INITIAL_BOX_VIEW_STATE);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const viewerRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fullscreenControlRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasNativeFullscreenRef = useRef(false);

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

  if (!format) return null;

  const isExpanded = nativeFullscreen || fallbackFullscreen;
  const isAtMinimumZoom = view.zoom === BOX_VIEW_ZOOMS[0];
  const isAtMaximumZoom = view.zoom === BOX_VIEW_ZOOMS[BOX_VIEW_ZOOMS.length - 1];
  const isInitialView = view.angle === INITIAL_BOX_VIEW_STATE.angle && view.zoom === INITIAL_BOX_VIEW_STATE.zoom;
  const boxStyle: BoxStyle = {
    "--box-width": `${Math.round(format.dimensions.width * 1.68)}px`,
    "--box-height": `${Math.round(format.dimensions.height * 1.68)}px`,
    "--box-depth": `${Math.max(1, Math.round(format.dimensions.depth * 1.68))}px`,
  };

  const applyAction = (action: BoxViewAction) => setView((current) => reduceBoxView(current, action));
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
      ArrowLeft: "rotate-left",
      ArrowRight: "rotate-right",
      "+": "zoom-in",
      "=": "zoom-in",
      "-": "zoom-out",
      Home: "reset",
      "0": "reset",
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

  return <section
    className={`game-box-viewer game-box-viewer--${format.kind}${fallbackFullscreen ? " game-box-viewer--fallback-fullscreen" : ""}`}
    ref={viewerRef}
    aria-labelledby="package-view-heading"
    role={fallbackFullscreen ? "dialog" : undefined}
    aria-modal={fallbackFullscreen || undefined}
    onKeyDownCapture={onDialogKeyDown}
  >
    <div className="game-box-viewer-heading"><p className="eyebrow">Interactive package view</p><h2 id="package-view-heading">Explore the GameAtlas edition.</h2><p>{frontSrc ? "Original editorial art, displayed on a neutral GameAtlas reference package." : "GameAtlas reference case — original art can be added after it passes the generation and rights review."}</p></div>
    <div
      className={`game-box-stage game-box-stage--${format.accent}`}
      ref={stageRef}
      data-game-box-stage="true"
      data-box-angle={view.angle}
      data-box-zoom={view.zoom}
      tabIndex={0}
      role="group"
      aria-label={`Interactive package view for ${title}`}
      aria-describedby="package-view-instructions"
      onKeyDown={onStageKeyDown}
    >
      {editorialArtSrc ? <img className="game-box-stage__editorial-art" src={editorialArtSrc} alt={editorialArtAlt ?? `Abstract GameAtlas editorial art for ${title}`} /> : null}
      <div className="game-box" style={{ ...boxStyle, transform: `rotateX(-6deg) rotateY(${view.angle}deg) scale(${view.zoom})` }}>
        <div className="game-box__face game-box__front">
          {frontSrc ? <img src={frontSrc} alt={frontAlt ?? `Original GameAtlas editorial front artwork for ${title}`} /> : <div className="game-box__reference-art" aria-label={`GameAtlas reference front for ${title}`}><span aria-hidden="true">✦</span></div>}
          <div className="game-box__front-label"><span>GameAtlas edition</span><strong>{title}</strong><small>{platformLabel}</small></div>
        </div>
        <div className="game-box__face game-box__spine" aria-hidden="true"><span>GameAtlas</span><strong>{title}</strong></div>
        <div className="game-box__face game-box__back" aria-hidden="true"><span>Original editorial package view</span><strong>{format.label}</strong><small>Labels are HTML/CSS, not copied packaging.</small></div>
        <div className="game-box__face game-box__base" aria-hidden="true" />
      </div>
    </div>
    <p className="game-box-instructions" id="package-view-instructions">Use the controls, or focus the package and press Left/Right to rotate, plus/minus to zoom, and Home or 0 to reset.</p>
    <div className="game-box-controls" aria-label="Package view controls">
      <button type="button" data-box-action="rotate-left" onClick={() => applyAction("rotate-left")}>Rotate left</button>
      <button type="button" data-box-action="rotate-right" onClick={() => applyAction("rotate-right")}>Rotate right</button>
      <button type="button" data-box-action="zoom-out" onClick={() => applyAction("zoom-out")} disabled={isAtMinimumZoom}>Zoom out</button>
      <button type="button" data-box-action="zoom-in" onClick={() => applyAction("zoom-in")} disabled={isAtMaximumZoom}>Zoom in</button>
      <button type="button" data-box-action="reset" onClick={() => applyAction("reset")} disabled={isInitialView}>Reset view</button>
      <button type="button" data-box-action="fullscreen" ref={fullscreenControlRef} onClick={() => void toggleFullscreen()}>{isExpanded ? "Exit fullscreen" : "Fullscreen"}</button>
    </div>
    <p className="visually-hidden" aria-live="polite">{`${describeBoxView(view)}${isExpanded ? " Fullscreen package view." : ""}`}</p>
  </section>;
}
