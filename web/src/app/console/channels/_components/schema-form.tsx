"use client";

// Generic JSON-Schema-driven form renderer.
//
// We keep this intentionally small: handle the shapes OpenClaw actually uses
// in channel configs (string/number/boolean/enum/array-of-strings/object).
// Unknown shapes fall through to a raw JSON textarea so the user is never
// blocked.
//
// Secret detection: fields whose name ends in Token/Secret/Password/Key are
// rendered as password inputs with a "Show" toggle.

import { useState, useCallback } from "react";
import { EyeIcon, EyeOffIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type JSONValue = unknown;
type JSONObject = Record<string, unknown>;

interface SchemaNode {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  required?: string[];
  title?: string;
  format?: string;
}

const SECRET_RE = /(token|secret|password|key|sid)$/i;

function isSecret(key: string): boolean {
  return SECRET_RE.test(key);
}

function humanize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export interface SchemaFormProps {
  schema: SchemaNode | null;
  value: JSONObject;
  onChange: (next: JSONObject) => void;
  /** When set, only render these top-level keys (used by the Setup tab). */
  onlyKeys?: string[];
  /** When set, render every top-level key EXCEPT these. */
  excludeKeys?: string[];
  /** Per-field hint that overrides `schema.description`. */
  fieldHints?: Record<string, string>;
  /** Indent depth for nested objects. */
  depth?: number;
}

export function SchemaForm({ schema, value, onChange, onlyKeys, excludeKeys, fieldHints, depth = 0 }: SchemaFormProps) {
  if (!schema || !schema.properties) {
    return (
      <JsonFallback
        value={value}
        onChange={(v) => onChange((v as JSONObject) ?? {})}
        label="No schema available — edit raw JSON:"
      />
    );
  }

  const allKeys = Object.keys(schema.properties);
  const keys = (onlyKeys ?? allKeys).filter(
    (k) => !(excludeKeys?.includes(k)) && schema.properties?.[k],
  );

  return (
    <div className={cn("flex flex-col gap-3", depth > 0 && "pl-3 border-l border-[var(--border)]")}>
      {keys.map((key) => {
        const sub = schema.properties![key];
        return (
          <FieldRow
            key={key}
            name={key}
            schema={sub}
            value={value[key] as JSONValue}
            required={schema.required?.includes(key)}
            hintOverride={fieldHints?.[key]}
            onChange={(v) => {
              const next = { ...value };
              if (v === undefined) delete next[key];
              else next[key] = v;
              onChange(next);
            }}
            depth={depth}
          />
        );
      })}
    </div>
  );
}

function FieldRow({
  name,
  schema,
  value,
  required,
  hintOverride,
  onChange,
  depth,
}: {
  name: string;
  schema: SchemaNode;
  value: JSONValue | undefined;
  required?: boolean;
  hintOverride?: string;
  onChange: (v: JSONValue | undefined) => void;
  depth: number;
}) {
  const t = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  const label = schema.title ?? humanize(name);
  const hint = hintOverride ?? schema.description;

  // enum -> select
  if (schema.enum && schema.enum.length > 0) {
    return (
      <Labeled label={label} hint={hint} required={required}>
        <select
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : (e.target.value as JSONValue))}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)]/60 focus:outline-none"
        >
          <option value="">— default —</option>
          {schema.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      </Labeled>
    );
  }

  if (t === "boolean") {
    return (
      <Labeled label={label} hint={hint} required={required} inline>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 rounded border-[var(--border)] accent-[var(--accent)]"
        />
      </Labeled>
    );
  }

  if (t === "number" || t === "integer") {
    return (
      <Labeled label={label} hint={hint} required={required}>
        <input
          type="number"
          value={value == null ? "" : Number(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)]/60 focus:outline-none"
        />
      </Labeled>
    );
  }

  if (t === "string" || t == null) {
    if (isSecret(name)) {
      return (
        <Labeled label={label} hint={hint} required={required}>
          <SecretInput value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v || undefined)} />
        </Labeled>
      );
    }
    return (
      <Labeled label={label} hint={hint} required={required}>
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={schema.default == null ? "" : String(schema.default)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)]/60 focus:outline-none"
        />
      </Labeled>
    );
  }

  if (t === "array") {
    const itemType = schema.items?.type;
    if (itemType === "string" || itemType == null) {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Labeled label={label} hint={hint ?? "One per line"} required={required}>
          <textarea
            value={arr.join("\n")}
            onChange={(e) => {
              const lines = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
              onChange(lines.length ? lines : undefined);
            }}
            rows={3}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm font-mono text-[var(--text)] focus:border-[var(--accent)]/60 focus:outline-none"
          />
        </Labeled>
      );
    }
    return <JsonFallback label={label} value={value ?? []} onChange={onChange} />;
  }

  if (t === "object" && schema.properties) {
    return (
      <CollapsibleSection title={label} hint={hint} defaultOpen={depth === 0}>
        <SchemaForm
          schema={schema}
          value={(value as JSONObject) ?? {}}
          onChange={(next) => onChange(Object.keys(next).length ? (next as JSONValue) : undefined)}
          depth={depth + 1}
        />
      </CollapsibleSection>
    );
  }

  return <JsonFallback label={label} value={value ?? null} onChange={onChange} />;
}

function Labeled({
  label,
  hint,
  required,
  inline,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex gap-1", inline ? "flex-row items-center justify-between" : "flex-col")}>
      <div className={cn("flex flex-col", inline && "flex-1")}>
        <label className="text-xs font-medium text-[var(--text-dim)]">
          {label}
          {required && <span className="text-[var(--status-error)] ml-1">*</span>}
        </label>
        {hint && <span className="text-[11px] text-[var(--muted)]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SecretInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 pr-8 text-sm font-mono text-[var(--text)] focus:border-[var(--accent)]/60 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
      >
        {show ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
      </button>
    </div>
  );
}

function CollapsibleSection({
  title,
  hint,
  defaultOpen,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[var(--text)]">{title}</span>
          {hint && <span className="text-[11px] text-[var(--muted)]">{hint}</span>}
        </div>
        {open ? <ChevronDownIcon className="size-3.5 text-[var(--muted)]" /> : <ChevronRightIcon className="size-3.5 text-[var(--muted)]" />}
      </button>
      {open && <div className="border-t border-[var(--border)] p-3">{children}</div>}
    </div>
  );
}

function JsonFallback({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: JSONValue;
  onChange: (v: JSONValue | undefined) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [err, setErr] = useState<string | null>(null);
  const handle = useCallback(
    (s: string) => {
      setText(s);
      try {
        const parsed = s.trim() === "" ? undefined : (JSON.parse(s) as JSONValue);
        setErr(null);
        onChange(parsed);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "invalid JSON");
      }
    },
    [onChange],
  );
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[var(--text-dim)]">{label}</label>}
      <textarea
        value={text}
        onChange={(e) => handle(e.target.value)}
        rows={6}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-mono text-[var(--text)] focus:border-[var(--accent)]/60 focus:outline-none"
      />
      {err && <span className="text-[11px] text-[var(--status-error)]">{err}</span>}
    </div>
  );
}
