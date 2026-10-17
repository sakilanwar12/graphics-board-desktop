import type { Bounds, Element, Point, Viewport } from "./types";

let handFontFamily = '"Patrick Hand", cursive';

export function setHandFontFamily(family: string) {
  handFontFamily = family;
}

export function getHandFontFamily(): string {
  return handFontFamily;
}

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  return measureCtx;
}

export function screenToWorld(p: { x: number; y: number }, vp: Viewport): Point {
  return {
    x: (p.x - vp.panX) / vp.zoom,
    y: (p.y - vp.panY) / vp.zoom,
    pressure: 0.5,
  };
}

export function worldToScreen(
  p: { x: number; y: number },
  vp: Viewport
): { x: number; y: number } {
  return { x: p.x * vp.zoom + vp.panX, y: p.y * vp.zoom + vp.panY };
}

export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function polylineHits(
  pts: Point[],
  x: number,
  y: number,
  tol: number
): boolean {
  if (pts.length === 1) return Math.hypot(x - pts[0].x, y - pts[0].y) <= tol;
  for (let i = 1; i < pts.length; i++) {
    if (
      distanceToSegment(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <=
      tol
    ) {
      return true;
    }
  }
  return false;
}

function rectPolyline(x0: number, y0: number, x1: number, y1: number): Point[] {
  return [
    { x: x0, y: y0, pressure: 1 },
    { x: x1, y: y0, pressure: 1 },
    { x: x1, y: y1, pressure: 1 },
    { x: x0, y: y1, pressure: 1 },
    { x: x0, y: y0, pressure: 1 },
  ];
}

function ellipsePolyline(b: Bounds, samples = 40): Point[] {
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const rx = (b.maxX - b.minX) / 2;
  const ry = (b.maxY - b.minY) / 2;
  const pts: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, pressure: 1 });
  }
  return pts;
}

export function shapeBounds(
  start: { x: number; y: number },
  end: { x: number; y: number }
): Bounds {
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  };
}

export function textSize(
  text: string,
  fontSize: number
): { width: number; height: number; lines: string[] } {
  const lines = text.split("\n");
  const lineHeight = fontSize * 1.25;
  const ctx = getMeasureCtx();
  let width = 0;
  if (ctx) {
    ctx.font = `${fontSize}px ${handFontFamily}`;
    for (const line of lines) {
      width = Math.max(width, ctx.measureText(line).width);
    }
  } else {
    for (const line of lines) {
      width = Math.max(width, line.length * fontSize * 0.52);
    }
  }
  return {
    width: Math.max(width, fontSize * 0.6),
    height: lines.length * lineHeight,
    lines,
  };
}

export function elementBounds(el: Element): Bounds {
  if (el.type === "stroke") {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = el.size / 2 + 2;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }
  if (el.type === "text") {
    const s = textSize(el.text, el.fontSize);
    return {
      minX: el.x,
      minY: el.y,
      maxX: el.x + s.width,
      maxY: el.y + s.height,
    };
  }
  const b = shapeBounds(el.start, el.end);
  const pad = el.size / 2 + 2;
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

export function sceneBounds(els: Element[]): Bounds | null {
  if (!els.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of els) {
    const b = elementBounds(el);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return { minX, minY, maxX, maxY };
}

export function elementHitTest(el: Element, pt: { x: number; y: number }, tol: number): boolean {
  if (el.type === "text") {
    const b = elementBounds(el);
    return (
      pt.x >= b.minX - tol &&
      pt.x <= b.maxX + tol &&
      pt.y >= b.minY - tol &&
      pt.y <= b.maxY + tol
    );
  }
  if (el.type === "stroke") {
    return polylineHits(el.points, pt.x, pt.y, tol + el.size / 2);
  }
  const b = shapeBounds(el.start, el.end);
  const pad = tol + el.size / 2;
  if (el.type === "line" || el.type === "arrow") {
    return polylineHits([el.start, el.end], pt.x, pt.y, pad);
  }
  if (el.type === "rect") {
    return polylineHits(
      rectPolyline(b.minX, b.minY, b.maxX, b.maxY),
      pt.x,
      pt.y,
      pad
    );
  }
  if (el.type === "ellipse") {
    return polylineHits(ellipsePolyline(b), pt.x, pt.y, pad);
  }
  const tri: Point[] = [
    { x: (b.minX + b.maxX) / 2, y: b.minY, pressure: 1 },
    { x: b.maxX, y: b.maxY, pressure: 1 },
    { x: b.minX, y: b.maxY, pressure: 1 },
    { x: (b.minX + b.maxX) / 2, y: b.minY, pressure: 1 },
  ];
  return polylineHits(tri, pt.x, pt.y, pad);
}

export function translateElement(el: Element, dx: number, dy: number): Element {
  if (el.type === "stroke") {
    return {
      ...el,
      points: el.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    };
  }
  if (el.type === "text") {
    return { ...el, x: el.x + dx, y: el.y + dy };
  }
  return {
    ...el,
    start: { ...el.start, x: el.start.x + dx, y: el.start.y + dy },
    end: { ...el.end, x: el.end.x + dx, y: el.end.y + dy },
  };
}

export function constrainShape(
  start: Point,
  end: Point,
  shift: boolean,
  type: Element["type"]
): Point {
  if (!shift) return end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (type === "line" || type === "arrow") {
    const angle = Math.atan2(dy, dx);
    const snapped = (Math.round(angle / (Math.PI / 4)) * Math.PI) / 4;
    const len = Math.hypot(dx, dy);
    return {
      ...end,
      x: start.x + Math.cos(snapped) * len,
      y: start.y + Math.sin(snapped) * len,
    };
  }
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    ...end,
    x: start.x + Math.sign(dx || 1) * side,
    y: start.y + Math.sign(dy || 1) * side,
  };
}

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
