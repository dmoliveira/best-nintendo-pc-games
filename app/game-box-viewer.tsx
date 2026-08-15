"use client";
/* eslint-disable @next/next/no-img-element -- static export uses locally governed, base-prefixed asset URLs. */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { BOX_VIEW_ZOOMS, describeBoxView, INITIAL_BOX_VIEW_STATE, nearestEquivalentBoxAngle, reduceBoxView, renderBoxAngle, snapBoxAngle, type BoxViewAction, type BoxViewState } from "@/lib/box-art/view-state";
import type { PackagePresentation } from "@/lib/box-art/package-engine";

type BoxStyle = CSSProperties & Record<"--box-width" | "--box-height" | "--box-depth", string>;
const dragDegreesPerPixel = 0.6;

interface DragState {
  pointerId: number;
  startAngle: number;
  startX: number;
}

function readableProfileCategory(value: string): string {
  return value.replace(/-/g, " ");
}

export default function GameBoxViewer({ presentation }: { presentation: PackagePresentation }) {
  const [view, setView] = useState<BoxViewState>(INITIAL_BOX_VIEW_STATE);
  const [visualAngle, setVisualAngle] = useState<number>(INITIAL_BOX_VIEW_STATE.angle);
  const [isDragging, setIsDragging] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const viewRef = useRef<BoxViewState>(INITIAL_BOX_VIEW_STATE);
  const visualAngleRef = useRef<number>(INITIAL_BOX_VIEW_STATE.angle);
  const dragRef = useRef<DragState | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const viewerRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fullscreenControlRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasNativeFullscreenRef = useRef(false);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const { viewer, profile, governedFront } = presentation;
  const approvedFrontSrc = governedFront?.src;
  const frontSrc = failedSource === approvedFrontSrc ? undefined : approvedFrontSrc;
  const isSourceListedReference = presentation.presentationMode === "source-listed-reference";
  const canRotate = viewer.canRotate && presentation.formatKind === "physical" && !isSourceListedReference;
  const setStageRef = useCallback((node: HTMLDivElement | null) => {
    stageRef.current = node;
    if (node) node.dataset.boxHydrated = "true";
  }, []);

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

  useEffect(() => () => {
    if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
  }, []);

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
    // Drag updates are animation-frame driven; CSS interpolation can turn an equivalent angle into a full spin.
    transition: "none",
    willChange: isDragging ? "transform" : undefined,
  };
  const stageStyle: CSSProperties | undefined = canRotate ? { cursor: isDragging ? "grabbing" : "grab", touchAction: "pan-y", userSelect: "none" } : undefined;

  const flushVisualAngle = (angle: number): number => {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    visualAngleRef.current = angle;
    setVisualAngle(angle);
    return angle;
  };
  const queueVisualAngle = (angle: number) => {
    visualAngleRef.current = angle;
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      setVisualAngle(visualAngleRef.current);
    });
  };
  const commitView = (nextView: BoxViewState, nextVisualAngle = visualAngleRef.current) => {
    viewRef.current = nextView;
    visualAngleRef.current = nextVisualAngle;
    setView(nextView);
    setVisualAngle(nextVisualAngle);
  };
  const cancelActiveDrag = (pointerId?: number) => {
    const drag = dragRef.current;
    if (!drag || (pointerId !== undefined && pointerId !== drag.pointerId)) return;
    dragRef.current = null;
    if (stageRef.current?.hasPointerCapture(drag.pointerId)) stageRef.current.releasePointerCapture(drag.pointerId);
    flushVisualAngle(drag.startAngle);
    setIsDragging(false);
  };

  const applyAction = (action: BoxViewAction) => {
    if (!canRotate && (action === "rotate-left" || action === "rotate-right")) return;
    cancelActiveDrag();
    const nextView = reduceBoxView(viewRef.current, action);
    const nextVisualAngle = action === "reset"
      ? INITIAL_BOX_VIEW_STATE.angle
      : action === "rotate-left" || action === "rotate-right"
        ? nearestEquivalentBoxAngle(visualAngleRef.current, nextView.angle)
        : visualAngleRef.current;
    commitView(nextView, nextVisualAngle);
  };
  const onStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canRotate || dragRef.current || !event.isPrimary || event.button !== 0) return;
    const stage = event.currentTarget;
    const startAngle = visualAngleRef.current;
    dragRef.current = { pointerId: event.pointerId, startAngle, startX: event.clientX };
    stage.setPointerCapture(event.pointerId);
    stage.focus({ preventScroll: true });
    setIsDragging(true);
    event.preventDefault();
  };
  const onStagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    queueVisualAngle(drag.startAngle + (event.clientX - drag.startX) * dragDegreesPerPixel);
    event.preventDefault();
  };
  const onStagePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const finalAngle = drag.startAngle + (event.clientX - drag.startX) * dragDegreesPerPixel;
    const snappedAngle = snapBoxAngle(finalAngle);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    flushVisualAngle(finalAngle);
    setIsDragging(false);
    commitView({ ...viewRef.current, angle: snappedAngle }, nearestEquivalentBoxAngle(finalAngle, snappedAngle));
    event.preventDefault();
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

  const statusText = isSourceListedReference
    ? "GameAtlas reference presentation — no platform-specific package is implied"
    : frontSrc
      ? "Published AI-generated GameAtlas editorial art on a governed package front"
      : approvedFrontSrc
        ? "Approved package front unavailable — GameAtlas reference case shown"
        : "GameAtlas reference case — a package front has not been published";
  const profileCategory = readableProfileCategory(profile.category);
  const profileMaterial = readableProfileCategory(profile.material);
  const profileOpening = profile.openingSide === "none" ? "No opening" : `Opens ${readableProfileCategory(profile.openingSide)}`;
  const viewerDescription = isSourceListedReference
    ? "Flat GameAtlas reference presentation; it does not represent platform-specific packaging or a verified platform release."
    : presentation.formatKind === "physical"
      ? `${profileCategory} model with a visible spine and proportional package depth.`
      : "Flat digital presentation with no invented physical package.";
  const renderedAngle = canRotate ? renderBoxAngle(visualAngle, viewer.restAngle) : 0;

  return <section
    className={`game-box-viewer game-box-viewer--${presentation.formatKind}${isSourceListedReference ? " game-box-viewer--reference" : ""}${fallbackFullscreen ? " game-box-viewer--fallback-fullscreen" : ""}`}
    ref={viewerRef}
    aria-labelledby="package-view-heading"
    role={fallbackFullscreen ? "dialog" : undefined}
    aria-modal={fallbackFullscreen || undefined}
    onKeyDownCapture={onDialogKeyDown}
  >
    <div className="game-box-viewer-heading">
      <p className="eyebrow">{isSourceListedReference ? "Catalog reference view" : "Interactive package view"}</p>
      <h2 id="package-view-heading">{presentation.platformLabel}</h2>
      <p>{viewerDescription}</p>
      <p className="game-box-viewer-status" data-art-state={frontSrc ? "approved" : approvedFrontSrc ? "fallback" : "reference"}><span className="game-box-viewer-status-dot" aria-hidden="true" />{statusText}</p>
      <p className="game-box-viewer-note">Only approved AI-generated fronts appear as package art. Spine and back labels are original GameAtlas editorial panels, not publisher or platform packaging.</p>
    </div>
    <div
      className="game-box-stage"
      ref={setStageRef}
      data-game-box-stage="true"
      data-package-profile={profile.id}
      data-package-kind={presentation.formatKind}
      data-presentation-mode={presentation.presentationMode}
      data-package-depth={viewer.depthPx}
      data-package-rest-angle={viewer.restAngle}
      data-box-angle={view.angle}
      data-box-drag-angle={visualAngle.toFixed(1)}
      data-box-dragging={isDragging ? "true" : "false"}
      data-box-zoom={view.zoom}
      style={stageStyle}
      tabIndex={0}
      role="group"
      aria-label={`${isSourceListedReference ? "Catalog reference view" : "Interactive package view"} for ${presentation.title}`}
      aria-describedby="package-view-instructions"
      onKeyDown={onStageKeyDown}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={onStagePointerUp}
      onPointerCancel={(event) => cancelActiveDrag(event.pointerId)}
      onLostPointerCapture={(event) => cancelActiveDrag(event.pointerId)}
    >
        <div className="game-box" style={{ ...boxStyle, transform: `rotateX(${viewer.tiltAngle}deg) rotateY(${renderedAngle}deg) scale(${view.zoom})` }}>
          <div className="game-box__face game-box__front">
            {frontSrc ? <img src={frontSrc} alt={governedFront?.alt ?? `AI-generated GameAtlas package front for ${presentation.title}`} loading="eager" decoding="async" fetchPriority="high" onError={() => setFailedSource(frontSrc)} /> : <div className="game-box__reference-art" role="img" aria-label={`GameAtlas reference front for ${presentation.title}`}><span aria-hidden="true">✦</span></div>}
          </div>
          {presentation.formatKind === "physical" ? <>
            <div className="game-box__face game-box__spine game-box__spine--right" data-box-surface="spine-right" data-box-spine-label={presentation.title} aria-hidden="true"><div className="game-box__spine-label">{presentation.title}</div></div>
            <div className="game-box__face game-box__spine game-box__spine--left" data-box-surface="spine-left" data-box-spine-label={presentation.title} aria-hidden="true"><div className="game-box__spine-label">{presentation.title}</div></div>
            <div className="game-box__face game-box__back" data-box-surface="back" aria-hidden="true">
              <div className="game-box__back-header">
                <span className="game-box__back-kicker">GameAtlas edition</span>
                <strong className="game-box__back-title" data-box-back-title={presentation.title}>{presentation.title}</strong>
                <small className="game-box__back-platform">{presentation.platformLabel}</small>
              </div>
              <dl className="game-box__back-facts">
                <div className="game-box__back-fact" data-box-back-fact="profile"><dt>Profile</dt><dd>{profileCategory}</dd></div>
                <div className="game-box__back-fact" data-box-back-fact="material"><dt>Material</dt><dd>{profileMaterial}</dd></div>
                <div className="game-box__back-fact game-box__back-fact--opening" data-box-back-fact="opening"><dt>Opening</dt><dd>{profileOpening}</dd></div>
              </dl>
              <p className="game-box__back-disclaimer">Original GameAtlas geometry — not official package artwork.</p>
            </div>
            <div className="game-box__face game-box__base" aria-hidden="true" />
          </> : null}
        </div>
      {presentation.editorialThumbnail ? <img className="game-box-stage__editorial-art" src={presentation.editorialThumbnail.src} alt={presentation.editorialThumbnail.alt} loading="lazy" decoding="async" fetchPriority="low" /> : null}
    </div>
    <p className="game-box-instructions" id="package-view-instructions">{canRotate ? "Drag the package horizontally, use the controls, or focus it and press Left/Right to rotate. Use plus/minus to zoom and Home or 0 to reset." : "Use plus/minus to zoom and Home or 0 to reset. Digital profiles stay flat."}</p>
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
