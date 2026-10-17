export type Tool =
  | "select"
  | "pan"
  | "pen"
  | "highlighter"
  | "eraser"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "triangle"
  | "text"
  | "laser";

export type ShapeType = "line" | "arrow" | "rect" | "ellipse" | "triangle";

export type BackgroundStyle = "plain" | "grid" | "dots" | "ruled" | "axes";

export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export interface StrokeElement {
  id: string;
  type: "stroke";
  mode: "pen" | "highlighter";
  points: Point[];
  color: string;
  size: number;
  realPressure: boolean;
}

export interface ShapeElement {
  id: string;
  type: ShapeType;
  start: Point;
  end: Point;
  color: string;
  size: number;
}

export interface TextElement {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export type Element = StrokeElement | ShapeElement | TextElement;

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface LaserPoint {
  x: number;
  y: number;
  t: number;
}

export interface PersistedBoard {
  version: 1;
  elements: Element[];
  background: BackgroundStyle;
  viewport: Viewport;
}
