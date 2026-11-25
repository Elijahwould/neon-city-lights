"use client";

import type { Character, Rules } from "@/lib/types";
import type { ClassLevel } from "@/lib/types";
import { describeGrants, resolveGrants } from "@/lib/grants";
import { Chip } from "./ui";

export function GrantPicks({
  character,
  rules,
  entries,
  onChange,
}: {
  character: Character;
  rules: Rules;
  entries: ClassLevel[];
  onChange: (picks: Record<string, string[]>) => void;
}) {
  const grants = resolveGrants(character, rules, entries, {
    wearingArmor: false,
    armorCategory: null,
    shield: false,
    mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    characterLevel: character.level,
    knownSkills: new Set(),
  });
  const lines = describeGrants(character, rules, entries);
  if (!lines.length && !grants.choices.length) return null;
  const picks = character.grantPicks ?? {};
  const toggle = (id: string, value: string, count: number) => {
    const current = picks[id] ?? [];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value].slice(-count);
    onChange({ ...picks, [id]: next });
  };
  return (
    <div className="space-y-3 border border-cyan/30 p-3">
      <p className="text-xs uppercase tracking-wider text-cyan">Wiki training</p>
      {lines.map((line) => <p key={line} className="text-sm">{line}</p>)}
      {grants.choices.map((choice) => (
        <div key={choice.id}>
          <p className="text-sm text-cyan">{choice.source}: choose {choice.count} {choice.kind}{(picks[choice.id] ?? []).length}/{choice.count}</p>
          <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-auto">
            {choice.options.map((option) => (
              <Chip key={option} active={(picks[choice.id] ?? []).includes(option)} onClick={() => toggle(choice.id, option, choice.count)}>{option}</Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
