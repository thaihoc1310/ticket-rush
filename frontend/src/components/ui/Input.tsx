import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, ...rest }: Props) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-300">
        {label}
      </label>
      <input
        id={inputId}
        {...rest}
        className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 shadow-sm outline-none transition placeholder:text-gray-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 disabled:cursor-not-allowed disabled:bg-gray-900"
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
