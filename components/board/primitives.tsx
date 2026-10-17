"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Check } from "lucide-react";

export function Tip({
  label,
  side = "right",
}: {
  label: string;
  side?: "right" | "bottom";
}) {
  const pos =
    side === "right"
      ? "left-full top-1/2 ml-2 -translate-y-1/2"
      : "top-full left-1/2 mt-2 -translate-x-1/2";
  return (
    <span
      className={`pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity group-hover:block group-hover:opacity-100 ${pos}`}
    >
      {label}
    </span>
  );
}

export function IconButton({
  label,
  onClick,
  active,
  disabled,
  tipSide = "right",
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  tipSide?: "right" | "bottom";
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex size-9 cursor-pointer items-center justify-center rounded-xl transition-colors disabled:opacity-30 disabled:cursor-default ${
        active
          ? "bg-neutral-900 text-white shadow-sm"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:hover:bg-transparent"
      } ${className ?? ""}`}
    >
      {children}
      <Tip label={label} side={tipSide} />
    </button>
  );
}

export function Popover({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`animate-pop-in absolute z-50 mt-2 rounded-2xl border border-neutral-200 bg-white/95 p-2 shadow-xl shadow-neutral-900/10 backdrop-blur ${
        className ?? ""
      }`}
    >
      {children}
    </div>
  );
}

export function MenuItem({
  onClick,
  active,
  icon,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-neutral-100 ${
        active ? "bg-neutral-100 font-medium text-neutral-900" : "text-neutral-700"
      }`}
    >
      {icon}
      {children}
      {active && <Check className="ml-auto size-3.5 text-indigo-500" />}
    </button>
  );
}
