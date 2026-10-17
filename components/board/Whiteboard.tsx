"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minimize2 } from "lucide-react";
import {
  clamp,
  constrainShape,
  elementHitTest,
  sceneBounds,
  screenToWorld,
  setHandFontFamily,
  translateElement,
  uid,
  worldToScreen,
} from "@/lib/geometry";
import {
  drawBackground,
  drawElement,
  drawLaser,
  drawSelectionOutline,
  drawStrokeElement,
  HAND_FONT_FALLBACK,
} from "@/lib/drawing";
import { LASER_LIFE, MAX_ZOOM, MIN_ZOOM } from "@/lib/theme";
import type {
  BackgroundStyle,
  Element,
  LaserPoint,
  Point,
  PersistedBoard,
  ShapeElement,
  StrokeElement,
  TextElement,
  Tool,
  Viewport,
} from "@/lib/types";
import Toolbar from "./Toolbar";
import TopBar from "./TopBar";
import ZoomBar from "./ZoomBar";
import HelpDialog from "./HelpDialog";
import RecorderPill from "./RecorderPill";
import useScreenRecorder from "./useScreenRecorder";

const STORAGE_KEY = "graphics-board:v1";
// Boards made before the Graphics Board rename lived under this key.
const LEGACY_STORAGE_KEY = "mathboard:v1";

type Interaction =
  | { kind: "idle" }
  | { kind: "pan"; lastX: number; lastY: number }
  | { kind: "draw"; stroke: StrokeElement }
  | { kind: "shape"; shape: ShapeElement }
  | { kind: "erase" }
  | { kind: "move"; id: string; orig: Element; startWorld: Point; moved: boolean }
  | { kind: "laser" };

interface EditingState {
  session: number;
  id: string | null;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

interface GestureState {
  ids: [number, number];
  dist: number;
  mid: { x: number; y: number };
  vp: Viewport;
}

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

export default function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#141414");
  const [size, setSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(24);
  const [fontSize, setFontSize] = useState(36);
  const [background, setBackground] = useState<BackgroundStyle>("grid");
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [zen, setZen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [toast, setToast] = useState<string | null>(null);
  const [, forceHist] = useState(0);

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  const eraserSizeRef = useRef(eraserSize);
  const fontSizeRef = useRef(fontSize);
  const bgRef = useRef(background);
  const elementsRef = useRef(elements);
  const selectedRef = useRef(selectedId);
  const editingRef = useRef<EditingState | null>(null);
  const editingIdRef = useRef<string | null>(null);
  const helpOpenRef = useRef(helpOpen);
  const vpRef = useRef<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const zoomPctRef = useRef(100);
  const dprRef = useRef(1);
  const sizeRefCanvas = useRef({ w: 0, h: 0 });
  const rectRef = useRef({ left: 0, top: 0 });
  const viewportInit = useRef(false);
  const loadedRef = useRef(false);
  const didMountSave = useRef(false);

  const interactionRef = useRef<Interaction>({ kind: "idle" });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<GestureState | null>(null);
  const suppressUntilUpRef = useRef(false);
  const penDownRef = useRef(false);
  const spaceRef = useRef(false);
  const laserRef = useRef<LaserPoint[]>([]);
  const eraseBeforeRef = useRef<Element[]>([]);
  const eraseLastRef = useRef<Point>({ x: 0, y: 0, pressure: 0.5 });
  const historyRef = useRef<{ stack: Element[][]; index: number }>({
    stack: [[]],
    index: 0,
  });
  const editSessionRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rafRef = useRef(0);
  const dirtyBase = useRef(false);
  const dirtyOverlay = useRef(false);

  toolRef.current = tool;
  colorRef.current = color;
  sizeRef.current = size;
  eraserSizeRef.current = eraserSize;
  fontSizeRef.current = fontSize;
  bgRef.current = background;
  elementsRef.current = elements;
  selectedRef.current = selectedId;
  helpOpenRef.current = helpOpen;
  if (editing) editingRef.current = editing;

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const recorder = useScreenRecorder({
    onError: notify,
    onSaved: notify,
  });

  const renderBase = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = dprRef.current;
    const { w, h } = sizeRefCanvas.current;
    const vp = vpRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      dpr * vp.zoom,
      0,
      0,
      dpr * vp.zoom,
      dpr * vp.panX,
      dpr * vp.panY
    );
    const rect = {
      x0: -vp.panX / vp.zoom,
      y0: -vp.panY / vp.zoom,
      x1: (w - vp.panX) / vp.zoom,
      y1: (h - vp.panY) / vp.zoom,
    };
    drawBackground(ctx, bgRef.current, rect, vp.zoom);
    const els = elementsRef.current;
    for (const el of els) {
      if (el.id === editingIdRef.current) continue;
      drawElement(ctx, el);
    }
    const sel = selectedRef.current;
    if (sel) {
      const el = els.find((x) => x.id === sel);
      if (el) drawSelectionOutline(ctx, el, vp.zoom);
    }
  }, []);

  const renderOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = dprRef.current;
    const vp = vpRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      dpr * vp.zoom,
      0,
      0,
      dpr * vp.zoom,
      dpr * vp.panX,
      dpr * vp.panY
    );
    const it = interactionRef.current;
    if (it.kind === "draw") drawStrokeElement(ctx, it.stroke);
    else if (it.kind === "shape") drawElement(ctx, it.shape);
    const pts = laserRef.current;
    if (pts.length) {
      const now = performance.now();
      laserRef.current = pts.filter((p) => now - p.t < LASER_LIFE);
      drawLaser(ctx, laserRef.current, vp.zoom, now);
    }
  }, []);

  const tick = useCallback(
    function tickFn() {
      rafRef.current = 0;
      if (dirtyBase.current) {
        dirtyBase.current = false;
        renderBase();
      }
      const it = interactionRef.current;
      if (
        dirtyOverlay.current ||
        it.kind !== "idle" ||
        laserRef.current.length > 0
      ) {
        dirtyOverlay.current = false;
        renderOverlay();
      }
      if (
        dirtyBase.current ||
        dirtyOverlay.current ||
        interactionRef.current.kind !== "idle" ||
        laserRef.current.length > 0
      ) {
        rafRef.current = requestAnimationFrame(tickFn);
      }
    },
    [renderBase, renderOverlay]
  );

  const kick = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const invalidateBase = useCallback(() => {
    dirtyBase.current = true;
    kick();
  }, [kick]);

  const invalidateOverlay = useCallback(() => {
    dirtyOverlay.current = true;
    kick();
  }, [kick]);

  const setViewport = useCallback(
    (vp: Viewport) => {
      vpRef.current = vp;
      const pct = Math.round(vp.zoom * 100);
      if (pct !== zoomPctRef.current) {
        zoomPctRef.current = pct;
        setZoomPct(pct);
      }
      invalidateBase();
    },
    [invalidateBase]
  );

  const record = useCallback((next: Element[]) => {
    const h = historyRef.current;
    const stack = h.stack.slice(0, h.index + 1);
    stack.push(next);
    if (stack.length > 120) stack.splice(0, stack.length - 120);
    historyRef.current = { stack, index: stack.length - 1 };
  }, []);

  const commitElements = useCallback(
    (next: Element[]) => {
      record(next);
      elementsRef.current = next;
      setElements(next);
      forceHist((t) => t + 1);
      invalidateBase();
    },
    [record, invalidateBase]
  );

  const setSelected = useCallback(
    (id: string | null) => {
      selectedRef.current = id;
      setSelectedId(id);
      invalidateBase();
    },
    [invalidateBase]
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    const els = h.stack[h.index];
    elementsRef.current = els;
    setElements(els);
    selectedRef.current = null;
    setSelectedId(null);
    forceHist((t) => t + 1);
    invalidateBase();
  }, [invalidateBase]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    const els = h.stack[h.index];
    elementsRef.current = els;
    setElements(els);
    selectedRef.current = null;
    setSelectedId(null);
    forceHist((t) => t + 1);
    invalidateBase();
  }, [invalidateBase]);

  const startEditing = useCallback(
    (el: TextElement | null, world?: Point) => {
      const session = ++editSessionRef.current;
      const next: EditingState = el
        ? {
            session,
            id: el.id,
            x: el.x,
            y: el.y,
            text: el.text,
            color: el.color,
            fontSize: el.fontSize,
          }
        : {
            session,
            id: null,
            x: world?.x ?? 0,
            y: world?.y ?? 0,
            text: "",
            color: colorRef.current,
            fontSize: fontSizeRef.current,
          };
      editingRef.current = next;
      editingIdRef.current = el ? el.id : null;
      setEditing(next);
      invalidateBase();
    },
    [invalidateBase]
  );

  const commitEditing = useCallback(() => {
    const ed = editingRef.current;
    if (!ed) return;
    editingRef.current = null;
    editingIdRef.current = null;
    setEditing(null);
    const text = ed.text.replace(/\s+$/, "");
    const els = elementsRef.current;
    let next: Element[] | null = null;
    if (ed.id) {
      const target = els.find((el) => el.id === ed.id);
      if (target && target.type === "text") {
        if (!text) next = els.filter((el) => el.id !== ed.id);
        else if (text !== target.text)
          next = els.map((el) =>
            el.id === ed.id ? { ...target, text } : el
          );
      }
    } else if (text) {
      next = [
        ...els,
        {
          id: uid(),
          type: "text",
          x: ed.x,
          y: ed.y,
          text,
          color: ed.color,
          fontSize: ed.fontSize,
        },
      ];
    }
    if (next) commitElements(next);
    else invalidateBase();
  }, [commitElements, invalidateBase]);

  const changeTool = useCallback(
    (t: Tool) => {
      if (editingRef.current) commitEditing();
      setTool(t);
      if (t !== "select") setSelected(null);
    },
    [commitEditing, setSelected]
  );

  const deleteSelected = useCallback(() => {
    const id = selectedRef.current;
    if (!id) return;
    const next = elementsRef.current.filter((el) => el.id !== id);
    setSelected(null);
    commitElements(next);
  }, [commitElements, setSelected]);

  const clearBoard = useCallback(() => {
    setSelected(null);
    commitElements([]);
    notify("Board cleared");
  }, [commitElements, notify, setSelected]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      notify("Fullscreen is not available");
    }
  }, [notify]);

  const eraseAtPoint = useCallback(
    (world: Point) => {
      const els = elementsRef.current;
      const r = eraserSizeRef.current / 2;
      const next = els.filter((el) => !elementHitTest(el, world, r));
      if (next.length !== els.length) {
        elementsRef.current = next;
        setElements(next);
        invalidateBase();
      }
    },
    [invalidateBase]
  );

  const eraseSegment = useCallback(
    (from: Point, to: Point) => {
      const r = Math.max(eraserSizeRef.current / 2, 2);
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.ceil(dist / (r * 0.5)));
      for (let i = 1; i <= steps; i++) {
        eraseAtPoint({
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
          pressure: 0.5,
        });
      }
    },
    [eraseAtPoint]
  );

  const topmostHit = useCallback((world: Point, tol: number): Element | null => {
    const els = elementsRef.current;
    for (let i = els.length - 1; i >= 0; i--) {
      if (elementHitTest(els[i], world, tol)) return els[i];
    }
    return null;
  }, []);

  const zoomAt = useCallback(
    (sx: number, sy: number, factor: number) => {
      const vp = vpRef.current;
      const zoom = clamp(vp.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const scale = zoom / vp.zoom;
      setViewport({
        zoom,
        panX: sx - (sx - vp.panX) * scale,
        panY: sy - (sy - vp.panY) * scale,
      });
    },
    [setViewport]
  );

  const zoomStep = useCallback(
    (dir: 1 | -1) => {
      const { w, h } = sizeRefCanvas.current;
      zoomAt(w / 2, h / 2, dir > 0 ? 1.25 : 0.8);
    },
    [zoomAt]
  );

  const resetView = useCallback(() => {
    const { w, h } = sizeRefCanvas.current;
    setViewport({ zoom: 1, panX: w / 2, panY: h / 2 });
  }, [setViewport]);

  const renderExportCanvas = useCallback((): HTMLCanvasElement | null => {
    const els = elementsRef.current;
    if (!els.length) return null;
    const b = sceneBounds(els);
    if (!b) return null;
    const pad = 48;
    const scale = 2;
    const w = Math.min(b.maxX - b.minX + pad * 2, 6000);
    const h = Math.min(b.maxY - b.minY + pad * 2, 6000);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.translate(pad - b.minX, pad - b.minY);
    drawBackground(
      ctx,
      bgRef.current,
      {
        x0: b.minX - pad,
        y0: b.minY - pad,
        x1: b.maxX + pad,
        y1: b.maxY + pad,
      },
      1
    );
    for (const el of els) drawElement(ctx, el);
    return canvas;
  }, []);

  const exportPNG = useCallback(() => {
    const canvas = renderExportCanvas();
    if (!canvas) {
      notify("Nothing to export yet");
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `graphics-board-${timestamp()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      notify("PNG exported");
    }, "image/png");
  }, [notify, renderExportCanvas]);

  const copyPNG = useCallback(async () => {
    const canvas = renderExportCanvas();
    if (!canvas) {
      notify("Nothing to copy yet");
      return;
    }
    try {
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("no blob");
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      notify("Copied to clipboard");
    } catch {
      notify("Copy failed — try Download instead");
    }
  }, [notify, renderExportCanvas]);

  const eventWorld = (clientX: number, clientY: number): Point => {
    const rect = rectRef.current;
    return screenToWorld(
      { x: clientX - rect.left, y: clientY - rect.top },
      vpRef.current
    );
  };

  const appendStrokePoint = (
    stroke: StrokeElement,
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const rect = rectRef.current;
    const native = e.nativeEvent;
    const events =
      typeof native.getCoalescedEvents === "function"
        ? native.getCoalescedEvents()
        : [];
    const list = events.length ? events : [native];
    for (const ev of list) {
      if (stroke.points.length >= 6000) break;
      stroke.points.push({
        x: (ev.clientX - rect.left - vpRef.current.panX) / vpRef.current.zoom,
        y: (ev.clientY - rect.top - vpRef.current.panY) / vpRef.current.zoom,
        pressure: ev.pressure > 0 ? ev.pressure : 0.5,
      });
    }
  };

  const updateCursorDot = (
    sx: number,
    sy: number,
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const dot = cursorRef.current;
    if (!dot) return;
    const t = toolRef.current;
    const show =
      (t === "pen" || t === "highlighter" || t === "eraser") &&
      e.pointerType !== "touch" &&
      interactionRef.current.kind === "idle" &&
      !gestureRef.current &&
      !spaceRef.current;
    if (!show) {
      dot.style.display = "none";
      return;
    }
    const z = vpRef.current.zoom;
    const d =
      t === "eraser" ? eraserSizeRef.current * z : Math.max(sizeRef.current * z, 5);
    dot.style.display = "block";
    dot.style.width = `${d}px`;
    dot.style.height = `${d}px`;
    dot.style.transform = `translate(${sx - d / 2}px, ${sy - d / 2}px)`;
    if (t === "eraser") {
      dot.style.background = "rgba(255,255,255,0.85)";
      dot.style.border = "1.5px solid rgba(24,24,27,0.4)";
    } else {
      dot.style.background = `${colorRef.current}1f`;
      dot.style.border = `1.5px solid ${colorRef.current}`;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return;
    if (e.pointerType === "touch" && penDownRef.current) return;
    if (editingRef.current) commitEditing();

    const rect = rectRef.current;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    pointersRef.current.set(e.pointerId, { x: sx, y: sy });
    if (e.pointerType === "pen") penDownRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    if (pointersRef.current.size === 2 && !gestureRef.current) {
      const entries = [...pointersRef.current.entries()];
      const a = entries[0][1];
      const b = entries[1][1];
      gestureRef.current = {
        ids: [entries[0][0], entries[1][0]],
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        vp: { ...vpRef.current },
      };
      interactionRef.current = { kind: "idle" };
      invalidateOverlay();
      return;
    }
    if (
      pointersRef.current.size > 2 ||
      gestureRef.current ||
      suppressUntilUpRef.current
    ) {
      return;
    }

    const world = eventWorld(e.clientX, e.clientY);
    const t: Tool =
      e.button === 1 ? "pan" : e.button === 5 ? "eraser" : toolRef.current;

    if (t === "pan") {
      interactionRef.current = { kind: "pan", lastX: sx, lastY: sy };
      return;
    }
    if (t === "pen" || t === "highlighter") {
      const stroke: StrokeElement = {
        id: uid(),
        type: "stroke",
        mode: t,
        points: [
          { ...world, pressure: e.pressure > 0 ? e.pressure : 0.5 },
        ],
        color: colorRef.current,
        size: sizeRef.current,
        realPressure: e.pointerType === "pen",
      };
      interactionRef.current = { kind: "draw", stroke };
      invalidateOverlay();
      return;
    }
    if (t === "eraser") {
      eraseBeforeRef.current = elementsRef.current;
      eraseLastRef.current = world;
      interactionRef.current = { kind: "erase" };
      eraseAtPoint(world);
      return;
    }
    if (
      t === "line" ||
      t === "arrow" ||
      t === "rect" ||
      t === "ellipse" ||
      t === "triangle"
    ) {
      interactionRef.current = {
        kind: "shape",
        shape: {
          id: uid(),
          type: t,
          start: world,
          end: world,
          color: colorRef.current,
          size: sizeRef.current,
        },
      };
      invalidateOverlay();
      return;
    }
    if (t === "text") {
      const hit = topmostHit(world, 8 / vpRef.current.zoom);
      if (hit && hit.type === "text") startEditing(hit);
      else startEditing(null, world);
      return;
    }
    if (t === "laser") {
      laserRef.current = [{ x: world.x, y: world.y, t: performance.now() }];
      interactionRef.current = { kind: "laser" };
      invalidateOverlay();
      return;
    }

    const hit = topmostHit(world, 8 / vpRef.current.zoom);
    if (hit) {
      setSelected(hit.id);
      interactionRef.current = {
        kind: "move",
        id: hit.id,
        orig: hit,
        startWorld: world,
        moved: false,
      };
    } else {
      setSelected(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = rectRef.current;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    updateCursorDot(sx, sy, e);
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: sx, y: sy });
    }

    const g = gestureRef.current;
    if (g) {
      const a = pointersRef.current.get(g.ids[0]);
      const b = pointersRef.current.get(g.ids[1]);
      if (a && b) {
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const zoom = clamp(g.vp.zoom * (dist / g.dist), MIN_ZOOM, MAX_ZOOM);
        const worldMid = screenToWorld(g.mid, g.vp);
        setViewport({
          zoom,
          panX: mid.x - worldMid.x * zoom,
          panY: mid.y - worldMid.y * zoom,
        });
      }
      return;
    }

    const it = interactionRef.current;
    if (it.kind === "pan") {
      const dx = sx - it.lastX;
      const dy = sy - it.lastY;
      it.lastX = sx;
      it.lastY = sy;
      const vp = vpRef.current;
      setViewport({ ...vp, panX: vp.panX + dx, panY: vp.panY + dy });
      return;
    }
    if (it.kind === "draw") {
      appendStrokePoint(it.stroke, e);
      invalidateOverlay();
      return;
    }
    if (it.kind === "shape") {
      const world = eventWorld(e.clientX, e.clientY);
      it.shape.end = constrainShape(
        it.shape.start,
        world,
        e.shiftKey,
        it.shape.type
      );
      invalidateOverlay();
      return;
    }
    if (it.kind === "erase") {
      const world = eventWorld(e.clientX, e.clientY);
      eraseSegment(eraseLastRef.current, world);
      eraseLastRef.current = world;
      return;
    }
    if (it.kind === "move") {
      const world = eventWorld(e.clientX, e.clientY);
      const dx = world.x - it.startWorld.x;
      const dy = world.y - it.startWorld.y;
      if (dx !== 0 || dy !== 0) it.moved = true;
      const next = elementsRef.current.map((el) =>
        el.id === it.id ? translateElement(it.orig, dx, dy) : el
      );
      elementsRef.current = next;
      setElements(next);
      invalidateBase();
      return;
    }
    if (it.kind === "laser") {
      const world = eventWorld(e.clientX, e.clientY);
      const pts = laserRef.current;
      const last = pts[pts.length - 1];
      if (
        !last ||
        Math.hypot(world.x - last.x, world.y - last.y) >
          1.5 / vpRef.current.zoom
      ) {
        pts.push({ x: world.x, y: world.y, t: performance.now() });
        if (pts.length > 400) pts.shift();
      }
      invalidateOverlay();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (e.pointerType === "pen") penDownRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const g = gestureRef.current;
    if (g) {
      if (
        !pointersRef.current.has(g.ids[0]) ||
        !pointersRef.current.has(g.ids[1])
      ) {
        gestureRef.current = null;
        suppressUntilUpRef.current = pointersRef.current.size > 0;
      }
      invalidateOverlay();
      return;
    }
    if (suppressUntilUpRef.current) {
      if (pointersRef.current.size === 0) suppressUntilUpRef.current = false;
      return;
    }

    const it = interactionRef.current;
    interactionRef.current = { kind: "idle" };
    if (it.kind === "draw") {
      if (it.stroke.points.length) {
        commitElements([...elementsRef.current, it.stroke]);
      }
    } else if (it.kind === "shape") {
      const d = Math.hypot(
        it.shape.end.x - it.shape.start.x,
        it.shape.end.y - it.shape.start.y
      );
      if (d > 2) commitElements([...elementsRef.current, it.shape]);
    } else if (it.kind === "erase") {
      if (elementsRef.current !== eraseBeforeRef.current) {
        record(elementsRef.current);
        forceHist((t) => t + 1);
      }
    } else if (it.kind === "move") {
      if (it.moved) {
        record(elementsRef.current);
        forceHist((t) => t + 1);
      }
    }
    invalidateOverlay();
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolRef.current !== "select") return;
    const world = eventWorld(e.clientX, e.clientY);
    const hit = topmostHit(world, 8 / vpRef.current.zoom);
    if (hit && hit.type === "text") {
      setSelected(null);
      startEditing(hit);
    }
  };

  const handlePointerLeave = () => {
    const dot = cursorRef.current;
    if (dot) dot.style.display = "none";
  };

  useEffect(() => {
    try {          const raw =
            localStorage.getItem(STORAGE_KEY) ??
            localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as PersistedBoard;
        if (Array.isArray(data.elements) && data.elements.length) {
          elementsRef.current = data.elements;
          setElements(data.elements);
          historyRef.current = { stack: [data.elements], index: 0 };
        }
        if (data.background) setBackground(data.background);
        if (
          data.viewport &&
          typeof data.viewport.zoom === "number" &&
          isFinite(data.viewport.zoom)
        ) {
          vpRef.current = {
            zoom: clamp(data.viewport.zoom, MIN_ZOOM, MAX_ZOOM),
            panX: data.viewport.panX || 0,
            panY: data.viewport.panY || 0,
          };
          viewportInit.current = true;
          zoomPctRef.current = Math.round(vpRef.current.zoom * 100);
          setZoomPct(zoomPctRef.current);
        }
      }
    } catch {}
    loadedRef.current = true;
    invalidateBase();
  }, [invalidateBase]);

  useEffect(() => {
    invalidateBase();
  }, [background, invalidateBase]);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (!didMountSave.current) {
      didMountSave.current = true;
      return;
    }
    const t = setTimeout(() => {
      try {
        const data: PersistedBoard = {
          version: 1,
          elements,
          background,
          viewport: vpRef.current,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [elements, background]);

  useEffect(() => {
    const resolveFont = () => {
      const raw = getComputedStyle(document.body)
        .getPropertyValue("--font-hand")
        .trim();
      setHandFontFamily(raw || HAND_FONT_FALLBACK);
      invalidateBase();
    };
    if (document.fonts?.ready) {
      document.fonts.ready.then(resolveFont).catch(() => {});
    } else {
      resolveFont();
    }
  }, [invalidateBase]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      rectRef.current = { left: rect.left, top: rect.top };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;
      sizeRefCanvas.current = { w: rect.width, h: rect.height };
      for (const c of [baseCanvasRef.current, overlayCanvasRef.current]) {
        if (!c) continue;
        c.width = Math.max(1, Math.round(rect.width * dpr));
        c.height = Math.max(1, Math.round(rect.height * dpr));
      }
      if (!viewportInit.current && rect.width > 0) {
        viewportInit.current = true;
        vpRef.current = {
          zoom: 1,
          panX: rect.width / 2,
          panY: rect.height / 2,
        };
        zoomPctRef.current = 100;
        setZoomPct(100);
      }
      renderBase();
      invalidateOverlay();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [invalidateOverlay, renderBase]);

  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[role='dialog']")) return;
      e.preventDefault();
      if (editingRef.current) commitEditing();
      const rect = rectRef.current;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(
          -e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)
        );
        zoomAt(sx, sy, factor);
      } else {
        const mul = e.deltaMode === 1 ? 16 : 1;
        const vp = vpRef.current;
        setViewport({
          ...vp,
          panX: vp.panX - e.deltaX * mul,
          panY: vp.panY - e.deltaY * mul,
        });
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [commitEditing, setViewport, zoomAt]);

  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable);

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        exportPNG();
        return;
      }
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomStep(1);
        return;
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        zoomStep(-1);
        return;
      }
      if (mod && e.key === "0") {
        e.preventDefault();
        resetView();
        return;
      }
      if (mod) return;

      if (e.key === " ") {
        if (!spaceRef.current) {
          spaceRef.current = true;
          setSpaceHeld(true);
        }
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        if (helpOpenRef.current) {
          setHelpOpen(false);
          return;
        }
        if (editingRef.current) {
          commitEditing();
          return;
        }
        setSelected(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      }

      const toolKeys: Record<string, Tool> = {
        v: "select",
        h: "pan",
        p: "pen",
        m: "highlighter",
        e: "eraser",
        l: "line",
        a: "arrow",
        r: "rect",
        o: "ellipse",
        y: "triangle",
        t: "text",
        x: "laser",
        "1": "line",
        "2": "arrow",
        "3": "rect",
        "4": "ellipse",
        "5": "triangle",
      };
      if (toolKeys[key]) {
        changeTool(toolKeys[key]);
        return;
      }
      if (key === "z") {
        setZen((v) => !v);
        return;
      }
      if (key === "f") {
        toggleFullscreen();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        spaceRef.current = false;
        setSpaceHeld(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    changeTool,
    commitEditing,
    deleteSelected,
    exportPNG,
    redo,
    resetView,
    setSelected,
    toggleFullscreen,
    undo,
    zoomStep,
  ]);

  useEffect(() => {
    const dot = cursorRef.current;
    if (dot) dot.style.display = "none";
  }, [tool]);

  useEffect(() => {
    const onChange = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const editSession = editing?.session ?? 0;
  useEffect(() => {
    if (!editingRef.current) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    const len = ta.value.length;
    ta.setSelectionRange(len, len);
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [editSession]);

  const panMode = spaceHeld || tool === "pan";
  const cursorStyle = panMode
    ? "grab"
    : tool === "select"
      ? "default"
      : tool === "text"
        ? "text"
        : tool === "pen" ||
            tool === "highlighter" ||
            tool === "eraser" ||
            tool === "laser"
          ? "none"
          : "crosshair";

  const hist = historyRef.current;
  const canUndo = hist.index > 0;
  const canRedo = hist.index < hist.stack.length - 1;

  return (
    <div
      ref={containerRef}
      className="relative h-dvh w-full touch-none select-none overflow-hidden bg-white"
      style={{ cursor: cursorStyle }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerLeave={handlePointerLeave}
    >
      <canvas ref={baseCanvasRef} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onMouseDown={(e) => e.preventDefault()}
      />
      <div
        ref={cursorRef}
        className="pointer-events-none absolute left-0 top-0 z-30 rounded-full"
        style={{ display: "none" }}
      />

      {editing && (
        <textarea
          ref={textareaRef}
          value={editing.text}
          onChange={(e) => {
            const next = { ...editing, text: e.target.value };
            editingRef.current = next;
            setEditing(next);
            const ta = e.currentTarget;
            ta.style.height = "auto";
            ta.style.height = `${ta.scrollHeight}px`;
          }}
          onBlur={commitEditing}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              commitEditing();
            }
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="absolute z-40 cursor-text resize-none select-text overflow-hidden whitespace-pre bg-transparent p-0 outline-none"
          style={{
            left: worldToScreen({ x: editing.x, y: editing.y }, vpRef.current)
              .x,
            top: worldToScreen({ x: editing.x, y: editing.y }, vpRef.current)
              .y,
            color: editing.color,
            caretColor: editing.color,
            fontFamily: "var(--font-hand)",
            fontSize: editing.fontSize * vpRef.current.zoom,
            lineHeight: 1.25,
            minWidth: 24,
            minHeight: editing.fontSize * vpRef.current.zoom * 1.25,
          }}
        />
      )}

      {!zen && (
        <>
          <Toolbar
            tool={tool}
            onTool={changeTool}
            color={color}
            onColor={setColor}
            size={size}
            onSize={setSize}
            eraserSize={eraserSize}
            onEraserSize={setEraserSize}
            fontSize={fontSize}
            onFontSize={setFontSize}
          />
          <TopBar
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onClear={clearBoard}
            background={background}
            onBackground={setBackground}
            onExport={exportPNG}
            onCopy={copyPNG}
            onHelp={() => setHelpOpen(true)}
            onZen={() => setZen(true)}
            fullscreen={fullscreen}
            onFullscreen={toggleFullscreen}
            recording={recorder.status !== "idle"}
            recorderSupported={recorder.supported}
            onRecordStart={(mic) => {
              void recorder.start({ mic });
            }}
            onRecordStop={recorder.stop}
          />
          <ZoomBar
            zoomPct={zoomPct}
            onZoomIn={() => zoomStep(1)}
            onZoomOut={() => zoomStep(-1)}
            onReset={resetView}
          />
        </>
      )}

      {zen && (
        <button
          type="button"
          onClick={() => setZen(false)}
          className="absolute right-4 top-4 z-40 flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 bg-white/80 px-3 py-2 text-xs font-medium text-neutral-500 shadow-lg shadow-neutral-900/5 backdrop-blur transition-colors hover:text-neutral-900"
          aria-label="Exit zen mode"
        >
          <Minimize2 className="size-4" />
          Exit zen
        </button>
      )}

      {recorder.status !== "idle" && (
        <RecorderPill
          status={recorder.status}
          elapsed={recorder.elapsed}
          onPause={recorder.pause}
          onResume={recorder.resume}
          onStop={recorder.stop}
        />
      )}

      {toast && (
        <div className="animate-fade-up pointer-events-none absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
