"use client";

import { Minus, Plus } from "lucide-react";
import { IconButton } from "./primitives";

export default function ZoomBar({
  zoomPct,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoomPct: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute bottom-4 right-4 z-40 flex items-center gap-0.5 rounded-2xl border border-neutral-200 bg-white/90 p-1.5 shadow-xl shadow-neutral-900/5 backdrop-blur">
      <IconButton label="Zoom out · ⌘−" onClick={onZoomOut} tipSide="bottom">
        <Minus className="size-[18px]" />
      </IconButton>
      <button
        type="button"
        onClick={onReset}
        className="min-w-14 cursor-pointer rounded-xl px-2 py-1.5 text-xs font-medium tabular-nums text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        aria-label="Reset view"
      >
        {zoomPct}%
      </button>
      <IconButton label="Zoom in · ⌘+" onClick={onZoomIn} tipSide="bottom">
        <Plus className="size-[18px]" />
      </IconButton>
    </div>
  );
}
