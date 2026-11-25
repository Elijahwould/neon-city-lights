"use client";

import { useState } from "react";
import { ABILITIES, ABILITY_NAME, type Ability } from "@/lib/types";
import { asiAssignmentOk } from "@/lib/character";
import { Chip } from "@/components/ui";

type Pattern = "plus2" | "plus1" | "two-plus1" | "plus2-plus1" | "three-plus1" | "splicer-two2" | "splicer-mixed";

const PATTERN_LABEL: Record<Pattern, string> = {
  plus2: "+2 to one score",
  plus1: "+1 to one score",
  "two-plus1": "+1 to two scores",
  "plus2-plus1": "+2 and +1 to two scores",
  "three-plus1": "+1 to three scores",
  "splicer-two2": "+2 to two scores",
  "splicer-mixed": "+2, plus +1 to two other scores",
};

export function patternsFor(mode: string): Pattern[] {
  if (mode === "plus2") return ["plus2"];
  if (mode === "plus1") return ["plus1"];
  if (mode === "plus1plus1") return ["two-plus1"];
  if (mode === "flex") return ["plus2", "two-plus1"];
  if (mode === "spread") return ["plus2-plus1", "three-plus1"];
  if (mode === "splicer") return ["splicer-two2", "splicer-mixed"];
  return [];
}

function inferPattern(mode: string, value: Partial<Record<Ability, number>>): Pattern {
  const amounts = ABILITIES.map((ability) => value[ability] ?? 0);
  const ones = amounts.filter((amount) => amount === 1).length;
  const options = patternsFor(mode);
  if (mode === "spread") return ones >= 3 || (ones > 0 && !amounts.includes(2)) ? "three-plus1" : "plus2-plus1";
  if (mode === "splicer") return ones > 0 ? "splicer-mixed" : "splicer-two2";
  if (mode === "flex") return ones > 0 ? "two-plus1" : "plus2";
  return options[0] ?? "plus2";
}

function selected(value: Partial<Record<Ability, number>>, amount?: number) {
  return ABILITIES.filter((ability) => (amount ? value[ability] === amount : (value[ability] ?? 0) > 0));
}

function toggle(value: Partial<Record<Ability, number>>, ability: Ability, amount: number, max: number) {
  const next: Partial<Record<Ability, number>> = { ...value };
  if (next[ability] === amount) {
    delete next[ability];
    return next;
  }
  const same = selected(next, amount);
  if (same.length >= max) delete next[same[0]];
  next[ability] = amount;
  return next;
}

export function AsiPicker({
  mode,
  value,
  onChange,
}: {
  mode: string;
  value: Partial<Record<Ability, number>>;
  onChange: (next: Partial<Record<Ability, number>>) => void;
}) {
  const options = patternsFor(mode);
  const [picked, setPicked] = useState<Pattern | null>(null);
  if (!options.length) return null;
  const pattern = picked && options.includes(picked) ? picked : inferPattern(mode, value);
  const ready = asiAssignmentOk(mode, value);

  function choose(next: Pattern) {
    setPicked(next);
    onChange({});
  }

  function setOne(ability: Ability, amount: number) {
    onChange({ [ability]: amount });
  }

  return (
    <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
      {options.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Chip key={option} active={pattern === option} onClick={() => choose(option)}>{PATTERN_LABEL[option]}</Chip>
          ))}
        </div>
      )}
      {options.length === 1 && <p className="text-xs text-cyan">{PATTERN_LABEL[options[0]]}</p>}
      {(pattern === "plus2" || pattern === "plus1") && (
        <div className="flex flex-wrap gap-2">
          {ABILITIES.map((ability) => {
            const amount = pattern === "plus2" ? 2 : 1;
            return (
              <Chip key={ability} active={value[ability] === amount} onClick={() => setOne(ability, amount)}>
                {ABILITY_NAME[ability]} +{amount}
              </Chip>
            );
          })}
        </div>
      )}
      {pattern === "two-plus1" && (
        <div className="flex flex-wrap gap-2">
          {ABILITIES.map((ability) => (
            <Chip key={ability} active={value[ability] === 1} onClick={() => onChange(toggle(value, ability, 1, 2))}>
              {ABILITY_NAME[ability]} +1
            </Chip>
          ))}
        </div>
      )}
      {pattern === "three-plus1" && (
        <div className="flex flex-wrap gap-2">
          {ABILITIES.map((ability) => (
            <Chip key={ability} active={value[ability] === 1} onClick={() => onChange(toggle(value, ability, 1, 3))}>
              {ABILITY_NAME[ability]} +1
            </Chip>
          ))}
        </div>
      )}
      {pattern === "plus2-plus1" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {ABILITIES.map((ability) => (
              <Chip key={ability} active={value[ability] === 2} onClick={() => {
                const next: Partial<Record<Ability, number>> = {};
                next[ability] = 2;
                const plusOne = ABILITIES.find((candidate) => candidate !== ability && value[candidate] === 1);
                if (plusOne) next[plusOne] = 1;
                onChange(next);
              }}>{ABILITY_NAME[ability]} +2</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {ABILITIES.filter((ability) => value[ability] !== 2).map((ability) => (
              <Chip key={ability} active={value[ability] === 1} onClick={() => {
                const plusTwo = ABILITIES.find((candidate) => value[candidate] === 2);
                const next: Partial<Record<Ability, number>> = {};
                if (plusTwo) next[plusTwo] = 2;
                next[ability] = 1;
                onChange(next);
              }}>{ABILITY_NAME[ability]} +1</Chip>
            ))}
          </div>
        </div>
      )}
      {pattern === "splicer-two2" && (
        <div className="flex flex-wrap gap-2">
          {ABILITIES.map((ability) => (
            <Chip key={ability} active={value[ability] === 2} onClick={() => onChange(toggle(value, ability, 2, 2))}>
              {ABILITY_NAME[ability]} +2
            </Chip>
          ))}
        </div>
      )}
      {pattern === "splicer-mixed" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {ABILITIES.map((ability) => (
              <Chip key={ability} active={value[ability] === 2} onClick={() => {
                const next: Partial<Record<Ability, number>> = { [ability]: 2 };
                ABILITIES.filter((candidate) => candidate !== ability && value[candidate] === 1).slice(0, 2).forEach((candidate) => { next[candidate] = 1; });
                onChange(next);
              }}>{ABILITY_NAME[ability]} +2</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {ABILITIES.filter((ability) => value[ability] !== 2).map((ability) => (
              <Chip key={ability} active={value[ability] === 1} onClick={() => {
                const plusTwo = ABILITIES.find((candidate) => value[candidate] === 2);
                const next: Partial<Record<Ability, number>> = {};
                if (plusTwo) next[plusTwo] = 2;
                const ones = ABILITIES.filter((candidate) => candidate !== ability && value[candidate] === 1 && candidate !== plusTwo);
                if (value[ability] === 1) ones.forEach((candidate) => { next[candidate] = 1; });
                else {
                  ones.slice(0, 1).forEach((candidate) => { next[candidate] = 1; });
                  next[ability] = 1;
                }
                onChange(next);
              }}>{ABILITY_NAME[ability]} +1</Chip>
            ))}
          </div>
        </div>
      )}
      <p className={ready ? "text-xs text-cyan" : "text-xs text-pink"}>{ready ? "Ability increase assigned. It cannot raise a score above 20 before cybernetics." : "Finish the ability increase before leaving this step."}</p>
    </div>
  );
}
