import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className = "", ...rest }: Props) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="input-label">
        {label}
      </label>
      <input id={inputId} {...rest} className={`input-field ${className}`} />
      {error ? <p className="input-error">{error}</p> : null}
    </div>
  );
}
