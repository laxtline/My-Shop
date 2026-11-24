"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Product } from "@shared/types";
import { primaryImage } from "@/lib/format";
import { cn } from "@/lib/cn";
import { imageUrl } from '@shared/images';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

type Offset = { x: number; y: number };

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

/** Chevron used by the inline pager, lightbox pager and zoom buttons. */
function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
      <path
        d={direction === "left" ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full-screen image viewer with pager and zoom, modelled on marketplace
 * product pages: arrow keys browse in order, +/- (or the wheel) zoom,
 * double-click toggles zoom, and drag pans while zoomed.
 */
function ImageLightbox({
  images,
  index,
  title,
  onChange,
  onClose,
}: {
  images: string[];
  index: number;
  title: string;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const total = images.length;
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((direction: 1 | -1) => {
    setZoom((current) => clampZoom(current + direction * ZOOM_STEP));
  }, []);

  const goTo = useCallback(
    (step: 1 | -1) => {
      onChange((index + step + total) % total);
      resetView();
    },
    [index, total, onChange, resetView]
  );

  // Reset zoom whenever the image changes.
  useEffect(() => {
    resetView();
  }, [index, resetView]);

  // Clear any pan when fully zoomed out.
  useEffect(() => {
    if (zoom === 1) setOffset({ x: 0, y: 0 });
  }, [zoom]);

  // Lock page scroll, trap focus on open, and wire keyboard shortcuts.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          onClose();
          break;
        case "ArrowLeft":
          event.preventDefault();
          goTo(-1);
          break;
        case "ArrowRight":
          event.preventDefault();
          goTo(1);
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomBy(1);
          break;
        case "-":
        case "_":
          event.preventDefault();
          zoomBy(-1);
          break;
        case "0":
          event.preventDefault();
          resetView();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [goTo, onClose, resetView, zoomBy]);

  // Wheel zoom needs a non-passive native listener to stop page scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // leave pinch/ctrl-zoom to the browser
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1 : -1);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const toggleZoom = () => {
    if (zoom > 1) {
      resetView();
    } else {
      setZoom(2.5);
    }
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (zoom === 1) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} Ã¢â‚¬â€ image viewer`}
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 text-white backdrop-blur-sm"
    >
      {/* Top bar: counter, close */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <span className="text-sm font-medium tabular-nums text-white/80" aria-live="polite">
          {index + 1} / {total}
        </span>
        <span className="hidden max-w-md truncate text-sm text-white/60 sm:block">{title}</span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus-ring"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Image stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
        {total > 1 && (
          <button
            type="button"
            onClick={() => goTo(-1)}
            aria-label="Previous image"
            className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/25 focus-ring sm:left-4"
          >
            <ArrowIcon direction="left" />
          </button>
        )}

        <div
          ref={stageRef}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn(
            "flex h-full w-full touch-none items-center justify-center overflow-hidden",
            zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={images[index]}
            src={imageUrl(images[index], 1600, 1600)}
            alt={`${title} Ã¢â‚¬â€ image ${index + 1} of ${total}`}
            draggable={false}
            onDoubleClick={toggleZoom}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
            className="max-h-full max-w-full select-none object-contain transition-transform duration-150 ease-out will-change-transform"
          />
        </div>

        {total > 1 && (
          <button
            type="button"
            onClick={() => goTo(1)}
            aria-label="Next image"
            className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/25 focus-ring sm:right-4"
          >
            <ArrowIcon direction="right" />
          </button>
        )}
      </div>

      {/* Zoom controls + thumbnails */}
      <div className="space-y-3 px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => zoomBy(-1)}
            disabled={zoom === 1}
            aria-label="Zoom out"
            className="rounded-full bg-white/10 p-2 transition hover:bg-white/25 disabled:opacity-40 focus-ring"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
              <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="w-14 text-center text-xs tabular-nums text-white/70">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => zoomBy(1)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="rounded-full bg-white/10 p-2 transition hover:bg-white/25 disabled:opacity-40 focus-ring"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={resetView}
            disabled={zoom === 1}
            className="ml-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium transition hover:bg-white/25 disabled:opacity-40 focus-ring"
          >
            Reset
          </button>
        </div>

        {total > 1 && (
          <div className="flex justify-center gap-2 overflow-x-auto pb-1">
            {images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => {
                  onChange(i);
                  resetView();
                }}
                aria-label={`Go to image ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-14 sm:w-14",
                  i === index ? "border-white" : "border-white/25 hover:border-white/60"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(src, 128, 128)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <p className="hidden text-center text-[11px] text-white/50 sm:block">
          Use the arrow keys to browse, scroll or + / Ã¢Ë†â€™ to zoom, double-click to toggle zoom, Esc to close.
        </p>
      </div>
    </div>
  );
}

/** Main image with pager, full-screen viewer and selectable thumbnails. */
export function ProductGallery({ product }: { product: Product }) {
  const images = product.images?.length ? product.images : [primaryImage(product)];
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const total = images.length;

  if (active > total - 1) {
    // Product images changed (e.g. live refresh) Ã¢â‚¬â€ fall back to the first.
    setActive(0);
  }

  const step = (direction: 1 | -1) => setActive((current) => (current + direction + total) % total);

  return (
    <div>
      <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open image ${active + 1} of ${total} full screen`}
          className="block w-full cursor-zoom-in focus-ring"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(images[active], 960, 960)}
            decoding="async"
            alt={product.title}
            className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </button>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700 opacity-80 shadow-card transition hover:bg-white hover:opacity-100 focus-visible:opacity-100"
            >
              <ArrowIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700 opacity-80 shadow-card transition hover:bg-white hover:opacity-100 focus-visible:opacity-100"
            >
              <ArrowIcon direction="right" />
            </button>
          </>
        )}

        <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-slate-900/60 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
            <path
              d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Click to expand
        </span>
      </div>

      {total > 1 && (
        <div className="mt-3 flex gap-2">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
              className={cn(
                "h-16 w-16 overflow-hidden rounded-lg border-2 focus-ring",
                i === active ? "border-brand" : "border-transparent hover:border-slate-200"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(src, 128, 128)} loading="lazy" decoding="async" alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <ImageLightbox
          images={images}
          index={active}
          title={product.title}
          onChange={setActive}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

