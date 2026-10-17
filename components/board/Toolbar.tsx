"use client";

import type { ComponentType } from "react";
import {
  Circle,
  Eraser,
  Hand,
  Highlighter,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Square,
  Triangle,
  Type,
  Zap,
} from "lucide-react";
import type { Tool } from "@/lib/types";
import { COLORS, ERASER_SIZES, FONT_SIZES, PEN_SIZES } from "@/lib/theme";
import { IconButton } from "./primitives";

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

interface ToolDef {
  id: Tool;
  label: string;
  icon: IconType;
}

const SECTIONS: ToolDef[][] = [
  [
    { id: "select", label: "Select · V", icon: MousePointer2 },
    { id: "pan", label: "Pan · H or Space", icon: Hand },
  ],
  [
    { id: "pen", label: "Pen · P", icon: Pencil },
    { id: "highlighter", label: "Highlighter · M", icon: Highlighter },
    { id: "eraser", label: "Eraser · E", icon: Eraser },
  ],
  [
    { id: "line", label: "Line · L or 1", icon: Minus },
    { id: "arrow", label: "Arrow · A or 2", icon: MoveUpRight },
    { id: "rect", label: "Rectangle · R or 3", icon: Square },
    { id: "ellipse", label: "Ellipse · O or 4", icon: Circle },
    { id: "triangle", label: "Triangle · Y or 5", icon: Triangle },
  ],
  [
    { id: "text", label: "Text · T", icon: Type },
    { id: "laser", label: "Laser pointer · X", icon: Zap },
  ],
];

const DRAW_TOOLS: Tool[] = [
  "pen",
  "highlighter",
  "eraser",
  "line",
  "arrow",
  "rect",
  "ellipse",
  "triangle",
  "text",
];

export default function Toolbar({
  tool,
  onTool,
  color,
  onColor,
  size,
  onSize,
  eraserSize,
  onEraserSize,
  fontSize,
  onFontSize,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  color: string;
  onColor: (c: string) => void;
  size: number;
  onSize: (s: number) => void;
  eraserSize: number;
  onEraserSize: (s: number) => void;
  fontSize: number;
  onFontSize: (s: number) => void;
}) {
  const showOptions = DRAW_TOOLS.includes(tool);
  const showColors = tool !== "eraser";
  const sizes =
    tool === "eraser" ? ERASER_SIZES : tool === "text" ? FONT_SIZES : PEN_SIZES;
  const currentSize =
    tool === "eraser" ? eraserSize : tool === "text" ? fontSize : size;
  const onSizeChange =
    tool === "eraser" ? onEraserSize : tool === "text" ? onFontSize : onSize;
  const sizeLabel =
    tool === "eraser"
      ? "Eraser size"
      : tool === "text"
        ? "Text size"
        : "Stroke width";

  return (
    <div className="pointer-events-none absolute inset-y-0 left-4 z-40 flex items-center">
      <div className="pointer-events-auto flex max-h-[calc(100dvh-2rem)] flex-col items-center gap-0.5 overflow-y-auto rounded-2xl border border-neutral-200 bg-white/90 p-1.5 shadow-xl shadow-neutral-900/5 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((section, si) => (
          <div key={si} className="flex flex-col items-center gap-0.5">
            {si > 0 && <div className="my-1 h-px w-6 bg-neutral-200" />}
            {section.map((t) => (
              <IconButton
                key={t.id}
                label={t.label}
                active={tool === t.id}
                onClick={() => onTool(t.id)}
              >
                <t.icon className="size-[18px]" />
              </IconButton>
            ))}
          </div>
        ))}
      </div>

      {showOptions && (
        <div className="pointer-events-auto ml-2.5 w-56 rounded-2xl border border-neutral-200 bg-white/90 p-3 shadow-xl shadow-neutral-900/5 backdrop-blur">
          {showColors && (
            <>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Color
              </p>
              <div className="grid grid-cols-5 gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => onColor(c)}
                    className={`size-7 cursor-pointer rounded-full border border-black/10 transition-transform hover:scale-110 ${
                      color === c
                        ? "ring-2 ring-neutral-900 ring-offset-2"
                        : ""
                    }`}
                    style={{ background: c }}
                  />
                ))}
                <label
                  className={`relative flex size-7 cursor-pointer items-center justify-center rounded-full border border-black/10 transition-transform hover:scale-110 ${
                    !COLORS.includes(color)
                      ? "ring-2 ring-neutral-900 ring-offset-2"
                      : ""
                  }`}
                  style={{
                    background: COLORS.includes(color)
                      ? "conic-gradient(from 180deg, #f87171, #fbbf24, #4ade80, #22d3ee, #818cf8, #f472b6, #f87171)"
                      : color,
                  }}
                >
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => onColor(e.target.value)}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    aria-label="Custom color"
                  />
                </label>
              </div>
            </>
          )}
          <p
            className={`mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400 ${
              showColors ? "mt-3.5" : ""
            }`}
          >
            {sizeLabel}
          </p>
          <div className="flex items-center gap-1.5">
            {sizes.map((s) => {
              const active = currentSize === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-label={`${sizeLabel} ${s}`}
                  onClick={() => onSizeChange(s)}
                  className={`flex size-9 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                    active
                      ? "bg-neutral-900"
                      : "hover:bg-neutral-100"
                  }`}
                >
                  {tool === "text" ? (
                    <span
                      className={`font-medium leading-none ${
                        active ? "text-white" : "text-neutral-700"
                      }`}
                      style={{ fontSize: Math.max(10, s * 0.42) }}
                    >
                      A
                    </span>
                  ) : (
                    <span
                      className={`rounded-full ${
                        active ? "bg-white" : "bg-neutral-700"
                      }`}
                      style={{
                        width: tool === "eraser" ? Math.max(6, s * 0.45) : Math.max(3, s),
                        height: tool === "eraser" ? Math.max(6, s * 0.45) : Math.max(3, s),
                        boxShadow:
                          tool === "eraser" && !active
                            ? "0 0 0 1.5px rgba(24,24,27,0.25)"
                            : undefined,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
