import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  elevated?: boolean;
  screws?: boolean;
  vents?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const PADDING_CLASSES = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  children,
  elevated = false,
  screws = false,
  vents = false,
  padding = "md",
  className = "",
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={`card ${elevated ? "card-elevated" : ""} ${screws ? "card-screws" : ""} ${PADDING_CLASSES[padding]} ${className}`}
    >
      {vents && (
        <div className="card-vents">
          <div className="card-vent" />
          <div className="card-vent" />
          <div className="card-vent" />
        </div>
      )}
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
  icon?: ReactNode;
}

export function StatCard({ label, value, hint, loading, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-[var(--muted)]" />
          ) : (
            <p className="stat-value">{value}</p>
          )}
          {hint && <p className="stat-hint">{hint}</p>}
        </div>
        {icon && <div className="icon-housing icon-housing-sm">{icon}</div>}
      </div>
    </div>
  );
}

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  dark?: boolean;
}

export function Panel({
  children,
  title,
  subtitle,
  action,
  dark = false,
  className = "",
  ...rest
}: PanelProps) {
  return (
    <div
      {...rest}
      className={`rounded-2xl p-6 shadow-[var(--shadow-card)] ${
        dark
          ? "bg-[var(--dark-panel)] text-white"
          : "bg-[var(--background)]"
      } ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            {title && (
              <h2
                className={`text-base font-bold ${
                  dark ? "text-white" : "text-[var(--text-primary)]"
                }`}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className={`mt-0.5 text-xs ${
                  dark ? "text-[var(--dark-text-muted)]" : "text-[var(--text-muted)]"
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
