"use client";

import { useState } from "react";
import type { Character, Rules } from "@/lib/types";
import type { Derived } from "@/lib/character";

const ROW_COUNTS = [8, 13, 13, 12, 9, 9, 9, 9, 7, 7];
const LABELS = ["Tricks", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
const PAGES = [[0, 1, 2, 3], [4, 5, 6, 7, 8, 9]];

export function TechSheet({
  character,
  rules,
  derived,
  onNote,
  onExpend,
}: {
  character: Character;
  rules: Rules;
  derived: Derived;
  onNote: (key: string, value: string) => void;
  onExpend: (levelIndex: number, count: number) => void;
}) {
  const [page, setPage] = useState(0);
  const byLevel: string[][] = Array.from({ length: 10 }, () => []);
  const seen = new Set<string>();
  for (const id of [...character.techs, ...derived.grantedTechIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    const tech = rules.techs.find((item) => item.id === id);
    const level = tech?.trick || !tech?.level ? 0 : tech.level;
    byLevel[Math.min(9, Math.max(0, level))].push(tech?.name ?? id);
  }

  return (
    <section className="tech-sheet space-y-2">
      <div className="no-print flex flex-wrap items-center gap-2">
        <h2 className="brand text-xl text-pink">Tech list</h2>
        {PAGES.map((_, index) => (
          <button key={index} type="button" className={`border px-3 py-2 text-sm ${page === index ? "border-pink bg-pink text-black" : "border-cyan text-cyan"}`} onClick={() => setPage(index)}>
            Tech page {index + 1}
          </button>
        ))}
      </div>
      {PAGES.map((levels, index) => (
        <article key={index} className={`paper tech-page ${page === index ? "" : "tech-off"}`}>
          <h3>Techs · page {index + 1}</h3>
          <p className="fine">Known techs are filled in. Blank rows are for notes and techs learned later. {derived.techDc != null ? `DC ${derived.techDc} · attack ${derived.techAttack ?? 0}.` : "This runner has no techcasting DC."}</p>
          {levels.map((level) => {
            const total = level === 0 ? 0 : (derived.slots[level - 1] ?? 0);
            const rows = Math.max(ROW_COUNTS[level], byLevel[level].length);
            return (
              <div key={level} className="tech-level">
                <header>
                  <strong>{LABELS[level]}</strong>
                  <span>{level === 0 ? "At will" : `Slots ${total}`}</span>
                  {level > 0 && Array.from({ length: Math.max(total, 1) }, (_, box) => (
                    <input
                      key={box}
                      type="checkbox"
                      aria-label={`${LABELS[level]} slot ${box + 1} expended`}
                      disabled={total === 0}
                      checked={total > 0 && box < (character.slotsExpended[level - 1] ?? 0)}
                      onChange={() => onExpend(level - 1, box < (character.slotsExpended[level - 1] ?? 0) ? box : box + 1)}
                    />
                  ))}
                </header>
                <ol>
                  {Array.from({ length: rows }, (_, row) => {
                    const known = byLevel[level][row];
                    const key = `tech:${level}:${row}`;
                    return (
                      <li key={key}>
                        <span>{row + 1}</span>
                        {known ? <b>{known}</b> : (
                          <input aria-label={`${LABELS[level]} row ${row + 1}`} value={character.sheetNotes[key] ?? ""} onChange={(event) => onNote(key, event.target.value)} />
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </article>
      ))}
    </section>
  );
}
