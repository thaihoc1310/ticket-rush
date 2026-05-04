import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

export interface PillsFieldConfig {
  key: string;
  label: string;
  type: "pills";
  options: string[];
  /** If true, only one pill can be active at a time (radio-like). Default: multi-select. */
  single?: boolean;
}

export interface DateRangeFieldConfig {
  key: string;
  label: string;
  type: "dateRange";
}

export interface NumericRangeFieldConfig {
  key: string;
  label: string;
  type: "numericRange";
  min: number;
  max: number;
  /** Prefix for displayed values, e.g. "$" */
  prefix?: string;
}

export type FilterFieldConfig =
  | PillsFieldConfig
  | DateRangeFieldConfig
  | NumericRangeFieldConfig;

export type FilterValues = Record<string, unknown>;

interface AdminFilterModalProps {
  open: boolean;
  onClose: () => void;
  fields: FilterFieldConfig[];
  values: FilterValues;
  onApply: (values: FilterValues) => void;
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

/** Build a clean default value map from the field configs */
export function defaultValues(fields: FilterFieldConfig[]): FilterValues {
  const out: FilterValues = {};
  for (const f of fields) {
    switch (f.type) {
      case "pills":
        out[f.key] = f.single ? "" : [];
        break;
      case "dateRange":
        out[f.key] = { startDate: null as string | null, endDate: null as string | null };
        break;
      case "numericRange":
        out[f.key] = { min: f.min, max: f.max };
        break;
    }
  }
  return out;
}

/** Count how many fields have a non-default value */
export function countActiveFilters(
  fields: FilterFieldConfig[],
  values: FilterValues,
): number {
  let count = 0;
  for (const f of fields) {
    const v = values[f.key];
    switch (f.type) {
      case "pills":
        if (f.single) {
          if (v) count++;
        } else if (Array.isArray(v) && v.length > 0) count++;
        break;
      case "dateRange": {
        const dr = v as { startDate: string | null; endDate: string | null } | undefined;
        if (dr?.startDate || dr?.endDate) count++;
        break;
      }
      case "numericRange": {
        const nr = v as { min: number; max: number } | undefined;
        if (nr && (nr.min !== f.min || nr.max !== f.max)) count++;
        break;
      }
    }
  }
  return count;
}

/* ═══════════════════════════════════════════════════════════════════
   ADMIN FILTER MODAL
   ═══════════════════════════════════════════════════════════════════ */

export function AdminFilterModal({
  open,
  onClose,
  fields,
  values,
  onApply,
}: AdminFilterModalProps) {
  const [state, setState] = useState<FilterValues>(values);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync when modal opens
  useEffect(() => {
    if (open) setState({ ...values });
  }, [open, values]);

  // Keyboard / scroll lock
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const patch = (key: string, val: unknown) =>
    setState((s) => ({ ...s, [key]: val }));

  const reset = () => setState(defaultValues(fields));
  const apply = () => {
    onApply(state);
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="filter-modal-overlay"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="filter-modal-container">
        {/* Header */}
        <div className="filter-modal-header">
          <h2 className="filter-modal-title">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            className="modal-close"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="filter-modal-body">
          {fields.map((field) => {
            switch (field.type) {
              case "pills":
                return (
                  <Section key={field.key} title={field.label}>
                    <PillGroup
                      items={field.options}
                      selected={
                        field.single
                          ? (state[field.key] as string)
                            ? [state[field.key] as string]
                            : []
                          : (state[field.key] as string[]) ?? []
                      }
                      onToggle={(v) => {
                        if (field.single) {
                          patch(
                            field.key,
                            state[field.key] === v ? "" : v,
                          );
                        } else {
                          const arr = (state[field.key] as string[]) ?? [];
                          patch(
                            field.key,
                            arr.includes(v)
                              ? arr.filter((x) => x !== v)
                              : [...arr, v],
                          );
                        }
                      }}
                    />
                  </Section>
                );

              case "dateRange": {
                const dr = (state[field.key] as {
                  startDate: string | null;
                  endDate: string | null;
                }) ?? { startDate: null, endDate: null };
                return (
                  <Section key={field.key} title={field.label}>
                    <DateRangePicker
                      startDate={dr.startDate}
                      endDate={dr.endDate}
                      onChange={(startDate, endDate) =>
                        patch(field.key, { startDate, endDate })
                      }
                    />
                  </Section>
                );
              }

              case "numericRange": {
                const nr = (state[field.key] as {
                  min: number;
                  max: number;
                }) ?? { min: field.min, max: field.max };
                return (
                  <Section key={field.key} title={field.label}>
                    <DualRangeSlider
                      absMin={field.min}
                      absMax={field.max}
                      min={nr.min}
                      max={nr.max}
                      prefix={field.prefix}
                      onChange={(min, max) => patch(field.key, { min, max })}
                    />
                  </Section>
                );
              }

              default:
                return null;
            }
          })}
        </div>

        {/* Footer */}
        <div className="filter-modal-footer">
          <button type="button" className="btn btn-ghost" onClick={reset}>
            Reset
          </button>
          <button type="button" className="btn btn-primary" onClick={apply}>
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS (from existing FilterModal reference)
   ═══════════════════════════════════════════════════════════════════ */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="filter-section">
      <h3 className="filter-section-title">{title}</h3>
      {children}
    </div>
  );
}

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

function DualRangeSlider({
  absMin,
  absMax,
  min,
  max,
  prefix = "$",
  onChange,
}: {
  absMin: number;
  absMax: number;
  min: number;
  max: number;
  prefix?: string;
  onChange: (min: number, max: number) => void;
}) {
  const range = absMax - absMin || 1;
  const leftPct = ((min - absMin) / range) * 100;
  const rightPct = ((absMax - max) / range) * 100;

  return (
    <div className="dual-range">
      <div className="dual-range-labels">
        <span>
          {prefix}{min}
        </span>
        <span>
          {prefix}{max}
        </span>
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

/* ── Date Range Picker ── */
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
    startDate
      ? new Date(startDate + "T00:00:00").getMonth()
      : today.getMonth(),
  );
  const [viewYear, setViewYear] = useState(
    startDate
      ? new Date(startDate + "T00:00:00").getFullYear()
      : today.getFullYear(),
  );

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const handleDayClick = (dateStr: string) => {
    if (!startDate || (startDate && endDate)) {
      onChange(dateStr, null);
    } else {
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
        <button
          type="button"
          className="date-picker-arrow"
          onClick={prevMonth}
        >
          ‹
        </button>
        <span className="date-picker-month-label">
          {new Date(month1.year, month1.month).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <span className="date-picker-month-label">
          {new Date(month2.year, month2.month).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <button
          type="button"
          className="date-picker-arrow"
          onClick={nextMonth}
        >
          ›
        </button>
      </div>
      <div className="date-picker-months">
        <MonthGrid
          {...month1}
          startDate={startDate}
          endDate={endDate}
          onDayClick={handleDayClick}
        />
        <MonthGrid
          {...month2}
          startDate={startDate}
          endDate={endDate}
          onDayClick={handleDayClick}
        />
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
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      cells.push(new Date(year, month, d));
    return cells;
  }, [year, month]);

  return (
    <div className="month-grid">
      <div className="month-grid-header">
        {WEEKDAYS.map((w) => (
          <span key={w} className="month-grid-weekday">
            {w}
          </span>
        ))}
      </div>
      <div className="month-grid-days">
        {days.map((d, i) => {
          if (!d)
            return (
              <span key={`pad-${i}`} className="month-grid-day pad" />
            );
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
