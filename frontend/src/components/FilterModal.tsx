import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EventStatus, FilterMeta } from "@/types/catalog";
import { useAuthStore } from "@/store/authStore";

/* ─── Public filter state shared with parent ─── */
export interface FilterState {
  dateRange: { startDate: string | null; endDate: string | null };
  priceRange: { min: number; max: number };
  locations: string[];
  categories: string[];
  status: EventStatus | "";
}

export const defaultFilter = (meta?: FilterMeta, isAdmin: boolean = false): FilterState => ({
  dateRange: { startDate: null, endDate: null },
  priceRange: {
    min: meta?.min_price ?? 0,
    max: meta?.max_price ?? 1000,
  },
  locations: [],
  categories: [],
  status: isAdmin ? "" : "PUBLISHED",
});

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (state: FilterState) => void;
  meta: FilterMeta | undefined;
  initial: FilterState;
}

/* ═══════════════════════════════════════════════════════════════════
   FILTER MODAL
   ═══════════════════════════════════════════════════════════════════ */
export function FilterModal({ open, onClose, onApply, meta, initial }: Props) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "ADMIN";

  const [state, setState] = useState<FilterState>(initial);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync when parent initial changes (e.g. reset from outside)
  useEffect(() => {
    if (open) setState(initial);
  }, [open, initial]);

  // --- helpers --------------------------------------------------------
  const patch = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    setState((s) => ({ ...s, [key]: val }));

  const toggleList = (key: "locations" | "categories", val: string) =>
    setState((s) => ({
      ...s,
      [key]: s[key].includes(val)
        ? s[key].filter((v) => v !== val)
        : [...s[key], val],
    }));

  const reset = () => setState(defaultFilter(meta, isAdmin));
  const apply = () => { onApply(state); onClose(); };

  // --- keyboard / scroll lock -----------------------------------------
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  const absMin = meta?.min_price ?? 0;
  const absMax = meta?.max_price ?? 1000;

  return (
    <div
      ref={overlayRef}
      className="filter-modal-overlay"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="filter-modal-container">
        {/* Header */}
        <div className="filter-modal-header">
          <h2 className="filter-modal-title">Filters</h2>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="filter-modal-body">
          {/* ── Date Range ── */}
          <Section title="Date">
            <DateRangePicker
              startDate={state.dateRange.startDate}
              endDate={state.dateRange.endDate}
              onChange={(startDate, endDate) => patch("dateRange", { startDate, endDate })}
            />
          </Section>

          {/* ── Price Range ── */}
          <Section title="Price range">
            <DualRangeSlider
              absMin={absMin}
              absMax={absMax}
              min={state.priceRange.min}
              max={state.priceRange.max}
              onChange={(min, max) => patch("priceRange", { min, max })}
            />
          </Section>

          {/* ── Location ── */}
          {meta && meta.cities.length > 0 && (
            <Section title="Location">
              <PillGroup
                items={meta.cities}
                selected={state.locations}
                onToggle={(v) => toggleList("locations", v)}
              />
            </Section>
          )}

          {/* ── Category ── */}
          {meta && meta.categories.length > 0 && (
            <Section title="Category">
              <PillGroup
                items={meta.categories}
                selected={state.categories}
                onToggle={(v) => toggleList("categories", v)}
              />
            </Section>
          )}

          {/* ── Status ── */}
          <Section title="Status">
            <PillGroup
              items={isAdmin ? ["PUBLISHED", "DRAFT", "ENDED"] : ["PUBLISHED", "ENDED"]}
              selected={state.status ? [state.status] : []}
              onToggle={(v) => patch("status", state.status === v ? "" : (v as EventStatus))}
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="filter-modal-footer">
          <button type="button" className="btn btn-ghost" onClick={reset}>Reset</button>
          <button type="button" className="btn btn-primary" onClick={apply}>Apply Filters</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION wrapper
   ═══════════════════════════════════════════════════════════════════ */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="filter-section">
      <h3 className="filter-section-title">{title}</h3>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PILL GROUP (locations / categories / status)
   ═══════════════════════════════════════════════════════════════════ */
function PillGroup({
  items,
  selected,
  onToggle,
}: {
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="filter-pills">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          className={`filter-pill ${selected.includes(item) ? "active" : ""}`}
          onClick={() => onToggle(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DUAL RANGE SLIDER
   ═══════════════════════════════════════════════════════════════════ */
function DualRangeSlider({
  absMin,
  absMax,
  min,
  max,
  onChange,
}: {
  absMin: number;
  absMax: number;
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const range = absMax - absMin || 1;
  const leftPct = ((min - absMin) / range) * 100;
  const rightPct = ((absMax - max) / range) * 100;

  return (
    <div className="dual-range">
      <div className="dual-range-labels">
        <span>${min}</span>
        <span>${max}</span>
      </div>
      <div className="dual-range-track-wrapper">
        <div className="dual-range-track" />
        <div
          className="dual-range-fill"
          style={{ left: `${leftPct}%`, right: `${rightPct}%` }}
        />
        <input
          type="range"
          className="dual-range-input"
          min={absMin}
          max={absMax}
          value={min}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(Math.min(v, max - 1), max);
          }}
        />
        <input
          type="range"
          className="dual-range-input"
          min={absMin}
          max={absMax}
          value={max}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(min, Math.max(v, min + 1));
          }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DATE RANGE PICKER (custom, no deps)
   Two-month side-by-side calendar view.
   ═══════════════════════════════════════════════════════════════════ */
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
}) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(
    startDate ? new Date(startDate + "T00:00:00").getMonth() : today.getMonth(),
  );
  const [viewYear, setViewYear] = useState(
    startDate ? new Date(startDate + "T00:00:00").getFullYear() : today.getFullYear(),
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const handleDayClick = (dateStr: string) => {
    if (!startDate || (startDate && endDate)) {
      // Start new selection
      onChange(dateStr, null);
    } else {
      // Set end date
      if (dateStr < startDate) {
        onChange(dateStr, startDate);
      } else {
        onChange(startDate, dateStr);
      }
    }
  };

  const month1 = { year: viewYear, month: viewMonth };
  const month2Year = viewMonth === 11 ? viewYear + 1 : viewYear;
  const month2Month = viewMonth === 11 ? 0 : viewMonth + 1;
  const month2 = { year: month2Year, month: month2Month };

  return (
    <div className="date-picker">
      <div className="date-picker-nav">
        <button type="button" className="date-picker-arrow" onClick={prevMonth}>‹</button>
        <span className="date-picker-month-label">
          {new Date(month1.year, month1.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <span className="date-picker-month-label">
          {new Date(month2.year, month2.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button type="button" className="date-picker-arrow" onClick={nextMonth}>›</button>
      </div>
      <div className="date-picker-months">
        <MonthGrid {...month1} startDate={startDate} endDate={endDate} onDayClick={handleDayClick} />
        <MonthGrid {...month2} startDate={startDate} endDate={endDate} onDayClick={handleDayClick} />
      </div>
    </div>
  );
}

function MonthGrid({
  year,
  month,
  startDate,
  endDate,
  onDayClick,
}: {
  year: number;
  month: number;
  startDate: string | null;
  endDate: string | null;
  onDayClick: (dateStr: string) => void;
}) {
  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const startPad = first.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [year, month]);

  return (
    <div className="month-grid">
      <div className="month-grid-header">
        {WEEKDAYS.map((w) => (
          <span key={w} className="month-grid-weekday">{w}</span>
        ))}
      </div>
      <div className="month-grid-days">
        {days.map((d, i) => {
          if (!d) return <span key={`pad-${i}`} className="month-grid-day pad" />;
          const ds = toDateStr(d);
          const isStart = ds === startDate;
          const isEnd = ds === endDate;
          const inRange =
            startDate && endDate && ds > startDate && ds < endDate;

          let cls = "month-grid-day";
          if (isStart || isEnd) cls += " selected";
          if (inRange) cls += " in-range";
          if (isStart && endDate) cls += " range-start";
          if (isEnd && startDate) cls += " range-end";

          return (
            <button
              key={ds}
              type="button"
              className={cls}
              onClick={() => onDayClick(ds)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
