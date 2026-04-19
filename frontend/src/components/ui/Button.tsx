import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-rose-500 text-white hover:bg-rose-400 focus-visible:ring-rose-500",
  secondary:
    "bg-gray-800 text-gray-100 border border-gray-700 hover:bg-gray-700 focus-visible:ring-gray-500",
  ghost:
    "bg-transparent text-gray-300 hover:bg-gray-800 focus-visible:ring-gray-500",
};

export function Button({
  variant = "primary",
  loading,
  disabled,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {loading ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" /> : null}
      {children}
    </button>
  );
}
