"use client";

import { useState } from "react";
import { TextInput } from "@/components/ui";
import {
  FEAT_TECH_CHOICES,
  classEntries,
  classLevelAccess,
  classTechBudget,
  collectGrantedTechs,
  findClass,
  findSubclass,
  resolvedTechPicks,
  techListFor,
  techPickCounts,
  type GrantedTechNote,
} from "@/lib/character";
import type { Ability, Character, Rules, TechDef, TechPick } from "@/lib/types";

type TechText = Record<string, { summary: string; effect: string }>;

const STYLE_BONUS = [
  { style: "Ordained Warrior", listId: "ordinator", pickId: "bonus:ordinator", tricks: 2, label: "Ordained Warrior" },
  { style: "Introvert", listId: "shutin", pickId: "bonus:shutin", tricks: 2, label: "Introvert" },
];

const FEAT_LISTS: Record<string, string[]> = {
  "feat:hacker-wannabe": ["influencer", "ordinator", "shutin", "sourcecoder", "streamer", "techwizard"],
  "feat:boosted-wifi": ["influencer", "ordinator", "shutin"],
  "feat:mechanist-wannabe": ["mechanist"],
};

function isTrick(tech: { trick: boolean; level: number | null }) {
  return tech.trick || !tech.level;
}

function levelOf(tech: { trick: boolean; level: number | null }) {
  return isTrick(tech) ? 0 : tech.level ?? 0;
}

export function TechPicker({
  rules,
  character,
  mods,
  slots,
  pactLevel,
  techText,
  onChange,
}: {
  rules: Rules;
  character: Character;
  mods: Record<Ability, number>;
  slots: number[];
  pactLevel: number | null;
  techText: TechText;
  onChange: (next: Pick<Character, "techPicks" | "techs" | "prepared">) => void;
}) {
  const [query, setQuery] = useState("");
  const picks = resolvedTechPicks(character, rules);
  const grants = collectGrantedTechs(rules, character);
  const grantIds = new Set(grants.map((note) => note.id));
  const needle = query.toLowerCase();

  function commit(nextPicks: TechPick[], prepared: string[]) {
    const techs = [...new Set(nextPicks.map((pick) => pick.id))];
    onChange({ techPicks: nextPicks, techs, prepared: prepared.filter((id) => techs.includes(id)) });
  }

  function toggle(classId: string, tech: TechDef, mode: "known" | "prepared" | "deck" | "bonus") {
    const owned = picks.some((pick) => pick.id === tech.id && pick.classId === classId);
    const nextPicks = owned
      ? picks.filter((pick) => !(pick.id === tech.id && pick.classId === classId))
      : [...picks, { id: tech.id, classId }];
    let prepared = character.prepared.filter((id) => id !== tech.id || nextPicks.some((pick) => pick.id === id));
    if (!owned && mode === "prepared") prepared = [...prepared, tech.id];
    if (owned) prepared = prepared.filter((id) => id !== tech.id);
    commit(nextPicks, prepared);
  }

  function togglePrepared(techId: string) {
    const prepared = character.prepared.includes(techId)
      ? character.prepared.filter((id) => id !== techId)
      : [...character.prepared, techId];
    commit(picks, prepared);
  }

  const classBlocks = classEntries(character).map((entry) => {
    const cls = findClass(rules, entry.id);
    if (!cls) return null;
    const sub = findSubclass(rules, entry.subclassId);
    const ability = cls.prepared?.ability ?? cls.techAbility;
    const budget = classTechBudget(cls, sub, entry.level, ability ? mods[ability] : 0);
    const access = classLevelAccess(cls, sub, entry.level);
    const list = techListFor(rules, cls, sub);
    const counts = techPickCounts(picks, entry.id, rules.techs, grantIds);
    const mine = grants.filter((note) => note.classId === entry.id);
    if (budget.tricks === 0 && budget.techs === 0 && !mine.length && !list.length) return null;
    return { entry, cls, budget, access, list, counts, mine };
  }).filter((block): block is NonNullable<typeof block> => Boolean(block));

  const looseGrants = grants.filter((note) => note.classId === "lineage" || note.classId.startsWith("feat:"));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Tricks and techs are separate picks. The numbers come from that class’s wiki table at this level. Granted tricks and techs are added for you and do not spend a pick.</p>
      <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tricks and techs" />
      {looseGrants.length > 0 && <GrantList notes={looseGrants} rules={rules} techText={techText} />}
      {classBlocks.map((block) => (
        <section key={block.entry.id} className="space-y-3 border border-white/10 p-3" data-class-tech={block.entry.id}>
          <h2 className="text-cyan">{block.cls.name} {block.entry.level}</h2>
          <p className="text-sm" data-tech-counter={block.entry.id}>Tricks {block.counts.tricks}/{block.budget.tricks} · Techs {block.counts.techs}/{block.budget.techs}{block.budget.mode === "deck" ? ` · Prepared ${character.prepared.filter((id) => picks.some((pick) => pick.id === id && pick.classId === block.entry.id)).length}/${block.budget.prepared}` : ""}</p>
          <p className="text-xs text-muted">{block.budget.mode === "deck" ? "The cyberdeck is the techs you know. It starts at 6 and gains 2 at each Techwizard level after 1st. Prepare Intelligence + Techwizard level." : block.budget.mode === "prepared" ? "You prepare this many techs from the class list. The count is the wiki prepared formula." : "You learn this many from the class list. The counts are the wiki table for this level."}</p>
          {block.mine.length > 0 && <GrantList notes={block.mine} rules={rules} techText={techText} />}
          {block.budget.tricks > 0 && (
            <LevelGroup
              title="Tricks"
              gate={block.access[0]}
              techs={block.list.filter((tech) => isTrick(tech) && !grantIds.has(tech.id) && matches(tech, needle, techText))}
              picks={picks}
              classId={block.entry.id}
              used={block.counts.tricks}
              cap={block.budget.tricks}
              mode={block.budget.mode}
              prepared={character.prepared}
              preparedMax={block.budget.prepared}
              techText={techText}
              onToggle={toggle}
              onPrepare={togglePrepared}
            />
          )}
          <div className="space-y-3">
            <h3 className="text-sm uppercase tracking-wide text-pink">Techs</h3>
            {block.access.filter((gate) => gate.level > 0).map((gate) => {
              const techs = block.list.filter((tech) => levelOf(tech) === gate.level && !grantIds.has(tech.id) && matches(tech, needle, techText));
              if (!techs.length) return null;
              return (
                <LevelGroup
                  key={gate.level}
                  title={`Level ${gate.level}`}
                  gate={gate}
                  techs={techs}
                  picks={picks}
                  classId={block.entry.id}
                  used={block.counts.techs}
                  cap={block.budget.techs}
                  mode={block.budget.mode}
                  prepared={character.prepared}
                  preparedMax={block.budget.prepared}
                  techText={techText}
                  onToggle={toggle}
                  onPrepare={togglePrepared}
                />
              );
            })}
          </div>
        </section>
      ))}
      {STYLE_BONUS.filter((bonus) => character.fightingStyles.includes(bonus.style)).map((bonus) => {
        const list = techListFor(rules, findClass(rules, bonus.listId), null).filter((tech) => isTrick(tech));
        const counts = techPickCounts(picks, bonus.pickId, rules.techs, grantIds);
        return (
          <section key={bonus.pickId} className="space-y-2 border border-white/10 p-3">
            <h2 className="text-cyan">{bonus.label}</h2>
            <p className="text-sm">Tricks {counts.tricks}/{bonus.tricks}. These do not count against your class picks.</p>
            <LevelGroup
              title="Tricks"
              gate={{ level: 0, open: true, reason: "" }}
              techs={list.filter((tech) => matches(tech, needle, techText))}
              picks={picks}
              classId={bonus.pickId}
              used={counts.tricks}
              cap={bonus.tricks}
              mode="bonus"
              prepared={character.prepared}
              preparedMax={null}
              techText={techText}
              onToggle={toggle}
              onPrepare={togglePrepared}
            />
          </section>
        );
      })}
      {character.asiPicks.filter((pick) => pick.featId && FEAT_TECH_CHOICES[pick.featId]).map((pick) => {
        const featId = pick.featId!;
        const choice = FEAT_TECH_CHOICES[featId];
        const feat = rules.feats.find((item) => item.id === featId);
        const pickId = `feat:${featId}`;
        const lists = FEAT_LISTS[featId] ?? classEntries(character).map((entry) => entry.id);
        const pool = rules.techs.filter((tech, index, all) => lists.some((id) => (tech.classes ?? []).includes(id)) && all.findIndex((item) => item.id === tech.id) === index);
        const sectorLimit = featId === "feat:ghetto-go-getter" ? ["deception", "biochemistry"] : null;
        const counts = techPickCounts(picks, pickId, rules.techs, grantIds);
        const tricks = pool.filter((tech) => isTrick(tech) && matches(tech, needle, techText));
        const techs = pool.filter((tech) => !isTrick(tech) && (tech.level ?? 0) <= choice.maxLevel && (!sectorLimit || sectorLimit.includes((tech.sector ?? "").toLowerCase())) && matches(tech, needle, techText));
        return (
          <section key={featId} className="space-y-2 border border-white/10 p-3">
            <h2 className="text-cyan">{feat?.name ?? "Feat"}</h2>
            <p className="text-sm">Tricks {counts.tricks}/{choice.tricks} · Techs {counts.techs}/{choice.techs}. Granted by {feat?.name}. These do not count against your class picks.</p>
            {choice.tricks > 0 && (
              <LevelGroup title="Tricks" gate={{ level: 0, open: true, reason: "" }} techs={tricks} picks={picks} classId={pickId} used={counts.tricks} cap={choice.tricks} mode="bonus" prepared={character.prepared} preparedMax={null} techText={techText} onToggle={toggle} onPrepare={togglePrepared} />
            )}
            {choice.techs > 0 && (
              <LevelGroup title={`Techs up to level ${choice.maxLevel}`} gate={{ level: 1, open: true, reason: "" }} techs={techs} picks={picks} classId={pickId} used={counts.techs} cap={choice.techs} mode="bonus" prepared={character.prepared} preparedMax={null} techText={techText} onToggle={(classId, tech) => {
                const castable = (tech.level ?? 0) === 0 || (slots[(tech.level ?? 1) - 1] ?? 0) > 0 || (pactLevel != null && (tech.level ?? 0) <= pactLevel);
                if (!castable && !picks.some((item) => item.id === tech.id && item.classId === classId)) return;
                toggle(classId, tech, "bonus");
              }} onPrepare={togglePrepared} />
            )}
          </section>
        );
      })}
    </div>
  );
}

function matches(tech: TechDef, needle: string, techText: TechText) {
  if (!needle) return true;
  return `${tech.name} ${tech.sector ?? ""} ${techText[tech.id]?.summary ?? ""}`.toLowerCase().includes(needle);
}

function GrantList({ notes, rules, techText }: { notes: GrantedTechNote[]; rules: Rules; techText: TechText }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-pink">Granted · does not count against your picks</p>
      {notes.map((note) => {
        const tech = rules.techs.find((item) => item.id === note.id);
        return (
          <article key={`${note.classId}-${note.id}`} className="border border-pink/40 p-2 text-sm" data-granted={note.id}>
            <p className="font-semibold">{note.name}{tech?.sector ? ` · ${tech.sector}` : ""}</p>
            <p className="text-xs text-cyan">{note.source}</p>
            {techText[note.id]?.summary && <p className="mt-1 text-xs text-muted">{techText[note.id].summary}</p>}
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">{[tech?.castingTime, tech?.range, tech?.duration].filter(Boolean).join(" · ")}</p>
            <details className="mt-1 border border-white/10 px-2 py-1 text-xs text-muted">
              <summary className="cursor-pointer text-cyan">Full description</summary>
              <p className="mt-1 whitespace-pre-wrap">{techText[note.id]?.effect || "The wiki page has no effect text in the mirror."}</p>
            </details>
          </article>
        );
      })}
    </div>
  );
}

function LevelGroup({
  title,
  gate,
  techs,
  picks,
  classId,
  used,
  cap,
  mode,
  prepared,
  preparedMax,
  techText,
  onToggle,
  onPrepare,
}: {
  title: string;
  gate: { level: number; open: boolean; reason: string };
  techs: TechDef[];
  picks: TechPick[];
  classId: string;
  used: number;
  cap: number;
  mode: "known" | "prepared" | "deck" | "bonus";
  prepared: string[];
  preparedMax: number | null;
  techText: TechText;
  onToggle: (classId: string, tech: TechDef, mode: "known" | "prepared" | "deck" | "bonus") => void;
  onPrepare: (techId: string) => void;
}) {
  if (!techs.length) return null;
  const preparedCount = prepared.length;
  return (
    <section className="space-y-1">
      <h3 className="text-sm uppercase tracking-wide text-cyan">{title}{gate.open ? "" : ` · ${gate.reason}`}</h3>
      {techs.map((tech) => {
        const owned = picks.some((pick) => pick.id === tech.id && pick.classId === classId);
        const blocked = (!gate.open && !owned) || (!owned && used >= cap);
        const ready = prepared.includes(tech.id);
        const prepareBlocked = !ready && (preparedCount >= (preparedMax ?? 0) || !owned);
        return (
          <div key={tech.id} className={`space-y-1 border p-2 ${owned ? "border-pink bg-pink/10" : "border-white/10"}`}>
            <button type="button" aria-pressed={owned} disabled={blocked} data-tech={tech.id} className="block min-h-11 w-full px-1 py-1 text-left text-sm disabled:opacity-40" onClick={() => { if (!blocked || owned) onToggle(classId, tech, mode); }}>
              <span className="block">{owned ? "Selected · " : ""}{tech.name} · {tech.sector}{!gate.open ? ` · ${gate.reason}` : ""}</span>
              {techText[tech.id]?.summary && <span className="mt-1 block text-xs text-muted">{techText[tech.id].summary}</span>}
              <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted">{[tech.castingTime, tech.range, tech.duration].filter(Boolean).join(" · ")}</span>
            </button>
            {mode === "deck" && !isTrick(tech) && (
              <button type="button" disabled={prepareBlocked && !ready} className={`min-h-11 border px-2 text-xs disabled:opacity-40 ${ready ? "border-pink text-pink" : "border-white/20"}`} onClick={() => onPrepare(tech.id)}>{ready ? "Prepared" : "Prepare"}</button>
            )}
            <details className="border border-white/10 px-2 py-1 text-xs text-muted">
              <summary className="cursor-pointer text-cyan">Full description</summary>
              <p className="mt-1 whitespace-pre-wrap">{techText[tech.id]?.effect || "The wiki page has no effect text in the mirror."}</p>
            </details>
          </div>
        );
      })}
    </section>
  );
}
