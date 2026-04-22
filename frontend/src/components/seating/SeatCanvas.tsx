import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";

import { useTheme } from "@/components/ui/ThemeProvider";
import type { SeatWithZone } from "@/types/booking";

const SEAT_SIZE = 22;
const SEAT_GAP = 4;
const AISLE_EVERY = 8; // extra gap every N columns for aisles
const AISLE_WIDTH = 14;
const ROW_LABEL_WIDTH = 28;
const ROW_LABEL_GAP = 14;
const STAGE_HEIGHT = 64;
const STAGE_MARGIN_BOTTOM = 48;
const CANVAS_PADDING = 28;

const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const ZOOM_STEP = 1.15;

export const SEAT_COLORS = {
  unassigned: "#475569",
  available: "#10b981",
  locked: "#94a3b8",
  mine: "#8b5cf6",
  sold: "#64748b",
  selected: "#f43f5e",
} as const;

const SEAT_STROKE = {
  unassigned: "#64748b",
  available: "#059669",
  locked: "#64748b",
  mine: "#a78bfa",
  sold: "#475569",
  selected: "#fb7185",
} as const;

export type SeatVisual =
  | "unassigned"
  | "available"
  | "locked"
  | "mine"
  | "sold"
  | "selected";

interface ThemeColors {
  bgA: string;
  bgB: string;
  grid: string;
  stageGrad1: string;
  stageGrad2: string;
  stageText: string;
  stageGlow: string;
  rowLabel: string;
  rowLabelBg: string;
  marqueeFill: string;
  marqueeStroke: string;
  hintBg: string;
  hintText: string;
}

function getThemeColors(theme: "dark" | "light"): ThemeColors {
  if (theme === "light") {
    return {
      bgA: "#f8fafc",
      bgB: "#eef2f7",
      grid: "rgba(15, 23, 42, 0.05)",
      stageGrad1: "#1e293b",
      stageGrad2: "#334155",
      stageText: "#e2e8f0",
      stageGlow: "rgba(99, 102, 241, 0.18)",
      rowLabel: "#64748b",
      rowLabelBg: "rgba(15, 23, 42, 0.06)",
      marqueeFill: "rgba(244, 63, 94, 0.12)",
      marqueeStroke: "#f43f5e",
      hintBg: "rgba(15, 23, 42, 0.8)",
      hintText: "#f8fafc",
    };
  }
  return {
    bgA: "#0b0f19",
    bgB: "#141a2b",
    grid: "rgba(148, 163, 184, 0.05)",
    stageGrad1: "#1e293b",
    stageGrad2: "#0f172a",
    stageText: "#cbd5e1",
    stageGlow: "rgba(139, 92, 246, 0.22)",
    rowLabel: "#94a3b8",
    rowLabelBg: "rgba(255, 255, 255, 0.04)",
    marqueeFill: "rgba(244, 63, 94, 0.14)",
    marqueeStroke: "#f43f5e",
    hintBg: "rgba(0, 0, 0, 0.72)",
    hintText: "#f1f5f9",
  };
}

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

/** Extra offset caused by aisles when rendering seat_number. */
function aisleOffset(seatNumber: number, cols: number): number {
  if (cols < 10) return 0;
  // Place an aisle gap after every AISLE_EVERY seats, but not after the last column.
  const aislesBefore = Math.floor((seatNumber - 1) / AISLE_EVERY);
  return aislesBefore * AISLE_WIDTH;
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
  const { theme } = useTheme();
  const colors = useMemo(() => getThemeColors(theme), [theme]);

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

  const totalAisles = cols >= 10 ? Math.floor((cols - 1) / AISLE_EVERY) : 0;
  const boardWidth =
    ROW_LABEL_WIDTH +
    ROW_LABEL_GAP +
    cols * SEAT_SIZE +
    (cols - 1) * SEAT_GAP +
    totalAisles * AISLE_WIDTH +
    ROW_LABEL_WIDTH + // mirror label on the right
    ROW_LABEL_GAP +
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
      const { x, y } = seatWorldPos(seat, cols);
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
    <div
      className="relative overflow-hidden rounded-2xl border shadow-sm"
      style={{
        borderColor: "var(--border-primary)",
        background: `linear-gradient(135deg, ${colors.bgA} 0%, ${colors.bgB} 100%)`,
      }}
    >
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
          {/* Background: gradient fill with subtle grid dots */}
          <Rect
            name="canvas-bg"
            x={0}
            y={0}
            width={boardWidth}
            height={boardHeight}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: boardWidth, y: boardHeight }}
            fillLinearGradientColorStops={[0, colors.bgA, 1, colors.bgB]}
          />
          <BackgroundGrid
            width={boardWidth}
            height={boardHeight}
            color={colors.grid}
          />
          <StageElement width={boardWidth} colors={colors} />
          <RowLabels
            rows={rows}
            cols={cols}
            color={colors.rowLabel}
            bg={colors.rowLabelBg}
          />
          {seats.map((seat) => (
            <SeatNode
              key={seat.id}
              seat={seat}
              cols={cols}
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
              fill={colors.rowLabel}
            />
          )}
          {marquee && (
            <Rect
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.y1 - marquee.y0)}
              fill={colors.marqueeFill}
              stroke={colors.marqueeStroke}
              strokeWidth={1.5}
              dash={[6, 4]}
              cornerRadius={6}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {/* Floating controls */}
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-2">
        <div
          className="pointer-events-auto flex items-center overflow-hidden rounded-full border shadow-md backdrop-blur"
          style={{
            borderColor: "var(--border-primary)",
            background: "color-mix(in srgb, var(--bg-secondary) 85%, transparent)",
          }}
        >
          <ControlButton onClick={() => zoomAt(ZOOM_STEP)} label="Zoom in">
            <PlusIcon />
          </ControlButton>
          <Divider />
          <ControlButton onClick={() => zoomAt(1 / ZOOM_STEP)} label="Zoom out">
            <MinusIcon />
          </ControlButton>
          <Divider />
          <ControlButton onClick={resetView} label="Fit to view">
            <FitIcon />
          </ControlButton>
        </div>
        <div
          className="pointer-events-auto rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm backdrop-blur"
          style={{
            borderColor: "var(--border-primary)",
            background: "color-mix(in srgb, var(--bg-secondary) 85%, transparent)",
            color: "var(--text-muted)",
          }}
        >
          {Math.round(scale * 100)}%
        </div>
      </div>

      <div
        className="pointer-events-none absolute bottom-3 left-3 rounded-full border px-3 py-1 text-[11px] font-medium shadow-sm backdrop-blur"
        style={{
          borderColor: "var(--border-primary)",
          background: "color-mix(in srgb, var(--bg-secondary) 85%, transparent)",
          color: "var(--text-secondary)",
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>Drag</span> to pan ·{" "}
        <span style={{ color: "var(--text-muted)" }}>Scroll</span> to zoom
        {onMarqueeSelect ? (
          <>
            {" "}
            ·{" "}
            <span style={{ color: "var(--text-muted)" }}>Drag empty</span> to box-select
          </>
        ) : null}
      </div>
    </div>
  );
}

function seatWorldPos(seat: SeatWithZone, cols: number): { x: number; y: number } {
  return {
    x:
      CANVAS_PADDING +
      ROW_LABEL_WIDTH +
      ROW_LABEL_GAP +
      (seat.seat_number - 1) * (SEAT_SIZE + SEAT_GAP) +
      aisleOffset(seat.seat_number, cols),
    y:
      CANVAS_PADDING +
      STAGE_HEIGHT +
      STAGE_MARGIN_BOTTOM +
      (seat.row_number - 1) * (SEAT_SIZE + SEAT_GAP),
  };
}

function BackgroundGrid({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  // Subtle dot grid for depth.
  const dots = [];
  const step = 32;
  for (let x = step; x < width; x += step) {
    for (let y = step; y < height; y += step) {
      dots.push({ x, y });
    }
  }
  return (
    <>
      {dots.map((d, i) => (
        <Circle
          key={i}
          x={d.x}
          y={d.y}
          radius={1}
          fill={color}
          listening={false}
        />
      ))}
    </>
  );
}

function StageElement({
  width,
  colors,
}: {
  width: number;
  colors: ThemeColors;
}) {
  const stageWidth = width - CANVAS_PADDING * 2;
  return (
    <Group x={CANVAS_PADDING} y={CANVAS_PADDING}>
      {/* Glow halo under the stage to suggest lighting */}
      <Rect
        x={-20}
        y={STAGE_HEIGHT - 8}
        width={stageWidth + 40}
        height={STAGE_MARGIN_BOTTOM + 4}
        fillRadialGradientStartPoint={{ x: stageWidth / 2, y: 0 }}
        fillRadialGradientStartRadius={0}
        fillRadialGradientEndPoint={{ x: stageWidth / 2, y: 0 }}
        fillRadialGradientEndRadius={stageWidth * 0.6}
        fillRadialGradientColorStops={[0, colors.stageGlow, 1, "rgba(0,0,0,0)"]}
        listening={false}
      />
      {/* Stage platform with gradient + trapezoid curve */}
      <Rect
        width={stageWidth}
        height={STAGE_HEIGHT}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: STAGE_HEIGHT }}
        fillLinearGradientColorStops={[0, colors.stageGrad1, 1, colors.stageGrad2]}
        cornerRadius={[16, 16, 56, 56]}
        shadowColor="black"
        shadowBlur={20}
        shadowOpacity={0.25}
        shadowOffsetY={6}
      />
      {/* Top thin highlight line */}
      <Rect
        width={stageWidth}
        height={2}
        fill={colors.stageText}
        opacity={0.18}
        cornerRadius={[16, 16, 0, 0]}
        listening={false}
      />
      <Text
        x={0}
        y={0}
        width={stageWidth}
        height={STAGE_HEIGHT}
        align="center"
        verticalAlign="middle"
        text="STAGE"
        fontSize={14}
        fontStyle="bold"
        letterSpacing={8}
        fill={colors.stageText}
        listening={false}
      />
      {/* Step/footlight line below stage */}
      <Line
        points={[20, STAGE_HEIGHT + 6, stageWidth - 20, STAGE_HEIGHT + 6]}
        stroke={colors.stageText}
        strokeWidth={1}
        opacity={0.25}
        listening={false}
      />
    </Group>
  );
}

function RowLabels({
  rows,
  cols,
  color,
  bg,
}: {
  rows: number;
  cols: number;
  color: string;
  bg: string;
}) {
  const totalAisles = cols >= 10 ? Math.floor((cols - 1) / AISLE_EVERY) : 0;
  const rightLabelX =
    CANVAS_PADDING +
    ROW_LABEL_WIDTH +
    ROW_LABEL_GAP +
    cols * SEAT_SIZE +
    (cols - 1) * SEAT_GAP +
    totalAisles * AISLE_WIDTH +
    ROW_LABEL_GAP;

  const items: Array<{ text: string; y: number }> = [];
  for (let r = 1; r <= rows; r++) {
    items.push({
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
      {items.map((l) => (
        <Group key={l.text}>
          {/* Left label pill */}
          <Rect
            x={CANVAS_PADDING - 2}
            y={l.y}
            width={ROW_LABEL_WIDTH}
            height={SEAT_SIZE}
            cornerRadius={6}
            fill={bg}
            listening={false}
          />
          <Text
            x={CANVAS_PADDING - 2}
            y={l.y}
            width={ROW_LABEL_WIDTH}
            height={SEAT_SIZE}
            align="center"
            verticalAlign="middle"
            text={l.text}
            fontSize={11}
            fontStyle="bold"
            fill={color}
            listening={false}
          />
          {/* Right label pill (mirror) */}
          <Rect
            x={rightLabelX}
            y={l.y}
            width={ROW_LABEL_WIDTH}
            height={SEAT_SIZE}
            cornerRadius={6}
            fill={bg}
            listening={false}
          />
          <Text
            x={rightLabelX}
            y={l.y}
            width={ROW_LABEL_WIDTH}
            height={SEAT_SIZE}
            align="center"
            verticalAlign="middle"
            text={l.text}
            fontSize={11}
            fontStyle="bold"
            fill={color}
            listening={false}
          />
        </Group>
      ))}
    </>
  );
}

interface SeatNodeProps {
  seat: SeatWithZone;
  cols: number;
  visual: SeatVisual;
  color?: string;
  onClick?: (seat: SeatWithZone) => void;
}

function SeatNode({ seat, cols, visual, color, onClick }: SeatNodeProps) {
  const { x, y } = seatWorldPos(seat, cols);
  const fill =
    visual === "available" && color ? color : SEAT_COLORS[visual];
  const baseStroke = SEAT_STROKE[visual];
  const opacity = visual === "unassigned" ? 0.55 : visual === "sold" ? 0.55 : 1;
  const isEmphasized = visual === "mine" || visual === "selected";
  const strokeWidth = isEmphasized ? 2 : 1;
  const clickable = onClick && visual !== "unassigned" && visual !== "sold";

  return (
    <Group
      onClick={() => (clickable ? onClick?.(seat) : undefined)}
      onTap={() => (clickable ? onClick?.(seat) : undefined)}
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage && clickable) stage.container().style.cursor = "pointer";
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "default";
      }}
    >
      {/* Seat body */}
      <Rect
        x={x}
        y={y}
        width={SEAT_SIZE}
        height={SEAT_SIZE}
        cornerRadius={[6, 6, 3, 3]}
        fill={fill}
        opacity={opacity}
        stroke={baseStroke}
        strokeWidth={strokeWidth}
        shadowColor={isEmphasized ? fill : "black"}
        shadowBlur={isEmphasized ? 8 : 2}
        shadowOpacity={isEmphasized ? 0.55 : 0.18}
        shadowOffsetY={isEmphasized ? 0 : 1}
      />
      {/* Top highlight sliver to suggest a cushion */}
      <Rect
        x={x + 3}
        y={y + 2}
        width={SEAT_SIZE - 6}
        height={3}
        cornerRadius={2}
        fill="#ffffff"
        opacity={visual === "sold" || visual === "unassigned" ? 0.08 : 0.22}
        listening={false}
      />
      {/* Selected/mine ring for extra emphasis */}
      {isEmphasized && (
        <Rect
          x={x - 2}
          y={y - 2}
          width={SEAT_SIZE + 4}
          height={SEAT_SIZE + 4}
          cornerRadius={8}
          stroke={fill}
          strokeWidth={1.5}
          opacity={0.55}
          listening={false}
        />
      )}
    </Group>
  );
}

/* ─── Floating control pieces ─── */

function ControlButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-9 items-center justify-center transition hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="h-4 w-px"
      style={{ background: "var(--border-primary)" }}
    />
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function FitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
      <path d="M4 15v4a1 1 0 0 0 1 1h4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
    </svg>
  );
}
