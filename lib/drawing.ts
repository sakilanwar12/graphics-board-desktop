import getStroke from "perfect-freehand";
import { GRID_STEP, HIGHLIGHTER_ALPHA, LASER_LIFE, RULED_STEP } from "./theme";
import { getHandFontFamily, elementBounds, shapeBounds, textSize } from "./geometry";
import type {
  BackgroundStyle,
  LaserPoint,
  ShapeElement,
  StrokeElement,
  TextElement,
} from "./types";

export const HAND_FONT_FALLBACK = '"Patrick Hand", "Comic Sans MS", cursive';

export interface ViewRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function gridStepFor(zoom: number): number {
  let step = GRID_STEP;
  while (step * zoom < 14) step *= 2;
  return step;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  style: BackgroundStyle,
  rect: ViewRect,
  zoom: number
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
  if (style === "plain") return;

  ctx.save();
  if (style === "ruled") {
    ctx.strokeStyle = "rgba(96,165,250,0.22)";
    ctx.lineWidth = 1 / zoom;
    const startY = Math.floor(rect.y0 / RULED_STEP) * RULED_STEP;
    ctx.beginPath();
    for (let y = startY; y <= rect.y1; y += RULED_STEP) {
      ctx.moveTo(rect.x0, y);
      ctx.lineTo(rect.x1, y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  const step = gridStepFor(zoom);
  if (style === "dots") {
    ctx.fillStyle = "rgba(24,24,27,0.22)";
    const r = Math.max(1.1, 1.5);
    const startX = Math.floor(rect.x0 / step) * step;
    const startY = Math.floor(rect.y0 / step) * step;
    ctx.beginPath();
    for (let x = startX; x <= rect.x1; x += step) {
      for (let y = startY; y <= rect.y1; y += step) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.strokeStyle = style === "axes" ? "rgba(24,24,27,0.06)" : "rgba(24,24,27,0.07)";
  ctx.lineWidth = 1 / zoom;
  const startX = Math.floor(rect.x0 / step) * step;
  const startY = Math.floor(rect.y0 / step) * step;
  ctx.beginPath();
  for (let x = startX; x <= rect.x1; x += step) {
    ctx.moveTo(x, rect.y0);
    ctx.lineTo(x, rect.y1);
  }
  for (let y = startY; y <= rect.y1; y += step) {
    ctx.moveTo(rect.x0, y);
    ctx.lineTo(rect.x1, y);
  }
  ctx.stroke();

  if (style === "axes") {
    ctx.strokeStyle = "rgba(24,24,27,0.34)";
    ctx.lineWidth = 1.6 / zoom;
    ctx.beginPath();
    ctx.moveTo(0, rect.y0);
    ctx.lineTo(0, rect.y1);
    ctx.moveTo(rect.x0, 0);
    ctx.lineTo(rect.x1, 0);
    ctx.stroke();
  }
  ctx.restore();
}

export function strokeOutlinePath(el: StrokeElement): Path2D {
  const path = new Path2D();
  const pts: number[][] = el.points.map((p) =>
    el.realPressure && el.mode === "pen" ? [p.x, p.y, p.pressure] : [p.x, p.y]
  );
  const outline = getStroke(pts, {
    size: el.size,
    thinning: el.mode === "highlighter" ? 0 : el.realPressure ? 0.55 : 0.5,
    smoothing: el.mode === "highlighter" ? 0.4 : 0.5,
    streamline: el.mode === "highlighter" ? 0.4 : 0.5,
    easing: (t) => t,
    simulatePressure: el.mode === "pen" && !el.realPressure,
    last: true,
  });
  if (!outline.length) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  path.closePath();
  return path;
}

export function drawStrokeElement(ctx: CanvasRenderingContext2D, el: StrokeElement) {
  if (!el.points.length) return;
  ctx.save();
  if (el.mode === "highlighter") ctx.globalAlpha = HIGHLIGHTER_ALPHA;
  ctx.fillStyle = el.color;
  if (el.points.length === 1) {
    const p = el.points[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, el.size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fill(strokeOutlinePath(el));
  }
  ctx.restore();
}

function pathRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawShapeElement(ctx: CanvasRenderingContext2D, el: ShapeElement) {
  const b = shapeBounds(el.start, el.end);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  ctx.save();
  ctx.strokeStyle = el.color;
  ctx.lineWidth = el.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (el.type === "line") {
    ctx.beginPath();
    ctx.moveTo(el.start.x, el.start.y);
    ctx.lineTo(el.end.x, el.end.y);
    ctx.stroke();
  } else if (el.type === "arrow") {
    const dx = el.end.x - el.start.x;
    const dy = el.end.y - el.start.y;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const headLen = Math.min(Math.max(10, el.size * 3.6), Math.max(len * 0.45, 1));
    ctx.beginPath();
    ctx.moveTo(el.start.x, el.start.y);
    ctx.lineTo(el.end.x, el.end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(
      el.end.x + Math.cos(angle + Math.PI * 0.82) * headLen,
      el.end.y + Math.sin(angle + Math.PI * 0.82) * headLen
    );
    ctx.lineTo(el.end.x, el.end.y);
    ctx.lineTo(
      el.end.x + Math.cos(angle - Math.PI * 0.82) * headLen,
      el.end.y + Math.sin(angle - Math.PI * 0.82) * headLen
    );
    ctx.stroke();
  } else if (el.type === "rect") {
    pathRoundRect(ctx, b.minX, b.minY, Math.max(w, 0.01), Math.max(h, 0.01), 0);
    ctx.stroke();
  } else if (el.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(b.minX + w / 2, b.minY + h / 2, Math.max(w / 2, 0.01), Math.max(h / 2, 0.01), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (el.type === "triangle") {
    ctx.beginPath();
    ctx.moveTo(b.minX + w / 2, b.minY);
    ctx.lineTo(b.maxX, b.maxY);
    ctx.lineTo(b.minX, b.maxY);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTextElement(ctx: CanvasRenderingContext2D, el: TextElement) {
  if (!el.text) return;
  const { lines } = textSize(el.text, el.fontSize);
  const lineHeight = el.fontSize * 1.25;
  ctx.save();
  ctx.fillStyle = el.color;
  ctx.font = `${el.fontSize}px ${getHandFontFamily()}`;
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillText(line, el.x, el.y + i * lineHeight);
  });
  ctx.restore();
}

export function drawElement(
  ctx: CanvasRenderingContext2D,
  el: StrokeElement | ShapeElement | TextElement
) {
  if (el.type === "stroke") drawStrokeElement(ctx, el);
  else if (el.type === "text") drawTextElement(ctx, el);
  else drawShapeElement(ctx, el);
}

export function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  el: StrokeElement | ShapeElement | TextElement,
  zoom: number
) {
  const b = elementBounds(el);
  const pad = 7 / zoom;
  ctx.save();
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([5 / zoom, 4 / zoom]);
  pathRoundRect(
    ctx,
    b.minX - pad,
    b.minY - pad,
    b.maxX - b.minX + pad * 2,
    b.maxY - b.minY + pad * 2,
    5 / zoom
  );
  ctx.stroke();
  ctx.restore();
}

export function drawLaser(
  ctx: CanvasRenderingContext2D,
  pts: LaserPoint[],
  zoom: number,
  now: number
) {
  if (!pts.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const lw = Math.max(2, 5 / zoom);
  for (let i = 1; i < pts.length; i++) {
    const age = (now - pts[i].t) / LASER_LIFE;
    const alpha = Math.max(0, 1 - age);
    if (alpha <= 0) continue;
    ctx.strokeStyle = `rgba(239,68,68,${(alpha * 0.75).toFixed(3)})`;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  const head = pts[pts.length - 1];
  const r = Math.max(3.5, 7 / zoom);
  const grad = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, r * 2.4);
  grad.addColorStop(0, "rgba(239,68,68,0.95)");
  grad.addColorStop(0.45, "rgba(239,68,68,0.4)");
  grad.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(head.x, head.y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
