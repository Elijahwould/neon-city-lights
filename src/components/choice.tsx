"use client";

import { useState, type ReactNode } from "react";
import { ABILITIES, ABILITY_NAME, type Ability, type HeritageDef } from "@/lib/types";
import { Chip, Select } from "@/components/ui";

export function ChoiceCard({
  choiceId,
  title,
  selected,
  disabled,
  onSelect,
  children,
}: {
  choiceId: string;
  title: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      data-choice={choiceId}
      data-selected={selected ? "true" : "false"}
      className={`cursor-pointer border p-3 ${selected ? "border-pink bg-pink/10" : "border-white/10"} ${disabled ? "opacity-50" : ""}`}
      onClick={(event) => {
        if (disabled) return;
        const target = event.target as HTMLElement;
        if (target.closest("button, a, input, select, textarea")) return;
        onSelect();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <strong className="pt-2 text-base">{title}</strong>
        <button
          type="button"
          aria-pressed={selected}
          disabled={disabled}
          className={`min-h-11 shrink-0 border px-4 text-xs font-semibold disabled:opacity-40 ${selected ? "border-pink bg-pink text-black" : "border-cyan text-cyan"}`}
          onClick={() => onSelect()}
        >
          {selected ? "Selected" : "Select"}
        </button>
      </div>
      {children}
    </div>
  );
}

export function FactList({ rows }: { rows: { label: string; text: string }[] }) {
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {rows.filter((row) => row.text).map((row) => (
        <li key={row.label}>
          <span className="text-cyan">{row.label}.</span> <span className="text-muted">{row.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function HeritageField({
  required,
  heritages,
  value,
  subAsi,
  onChange,
  onAsi,
}: {
  required: boolean;
  heritages: HeritageDef[];
  value: string | null;
  subAsi: Partial<Record<Ability, number>>;
  onChange: (name: string | null) => void;
  onAsi: (ability: Ability, amount: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!heritages.length) return null;
  const chosen = heritages.find((item) => item.name === value) ?? null;
  const bonus = chosen?.asi === "plus2" ? 2 : 1;
  return (
    <div className="mt-3 space-y-2" onClick={(event) => event.stopPropagation()}>
      <label className="block text-sm">
        <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-muted">
          Heritage {required ? "(required, stacks with the lineage increase)" : "(optional, stacks with the lineage increase)"}
        </span>
        <Select
          aria-label="Heritage"
          size={open ? Math.min(8, heritages.length + 1) : 1}
          value={value ?? ""}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value || null);
            setOpen(false);
          }}
          onBlur={() => setOpen(false)}
        >
          <option value="">{required ? "Choose a heritage" : "No heritage"}</option>
          {heritages.map((item) => (
            <option key={item.name} value={item.name}>{item.name}</option>
          ))}
        </Select>
      </label>
      {required && !chosen && <p className="text-sm text-pink">A Jerboan heritage is required. Its bonus stacks with the lineage increase.</p>}
      {chosen && (
        <div className="border border-white/10 p-2 text-sm">
          {chosen.summary && <p>{chosen.summary}</p>}
          <p className="text-cyan">{chosen.asiText ? `Bonus: ${chosen.asiText}` : "No extra ability increase on this heritage."}</p>
          <ul className="mt-1 space-y-1 text-muted">
            {chosen.traits.map((trait) => (
              <li key={trait.name}><span className="text-ink">{trait.name}.</span> {trait.line}</li>
            ))}
          </ul>
          {chosen.asi !== "none" && (
            <div className="mt-2 flex flex-wrap gap-2">
              {ABILITIES.map((ability) => (
                <Chip key={ability} active={(subAsi[ability] ?? 0) > 0} onClick={() => onAsi(ability, bonus)}>
                  Heritage {ABILITY_NAME[ability]} +{bonus}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
