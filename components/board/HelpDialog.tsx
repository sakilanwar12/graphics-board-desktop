"use client";

import { X } from "lucide-react";

const TOOL_KEYS: [string, string][] = [
  ["V", "Select & move"],
  ["P", "Pen"],
  ["M", "Highlighter"],
  ["E", "Eraser"],
  ["L", "Line"],
  ["A", "Arrow"],
  ["R", "Rectangle"],
  ["O", "Ellipse"],
  ["Y", "Triangle"],
  ["T", "Text"],
  ["X", "Laser pointer"],
  ["H", "Pan tool"],
];

const ACTION_KEYS: [string, string][] = [
  ["⌘Z", "Undo"],
  ["⇧⌘Z", "Redo"],
  ["⌘S", "Export PNG"],
  ["⌘+ / ⌘−", "Zoom in / out"],
  ["⌘0", "Reset view"],
  ["Space", "Pan while held"],
  ["⌫", "Delete selected"],
  ["Z", "Zen mode"],
  ["F", "Toggle fullscreen"],
  ["Esc", "Deselect / finish text"],
  ["⇧ + drag", "Constrain shapes"],
];

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-neutral-600">
      {children}
    </kbd>
  );
}

export default function HelpDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="animate-overlay-in fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/25 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Help and shortcuts"
        className="animate-dialog-in max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Write math like it&apos;s paper
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              Built for making videos with a graphics tablet — pressure
              sensitive, smooth, and instant to export.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-xl p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <section>
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Tools
            </h3>
            <ul className="space-y-2">
              {TOOL_KEYS.map(([k, label]) => (
                <li
                  key={k}
                  className="flex items-center justify-between text-sm text-neutral-600"
                >
                  {label}
                  <Key>{k}</Key>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Actions
            </h3>
            <ul className="space-y-2">
              {ACTION_KEYS.map(([k, label]) => (
                <li
                  key={k}
                  className="flex items-center justify-between text-sm text-neutral-600"
                >
                  {label}
                  <Key>{k}</Key>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-6 rounded-2xl bg-neutral-50 p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Tips for tablet writers
          </h3>
          <ul className="space-y-1.5 text-sm text-neutral-600">
            <li>
              Your pen&apos;s pressure controls stroke width automatically —
              press harder for bold, lighter for fine details.
            </li>
            <li>
              Use the pen&apos;s barrel eraser button to erase without switching
              tools.
            </li>
            <li>
              Draw with two fingers on a touchscreen to pan and pinch-zoom
              without leaving ink.
            </li>
            <li>
              Laser pointer trails fade away on their own — perfect for guiding
              attention on camera.
            </li>
            <li>
              Hit the record button in the top bar to capture your screen —
              turn on the microphone for voice-over. The MP4 video downloads
              automatically when you stop.
            </li>
            <li>
              The board autosaves in your browser, so you can pick up where you
              left off.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
