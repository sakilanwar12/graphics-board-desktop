"use client";

import { Pause, Play, Square } from "lucide-react";
import type { RecorderStatus } from "./useScreenRecorder";
import { IconButton } from "./primitives";

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [String(m).padStart(2, "0"), String(sec).padStart(2, "0")];
  if (h > 0) parts.unshift(String(h));
  return parts.join(":");
}

export default function RecorderPill({
  status,
  elapsed,
  onPause,
  onResume,
  onStop,
}: {
  status: RecorderStatus;
  elapsed: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const recording = status === "recording";
  return (
    <div className="absolute left-4 top-4 z-50 flex items-center gap-0.5 rounded-2xl border border-neutral-200 bg-white/95 py-1.5 pl-4 pr-1.5 shadow-xl shadow-neutral-900/10 backdrop-blur">
      <span className="relative mr-2 flex size-2.5">
        {recording && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
        )}
        <span
          className={`relative inline-flex size-2.5 rounded-full ${
            recording ? "bg-red-500" : "bg-amber-400"
          }`}
        />
      </span>
      <span
        className="mr-1 min-w-14 text-sm font-semibold tabular-nums text-neutral-900"
        aria-label={recording ? "Recording" : "Recording paused"}
      >
        {formatDuration(elapsed)}
      </span>
      <div className="mx-0.5 h-5 w-px bg-neutral-200" />
      {recording ? (
        <IconButton label="Pause recording" onClick={onPause} tipSide="bottom">
          <Pause className="size-[18px]" />
        </IconButton>
      ) : (
        <IconButton label="Resume recording" onClick={onResume} tipSide="bottom">
          <Play className="size-[18px]" />
        </IconButton>
      )}
      <IconButton label="Stop & save" onClick={onStop} tipSide="bottom">
        <Square className="size-4 fill-red-500 text-red-500" />
      </IconButton>
    </div>
  );
}
