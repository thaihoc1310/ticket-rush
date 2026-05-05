import type { ReactNode } from "react";

type BadgeVariant = "success" | "warning" | "danger" | "muted" | "accent";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  led?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = "muted",
  led = false,
  className = "",
}: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {led && <span className={`led led-${variant}`} />}
      {children}
    </span>
  );
}

interface LEDProps {
  status: "success" | "warning" | "danger" | "accent";
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-3 h-3",
};

export function LED({ status, pulse = true, size = "md" }: LEDProps) {
  return (
    <span
      className={`led led-${status} ${SIZE_CLASSES[size]} ${pulse ? "" : "animate-none"}`}
    />
  );
}

interface StatusIndicatorProps {
  status: "online" | "offline" | "busy" | "away";
  label?: string;
}

const STATUS_CONFIG = {
  online: { led: "success" as const, text: "ONLINE" },
  offline: { led: "danger" as const, text: "OFFLINE" },
  busy: { led: "danger" as const, text: "BUSY" },
  away: { led: "warning" as const, text: "AWAY" },
};

export function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-2">
      <LED status={config.led} />
      <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        {label ?? config.text}
      </span>
    </div>
  );
}
