"use client";

import { useRef, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { Input } from "@/components/shared/field";
import { addChip } from "@/lib/onboarding/flow";

interface ChipsInputProps {
  id: string;
  label: string;
  optional?: boolean;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
  minLen: number;
  maxLen: number;
  /** Suggestions, filtered by the typed prefix (start of the title or of any word), at most three shown. */
  options?: readonly string[];
  help?: string;
  autoComplete?: string;
}

/** Type and press Enter to add a chip; addChip drops blanks, case duplicates and anything past the cap. */
export function ChipsInput({ id, label, optional, placeholder, values, onChange, max, minLen, maxLen, options = [], help, autoComplete }: ChipsInputProps) {
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const q = text.trim().toLowerCase();
  const taken = new Set(values.map((v) => v.toLowerCase()));
  const suggestions =
    values.length >= max ? [] : options.filter((o) => !taken.has(o.toLowerCase()) && (o.toLowerCase().startsWith(q) || o.toLowerCase().includes(` ${q}`))).slice(0, 3);

  const add = (raw: string) => {
    const next = addChip(values, raw, max, minLen, maxLen);
    if (next === values) return;
    onChange(next);
    setText("");
  };

  return (
    <div className="ob-field">
      <label htmlFor={id} className="ob-label">
        {label}
        {optional ? <span className="ob-label__opt"> (optional)</span> : null}
      </label>
      <Input
        ref={input}
        id={id}
        value={text}
        placeholder={placeholder}
        maxLength={maxLen}
        autoComplete={autoComplete}
        enterKeyHint="enter"
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          add(text);
        }}
      />
      {values.length ? (
        <div className="ob-chips">
          {values.map((v) => (
            <button
              key={v}
              type="button"
              className="ob-chip ob-chip--on"
              aria-label={`Remove ${v}`}
              onClick={() => {
                onChange(values.filter((x) => x !== v));
                input.current?.focus();
              }}
            >
              {v}
              <X size={14} aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
      {suggestions.length ? (
        <div className="ob-chips" role="group" aria-label="Suggestions">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="ob-chip"
              onClick={() => {
                add(s);
                input.current?.focus();
              }}
            >
              <Plus size={14} aria-hidden />
              {s}
            </button>
          ))}
        </div>
      ) : null}
      {help ? (
        <p id={`${id}-help`} className="ob-help">
          {help}
        </p>
      ) : null}
    </div>
  );
}
