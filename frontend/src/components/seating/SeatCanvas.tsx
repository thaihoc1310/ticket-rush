import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Layer, Rect, Stage, Text } from "react-konva";

import type { SeatWithZone } from "@/types/booking";

const SEAT_SIZE = 22;
const SEAT_GAP = 4;
const ROW_LABEL_WIDTH = 28;
const ROW_LABEL_GAP = 12;
const STAGE_HEIGHT = 60;
const STAGE_MARGIN_BOTTOM = 36;
const CANVAS_PADDING = 24;

const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const ZOOM_STEP = 1.15;

export const SEAT_COLORS = {
  unassigned: "#e2e8f0",
  available: "#22c55e",
  locked: "#94a3b8",
  mine: "#f59e0b",
  sold: "#ef4444",
  selected: "#6366f1",
} as const;

export type SeatVisual =
  | "unassigned"
  | "available"
  | "locked"
  | "mine"
  | "sold"
  | "selected";

function rowLabel(idx: number): string {
  // 1 → A, 27 → AA, etc.
  let n = idx;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || "A";
}

function boxesIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export interface SeatCanvasProps {
  seats: SeatWithZone[];
  rows: number;
  cols: number;
  /** Return a color override (e.g. for selected seats, or for zone preview). */
  visualFor: (seat: SeatWithZone) => SeatVisual;
  /** Return hex color used when visual is "available" (i.e. the seat's own color). */
  colorFor?: (seat: SeatWithZone) => string | null;
  onSeatClick?: (seat: SeatWithZone) => void;
  /** If provided, enables marquee (drag-to-select). Called with ids in the box. */
  onMarqueeSelect?: (seatIds: string[], mode: "replace" | "add") => void;
  width?: number;
  height?: number;
}

export function SeatCanvas({
  seats,
  rows,
  cols,
  visualFor,
  colorFor,
  onSeatClick,
  onMarqueeSelect,
  width = 900,
  height = 560,
}: SeatCanvasProps) {
  const stageRef = useRef<{
    getPointerPosition: () => { x: number; y: number } | null;
  } | null>(null);

  // Stage transform state
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Marquee drag state (coordinates in world space)
  const [marquee, setMarquee] = useState<
    | { x0: number; y0: number; x1: number; y1: number; additive: boolean }
    | null
  >(null);

  // Index seats by position for O(1) lookup
  const grid = useMemo(() => {
    const m = new Map<string, SeatWithZone>();
    for (const s of seats) m.set(`${s.row_number}:${s.seat_number}`, s);
    return m;
  }, [seats]);

  const boardWidth =
    ROW_LABEL_WIDTH +
    ROW_LABEL_GAP +
    cols * SEAT_SIZE +
    (cols - 1) * SEAT_GAP +
    CANVAS_PADDING * 2;
  const boardHeight =
    STAGE_HEIGHT +
    STAGE_MARGIN_BOTTOM +
    rows * SEAT_SIZE +
    (rows - 1) * SEAT_GAP +
    CANVAS_PADDING * 2;

  // Auto-fit on first render and whenever grid dims change
  useEffect(() => {
    const fitScale = Math.min(
      (width - 40) / boardWidth,
      (height - 40) / boardHeight,
      1,
    );
    setScale(Math.max(fitScale, MIN_SCALE));
    setPos({
      x: (width - boardWidth * fitScale) / 2,
      y: (height - boardHeight * fitScale) / 2,
    });
  }, [boardWidth, boardHeight, width, height]);

  const zoomAt = useCallback(
    (factor: number, point?: { x: number; y: number }) => {
      setScale((prev) => {
        const next = Math.min(
          Math.max(prev * factor, MIN_SCALE),
          MAX_SCALE,
        );
        if (point) {
          const world = {
            x: (point.x - pos.x) / prev,
            y: (point.y - pos.y) / prev,
          };
          setPos({
            x: point.x - world.x * next,
            y: point.y - world.y * next,
          });
        }
        return next;
      });
    },
    [pos.x, pos.y],
  );

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    zoomAt(e.evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, pointer);
  };

  // Marquee helpers — operate in world coords
  const screenToWorld = useCallback(
    (p: { x: number; y: number }) => ({
      x: (p.x - pos.x) / scale,
      y: (p.y - pos.y) / scale,
    }),
    [pos.x, pos.y, scale],
  );

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (!onMarqueeSelect) return;
    // Only start marquee when clicking on empty canvas (stage or background rect)
    const target = e.target;
    const isBackground =
      target === target.getStage() ||
      (target.name && target.name() === "canvas-bg");
    if (!isBackground) return;
    const pointer = target.getStage()?.getPointerPosition();
    if (!pointer) return;
    const world = screenToWorld(pointer);
    const additive = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
    setMarquee({ x0: world.x, y0: world.y, x1: world.x, y1: world.y, additive });
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!marquee) return;
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    const world = screenToWorld(pointer);
    setMarquee({ ...marquee, x1: world.x, y1: world.y });
  };

  const handleMouseUp = () => {
    if (!marquee || !onMarqueeSelect) {
      setMarquee(null);
      return;
    }
    const box = {
      x: Math.min(marquee.x0, marquee.x1),
      y: Math.min(marquee.y0, marquee.y1),
      w: Math.abs(marquee.x1 - marquee.x0),
      h: Math.abs(marquee.y1 - marquee.y0),
    };
    // Ignore tiny drags (treat as a simple click-on-empty)
    if (box.w < 4 && box.h < 4) {
      setMarquee(null);
      return;
    }
    const hits: string[] = [];
    for (const seat of seats) {
      const { x, y } = seatWorldPos(seat);
      if (
        boxesIntersect(box, {
          x,
          y,
          w: SEAT_SIZE,
          h: SEAT_SIZE,
        })
      ) {
        hits.push(seat.id);
      }
    }
    onMarqueeSelect(hits, marquee.additive ? "add" : "replace");
    setMarquee(null);
  };

  const handleStageDragEnd = (e: KonvaEventObject<DragEvent>) => {
    setPos({ x: e.target.x(), y: e.target.y() });
  };

  // Controls
  const resetView = () => {
    const fitScale = Math.min(
      (width - 40) / boardWidth,
      (height - 40) / boardHeight,
      1,
    );
    setScale(Math.max(fitScale, MIN_SCALE));
    setPos({
      x: (width - boardWidth * fitScale) / 2,
      y: (height - boardHeight * fitScale) / 2,
    });
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <Stage
        width={width}
        height={height}
        ref={stageRef as never}
        x={pos.x}
        y={pos.y}
        scaleX={scale}
        scaleY={scale}
        draggable={!marquee}
        onWheel={handleWheel}
        onDragEnd={handleStageDragEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Layer>
          {/* Background so marquee can fire on empty areas */}
          <Rect
            name="canvas-bg"
            x={0}
            y={0}
            width={boardWidth}
            height={boardHeight}
            fill="#ffffff"
          />
          <StageElement width={boardWidth} />
          <RowLabels rows={rows} />
          {seats.map((seat) => (
            <SeatNode
              key={seat.id}
              seat={seat}
              visual={visualFor(seat)}
              color={colorFor?.(seat) ?? undefined}
              onClick={onSeatClick}
            />
          ))}
          {grid.size === 0 && (
            <Text
              x={CANVAS_PADDING}
              y={STAGE_HEIGHT + STAGE_MARGIN_BOTTOM + 12}
              text="No seats yet."
              fontSize={14}
              fill="#94a3b8"
            />
          )}
          {marquee && (
            <Rect
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.y1 - marquee.y0)}
              fill="rgba(99,102,241,0.15)"
              stroke="#6366f1"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {/* Floating controls */}
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-2">
        <div className="pointer-events-auto flex overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => zoomAt(ZOOM_STEP)}
            className="px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomAt(1 / ZOOM_STEP)}
            className="border-l border-slate-200 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetView}
            className="border-l border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            Fit
          </button>
        </div>
        <div className="pointer-events-auto rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-[10px] uppercase tracking-wider text-slate-500 shadow-sm">
          {Math.round(scale * 100)}%
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white">
        Drag to pan · Scroll to zoom{onMarqueeSelect ? " · Drag empty area to box-select" : ""}
      </div>
    </div>
  );
}

function seatWorldPos(seat: SeatWithZone): { x: number; y: number } {
  return {
    x:
      CANVAS_PADDING +
      ROW_LABEL_WIDTH +
      ROW_LABEL_GAP +
      (seat.seat_number - 1) * (SEAT_SIZE + SEAT_GAP),
    y:
      CANVAS_PADDING +
      STAGE_HEIGHT +
      STAGE_MARGIN_BOTTOM +
      (seat.row_number - 1) * (SEAT_SIZE + SEAT_GAP),
  };
}

function StageElement({ width }: { width: number }) {
  const stageWidth = width - CANVAS_PADDING * 2;
  return (
    <Group x={CANVAS_PADDING} y={CANVAS_PADDING}>
      <Rect
        width={stageWidth}
        height={STAGE_HEIGHT}
        fill="#0f172a"
        cornerRadius={[12, 12, 40, 40]}
      />
      <Text
        x={0}
        y={0}
        width={stageWidth}
        height={STAGE_HEIGHT}
        align="center"
        verticalAlign="middle"
        text="SCREEN / STAGE"
        fontSize={16}
        fontStyle="bold"
        letterSpacing={4}
        fill="#f8fafc"
      />
    </Group>
  );
}

function RowLabels({ rows }: { rows: number }) {
  const labels: Array<{ text: string; y: number }> = [];
  for (let r = 1; r <= rows; r++) {
    labels.push({
      text: rowLabel(r),
      y:
        CANVAS_PADDING +
        STAGE_HEIGHT +
        STAGE_MARGIN_BOTTOM +
        (r - 1) * (SEAT_SIZE + SEAT_GAP),
    });
  }
  return (
    <>
      {labels.map((l) => (
        <Text
          key={l.text}
          x={CANVAS_PADDING}
          y={l.y + 3}
          width={ROW_LABEL_WIDTH}
          align="right"
          text={l.text}
          fontSize={12}
          fontStyle="bold"
          fill="#475569"
        />
      ))}
    </>
  );
}

interface SeatNodeProps {
  seat: SeatWithZone;
  visual: SeatVisual;
  color?: string;
  onClick?: (seat: SeatWithZone) => void;
}

function SeatNode({ seat, visual, color, onClick }: SeatNodeProps) {
  const { x, y } = seatWorldPos(seat);
  const fill =
    visual === "available" && color ? color : SEAT_COLORS[visual];
  const opacity = visual === "unassigned" ? 0.7 : 1;
  const stroke =
    visual === "mine" || visual === "selected" ? "#0f172a" : "transparent";
  return (
    <Rect
      x={x}
      y={y}
      width={SEAT_SIZE}
      height={SEAT_SIZE}
      cornerRadius={5}
      fill={fill}
      opacity={opacity}
      stroke={stroke}
      strokeWidth={stroke === "transparent" ? 0 : 2}
      onClick={() => onClick?.(seat)}
      onTap={() => onClick?.(seat)}
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage && onClick) stage.container().style.cursor = "pointer";
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "default";
      }}
    />
  );
}
