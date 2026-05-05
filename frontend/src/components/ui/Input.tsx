import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, className = "", ...rest }: Props) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="input-label">
        {label}
      </label>
      <input id={inputId} {...rest} className={`input-field ${className}`} />
      {hint && !error ? (
        <p className="text-xs font-mono text-[var(--text-muted)]">{hint}</p>
      ) : null}
      {error ? <p className="input-error">{error}</p> : null}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, id, className = "", ...rest }: TextareaProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="input-label">
        {label}
      </label>
      <textarea
        id={inputId}
        {...rest}
        className={`input-field min-h-[120px] resize-y ${className}`}
      />
      {hint && !error ? (
        <p className="text-xs font-mono text-[var(--text-muted)]">{hint}</p>
      ) : null}
      {error ? <p className="input-error">{error}</p> : null}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, id, className = "", ...rest }: SelectProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="input-label">
        {label}
      </label>
      <select id={inputId} {...rest} className={`select-field ${className}`}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <p className="input-error">{error}</p> : null}
    </div>
  );
}
