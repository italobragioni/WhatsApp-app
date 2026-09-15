"use client";

import { useState } from "react";

import { LONG_TEXT_MAX } from "@/lib/limits";

/**
 * Textarea with a live character counter ("N / 50.000 caracteres").
 *
 * It intentionally does NOT set the `maxLength` attribute, so pasting large
 * texts is never silently truncated — the user keeps their content, sees a
 * clear "limite excedido" warning, and the parent form disables submit while
 * over the limit (the server also validates as the source of truth).
 */
export function CharCountTextArea({
  label,
  name,
  defaultValue,
  rows = 4,
  max = LONG_TEXT_MAX,
  hint,
  placeholder,
  onOverChange,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  max?: number;
  hint?: string;
  placeholder?: string;
  /** Reports whether this field currently exceeds `max`. */
  onOverChange?: (name: string, isOver: boolean) => void;
}) {
  const initial = defaultValue ?? "";
  const [count, setCount] = useState(initial.length);
  const over = count > max;

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={initial}
        onChange={(e) => {
          const len = e.target.value.length;
          setCount(len);
          onOverChange?.(name, len > max);
        }}
        className={`w-full rounded-lg border px-3 py-2 text-sm ${
          over ? "border-red-400 focus:border-red-500" : ""
        }`}
      />
      <div className="flex items-center justify-between">
        {hint ? <p className="text-xs text-slate-400">{hint}</p> : <span />}
        <p className={`text-xs ${over ? "text-red-600" : "text-slate-400"}`}>
          {count.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")}{" "}
          caracteres{over ? " — limite excedido" : ""}
        </p>
      </div>
    </div>
  );
}
