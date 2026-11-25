"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AsiPicker } from "@/components/asi-picker";
import { TechSheet } from "@/components/tech-sheet";
import { Button, Select, TextInput } from "@/components/ui";
import { AVRAE_CELL_MAP, characterAsText, downloadAvrae, downloadAvraeCsv } from "@/lib/avrae-sheet";
import { GOOGLE_SHEET_LABEL, GOOGLE_SHEET_URL } from "@/lib/config";
import { ABILITIES, ABILITY_NAME, type Ability, type Character, type Rules } from "@/lib/types";
import { loadRules } from "@/lib/data";
import { decodeShare, downloadCharacter, encodeShare, getCharacter, upsertCharacter } from "@/lib/storage";
import {
  SOURCE_SLOT_COST,
  applyLevelUp,
  asiAssignmentOk,
  asiLevels,
  canTakeClassLevel,
  classEntries,
  classNeedsFightingStyle,
  creditsLabel,
  derive,
  featuresThrough,
  FIGHTING_STYLES,
  findClass,
  formatMod,
  normalizeCharacter,
} from "@/lib/character";

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

function listedFeatures(character: Character, rules: Rules, book: Record<string, { text?: string; level?: number | null; source?: string }>) {
  const rows: { name: string; source: string; level: number; text: string }[] = [];
  for (const entry of classEntries(character)) {
    const cls = findClass(rules, entry.id);
    if (!cls) continue;
    for (const name of featuresThrough(cls, entry.level)) {
      const level = cls.levels.find((row) => row.features.includes(name))?.level ?? 1;
      rows.push({ name, source: cls.name, level, text: book[`${cls.id}::${name}`]?.text || "Named on the class table. Open the class page for the full write-up." });
    }
    if (entry.subclassId) {
      const prefix = `${entry.subclassId}::`;
      for (const [key, value] of Object.entries(book)) {
        if (!key.startsWith(prefix) || !value.text) continue;
        const level = value.level ?? cls.subclassLevel ?? 1;
        if (level > entry.level) continue;
        rows.push({ name: key.slice(prefix.length), source: value.source || "Subclass", level, text: value.text });
      }
    }
  }
  const lineage = rules.lineages.find((item) => item.id === character.lineageId);
  if (lineage) {
    for (const trait of lineage.traits) rows.push({ name: trait.name, source: lineage.name, level: 1, text: trait.line });
    const heritage = lineage.sublineages.find((item) => item.name === character.sublineage);
    if (heritage) for (const trait of heritage.traits) rows.push({ name: trait.name, source: heritage.name, level: 1, text: trait.line });
  }
  const upbringing = rules.upbringings.find((item) => item.id === character.upbringingId);
  if (upbringing?.feature) rows.push({ name: upbringing.feature, source: upbringing.name, level: 1, text: upbringing.featureLine || "See the upbringing page." });
  for (const pick of character.asiPicks) {
    if (pick.mode !== "feat" || !pick.featId) continue;
    const feat = rules.feats.find((item) => item.id === pick.featId);
    rows.push({ name: feat?.name ?? pick.featId, source: "Feat", level: pick.level || 1, text: book[pick.featId]?.text || "See the feat page." });
  }
  return rows;
}

function SheetInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const [rules, setRules] = useState<Rules | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [levelOpen, setLevelOpen] = useState(false);
  const [gainClass, setGainClass] = useState("");
  const [pendingSubclass, setPendingSubclass] = useState("");
  const [pendingAsi, setPendingAsi] = useState<Partial<Record<Ability, number>>>({});
  const [pendingFeat, setPendingFeat] = useState("");
  const [pendingFeatAbility, setPendingFeatAbility] = useState<Ability | "">("");
  const [pendingStyle, setPendingStyle] = useState("");
  const [featAsi, setFeatAsi] = useState<Record<string, { amount: number; choices: Ability[] }>>({});
  const [avraeHelp, setAvraeHelp] = useState(false);
  const [copied, setCopied] = useState("");
  const [featureBook, setFeatureBook] = useState<Record<string, { text?: string; level?: number | null; source?: string }>>({});
  const [techText, setTechText] = useState<Record<string, { summary: string; effect: string }>>({});
  const [openFeatures, setOpenFeatures] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadRules().then(setRules).catch((err: Error) => setError(err.message));
    fetch("/data/feature-text.json").then((res) => res.json()).then(setFeatureBook).catch(() => undefined);
    fetch("/data/tech-text.json").then((res) => res.json()).then(setTechText).catch(() => undefined);
    fetch("/data/feat-asi.json").then((res) => res.json()).then(setFeatAsi).catch(() => undefined);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash.startsWith("share=")) {
      decodeShare(decodeURIComponent(hash.slice(6))).then((imported) => {
        const next = normalizeCharacter(imported);
        upsertCharacter(next);
        setCharacter(next);
      }).catch(() => setError("Could not read that share link."));
      return;
    }
    if (id) {
      const found = getCharacter(id);
      setCharacter(found ? normalizeCharacter(found) : null);
    }
  }, [id]);

  const derived = useMemo(() => (rules && character ? derive(character, rules) : null), [rules, character]);

  function save(next: Character) {
    const normalized = normalizeCharacter(next);
    setCharacter(normalized);
    upsertCharacter(normalized);
  }

  if (error) return <p className="text-pink">{error}</p>;
  if (!rules) return <p className="text-muted">Loading rules…</p>;
  if (!character || !derived) return <p className="text-muted">No runner loaded. <Link className="text-cyan" href="/characters/">Pick one</Link> or <Link className="text-cyan" href="/builder/">build one</Link>.</p>;

  const entries = classEntries(character);
  const target = gainClass || entries[0]?.id || "";
  const targetEntry = entries.find((entry) => entry.id === target);
  const targetClass = findClass(rules, target);
  const nextClassLevel = (targetEntry?.level ?? 0) + 1;
  const needsAsi = Boolean(targetClass && asiLevels(targetClass, nextClassLevel).includes(nextClassLevel));
  const needsSub = Boolean(targetClass?.subclassLevel === nextClassLevel && !targetEntry?.subclassId);
  const gate = target ? canTakeClassLevel(character, target, derived.scores) : { ok: true, reason: "" };
  const owned = new Set([...character.techs, ...derived.grantedTechIds]);

  async function copyShare() {
    const payload = await encodeShare(character!);
    const url = `${window.location.origin}/sheet/#share=${encodeURIComponent(payload)}`;
    setShare(url);
    await navigator.clipboard.writeText(url).catch(() => undefined);
  }

  function setExpended(levelIndex: number, count: number) {
    const slotsExpended = character!.slotsExpended.slice();
    slotsExpended[levelIndex] = count;
    save({ ...character!, slotsExpended });
  }

  return (
    <div className="sheet-page space-y-3">
      <div className="no-print flex flex-wrap gap-2">
        <Link href={`/builder/?id=${character.id}`} className="inline-flex items-center rounded-sm border border-cyan/50 px-3 py-2 text-sm text-cyan">Edit</Link>
        <Button variant="ghost" onClick={() => window.print()}>Print / PDF</Button>
        <Button variant="ghost" onClick={() => downloadCharacter(character)}>Export JSON</Button>
        <Button variant="ghost" onClick={() => downloadAvrae(character, rules, derived)}>Export for Avrae (.xlsx)</Button>
        <Button variant="ghost" onClick={() => downloadAvraeCsv(character, rules, derived)}>CSV fallback</Button>
        <Button variant="ghost" onClick={() => { const text = characterAsText(character, derived); navigator.clipboard.writeText(text).then(() => setCopied("Copied the sheet as text and JSON.")).catch(() => setCopied(text)); }}>Copy as text</Button>
        <Button variant="ghost" onClick={() => setAvraeHelp((open) => !open)}>Avrae import help</Button>
        <Button variant="ghost" onClick={copyShare}>Copy share link</Button>
        <Button onClick={() => { setGainClass(entries[0]?.id ?? ""); setLevelOpen(true); }}>Level up</Button>
        {GOOGLE_SHEET_URL ? (
          <a className="inline-flex items-center rounded-sm border border-cyan/50 px-3 py-2 text-sm text-cyan" href={GOOGLE_SHEET_URL}>{GOOGLE_SHEET_LABEL}</a>
        ) : (
          <span className="inline-flex items-center rounded-sm border border-white/15 px-3 py-2 text-sm text-muted" title="Sheet URL not set yet">{GOOGLE_SHEET_LABEL}</span>
        )}
        <Button variant="ghost" onClick={() => save({ ...character, slotsExpended: [0, 0, 0, 0, 0, 0, 0, 0, 0], bonusSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0], sourcePointsSpent: 0 })}>Long rest</Button>
      </div>
      {share && <p className="no-print break-all text-xs text-cyan">{share}</p>}
      {copied && <pre className="no-print max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted">{copied}</pre>}
      {avraeHelp && (
        <section className="no-print neon-card space-y-2 p-4 text-sm">
          <h2 className="text-cyan">Export for Avrae / Google Sheets</h2>
          <p>A static site cannot push a character into Avrae. Download the workbook, import it into Google Sheets, share it, then import it in Discord.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Click Export for Avrae. The file has three tabs: Sheet1, Additional, and Inventory. Cell AQ4 says Avrae GSheet v2.1.</li>
            <li>In Google Sheets, choose File, then Import, then Upload, and replace the current sheet.</li>
            <li>Share the sheet as “Anyone with the link can view,” or share it with avrae-320@avrae-bot.iam.gserviceaccount.com.</li>
            <li>In Discord, run !import and paste the sheet URL. Then !char and the character name.</li>
          </ol>
          <p>The CSV is a fallback of those same three tabs. Avrae itself only reads a Google Sheet, not the CSV.</p>
          <p>Cells written for Avrae’s importer:</p>
          <ul className="list-disc pl-5 text-muted">{AVRAE_CELL_MAP.map((line) => <li key={line}>{line}</li>)}</ul>
          <p>Limitations: Neon City dollars are stored as gold pieces, because Avrae’s purse is coins. Technology is placed on the Arcana row and Culture on the Religion row. Walking speed is a feature line, not a movement cell, because the importer does not read speed. NCL feature names are written out, but Avrae only builds automation for feature names it already knows. Inventory item rows are on the Inventory tab for you; Avrae reads the coin cells, not those rows. High-end weapon bonuses are not separate damage dice.</p>
        </section>
      )}

      <article className="paper">
        <header className="paper-head">
          <label>Character name<input value={character.name} onChange={(e) => save({ ...character, name: e.target.value })} /></label>
          <label>Class & level<input readOnly value={derived.classLabels} /></label>
          <label>Lineage<input readOnly value={[rules.lineages.find((item) => item.id === character.lineageId)?.name, character.sublineage].filter(Boolean).join(" · ")} /></label>
          <label>Upbringing<input readOnly value={rules.upbringings.find((item) => item.id === character.upbringingId)?.name ?? ""} /></label>
          <label>Player name<input value={character.playerName} onChange={(e) => save({ ...character, playerName: e.target.value })} /></label>
          <label>Level<input readOnly value={character.level} /></label>
          <label>MP<input type="number" value={character.mpEarned} onChange={(e) => save({ ...character, mpEarned: Number(e.target.value) || 0 })} /></label>
          <label>Next level<input readOnly value={derived.mpToNext == null ? "—" : `${derived.mpToNext} MP · ${derived.rank}`} /></label>
        </header>

        <div className="paper-body">
          <section className="paper-col">
            {ABILITIES.map((ability) => (
              <div key={ability} className="ability">
                <b>{derived.scores[ability]}</b>
                <span>{formatMod(derived.mods[ability])}</span>
                <small>{ability}</small>
              </div>
            ))}
            <label className="row-check"><input type="checkbox" checked={character.inspiration} onChange={(e) => save({ ...character, inspiration: e.target.checked })} /> Inspiration</label>
            <p className="pb">Proficiency bonus <strong>{formatMod(derived.pb)}</strong></p>
            {derived.featAsiNotes.map((note) => <p key={note} className="fine">{note}</p>)}
            <h3>Saving throws</h3>
            <ul className="bubbles">
              {derived.saves.map((save) => (
                <li key={save.ability}><i className={save.proficient ? "on" : ""} /> {save.name} {formatMod(save.mod)}</li>
              ))}
            </ul>
            <h3>Skills</h3>
            <ul className="bubbles">
              {derived.skills.map((skill) => (
                <li key={skill.name}><i className={skill.proficient ? "on" : ""} /> {skill.name} {formatMod(skill.mod)}{skill.expertise ? " ★" : ""}{skill.disadvantage ? " (disadv.)" : ""}</li>
              ))}
            </ul>
            <p>Passive Wisdom (Perception) <strong>{derived.passivePerception}</strong></p>
          </section>

          <section className="paper-col">
            <div className="trio">
              <div><b>{derived.ac}</b><span>AC</span></div>
              <div><b>{formatMod(derived.initiative)}</b><span>Initiative</span></div>
              <div><b>{derived.speed}</b><span>Speed</span></div>
            </div>
            {derived.acNotes.length > 0 && <p className="fine">{derived.acNotes.join(" · ")}</p>}
            <p className="fine">{derived.movement}</p>
            {derived.styleNotes.map((note) => <p key={note} className="fine">{note}</p>)}
            {derived.traitNotes.map((note) => <p key={note} className="fine">{note}</p>)}
            {derived.features.some((feature) => feature.toLowerCase().includes("fighting style")) && (
              <label className="no-print">Fighting style
                <Select value={character.fightingStyles[0] ?? ""} onChange={(e) => save({ ...character, fightingStyles: e.target.value ? [e.target.value] : [], defenseStyle: e.target.value === "Defense" })}>
                  <option value="">Choose</option>
                  {[...new Set(entries.flatMap((entry) => FIGHTING_STYLES[entry.id] ?? []))].map((style) => <option key={style} value={style}>{style}</option>)}
                </Select>
              </label>
            )}
            <div className="hp-box">
              <label>HP max<strong>{derived.hp}</strong></label>
              <label>Current<input type="number" value={character.hpCurrent ?? derived.hp} onChange={(e) => save({ ...character, hpCurrent: Number(e.target.value) })} /></label>
              <label>Temp<input type="number" value={character.hpTemp} onChange={(e) => save({ ...character, hpTemp: Number(e.target.value) || 0 })} /></label>
            </div>
            <p>Hit dice <strong>{derived.hitDicePool}</strong></p>
            <div className="death">
              <span>Death saves</span>
              <label>Success {[0, 1, 2].map((n) => <input key={n} type="checkbox" checked={character.deathSuccess > n} onChange={() => save({ ...character, deathSuccess: character.deathSuccess > n ? n : n + 1 })} />)}</label>
              <label>Failure {[0, 1, 2].map((n) => <input key={n} type="checkbox" checked={character.deathFail > n} onChange={() => save({ ...character, deathFail: character.deathFail > n ? n : n + 1 })} />)}</label>
            </div>
            <h3>Attacks & notes · {derived.attackCount} per Attack action</h3>
            <table>
              <thead><tr><th>Name</th><th>Atk bonus</th><th>Damage / type</th></tr></thead>
              <tbody>
                {derived.attacks.map((attack, index) => (
                  <tr key={`${attack.name}-${index}`}><td>{attack.name}{attack.proficient ? "" : " *"}{attack.notes ? <span className="block text-[10px] normal-case tracking-normal text-muted">{attack.notes}</span> : null}</td><td>{formatMod(attack.toHit)}</td><td>{attack.damage}</td></tr>
                ))}
                {derived.attacks.length === 0 && <tr><td colSpan={3}>No weapons equipped.</td></tr>}
              </tbody>
            </table>
            <h3>Tech slots</h3>
            <ul className="slots">
              {derived.slots.map((total, index) => total > 0 && (
                <li key={ORDINALS[index]}>
                  <span>{ORDINALS[index]} · {total}</span>
                  {Array.from({ length: total }, (_, box) => (
                    <input key={box} type="checkbox" checked={box < (character.slotsExpended[index] ?? 0)} onChange={() => setExpended(index, box < (character.slotsExpended[index] ?? 0) ? box : box + 1)} />
                  ))}
                </li>
              ))}
            </ul>
            {derived.pactSlots > 0 && <p>Gifted tech: {derived.pactSlots} slot{derived.pactSlots === 1 ? "" : "s"} of level {derived.pactLevel}. These stay separate from the multiclass table and can cast either list.</p>}
            {derived.techDc != null && <p>Tech DC {derived.techDc} · attack {formatMod(derived.techAttack ?? 0)} ({derived.techAbility})</p>}
            {derived.deckMax > 0 && <p>Cyberdeck {character.techs.filter((id) => !rules.techs.find((tech) => tech.id === id)?.trick).length}/{derived.deckMax} leveled techs. Prepared {character.prepared.length}/{derived.preparedMax ?? 0}. The deck starts at 6 and gains 2 each Techwizard level. You prepare Intelligence + Techwizard level.</p>}
            {derived.sourcePoints > 0 && (
              <p className="no-print">Source points {derived.sourcePoints}. {SOURCE_SLOT_COST.slice(1).map((cost, index) => (
                <button key={cost} className="ml-1 underline" onClick={() => {
                  if (derived.sourcePoints < cost) return;
                  const bonusSlots = character.bonusSlots.slice();
                  bonusSlots[index] += 1;
                  save({ ...character, bonusSlots, sourcePointsSpent: character.sourcePointsSpent + cost });
                }}>+{ORDINALS[index]} ({cost})</button>
              ))}</p>
            )}
            <ul>
              {character.techs.map((techId) => {
                const tech = rules.techs.find((item) => item.id === techId);
                const ready = character.prepared.includes(techId);
                return (
                  <li key={techId}>
                    <Link href={`/entry/?id=${techId}`}>{tech?.name ?? techId}</Link> {tech?.trick ? "cantrip" : `level ${tech?.level}`}
                    {techText[techId]?.summary && <span className="block text-muted">{techText[techId].summary}</span>}
                    <details className="text-muted">
                      <summary className="cursor-pointer">Casting details</summary>
                      <p>{[tech?.castingTime && `Casting time: ${tech.castingTime}`, tech?.range && `Range: ${tech.range}`, tech?.components && `Components: ${tech.components}`, tech?.duration && `Duration: ${tech.duration}`].filter(Boolean).join(" · ")}</p>
                      {techText[techId]?.effect && <p className="whitespace-pre-wrap">{techText[techId].effect}</p>}
                    </details>
                    {derived.deckMax > 0 && !tech?.trick && (
                      <button type="button" className="no-print ml-2 underline" onClick={() => {
                        if (ready) save({ ...character, prepared: character.prepared.filter((id) => id !== techId) });
                        else if (character.prepared.length < (derived.preparedMax ?? 0)) save({ ...character, prepared: [...character.prepared, techId] });
                      }}>{ready ? "prepared" : "prepare"}</button>
                    )}
                  </li>
                );
              })}
              {derived.grantedTechNotes.map((note) => <li key={`${note.classId}-${note.id}`}>{note.name} · {note.source}. Always prepared, and it does not count against your picks.</li>)}
            </ul>
            {derived.bonusOffers.filter((offer) => !owned.has(offer.id)).map((offer) => (
              <p key={offer.id} className="fine">{rules.techs.find((tech) => tech.id === offer.id)?.name} is available to add. {offer.note} <button className="no-print underline" onClick={() => save({ ...character, techs: [...character.techs, offer.id] })}>Add</button></p>
            ))}
          </section>

          <section className="paper-col">
            <label>Personality traits<textarea value={character.personality} onChange={(e) => save({ ...character, personality: e.target.value })} /></label>
            <label>Ideals<textarea value={character.ideals} onChange={(e) => save({ ...character, ideals: e.target.value })} /></label>
            <label>Bonds<textarea value={character.bonds} onChange={(e) => save({ ...character, bonds: e.target.value })} /></label>
            <label>Flaws<textarea value={character.flaws} onChange={(e) => save({ ...character, flaws: e.target.value })} /></label>
            <label>Alignment<input value={character.alignment} onChange={(e) => save({ ...character, alignment: e.target.value })} /></label>
            <h3>Features</h3>
            <ul className="feature-list">
              {listedFeatures(character, rules, featureBook).map((feature) => {
                const key = `${feature.source}:${feature.level}:${feature.name}`;
                const open = openFeatures[key] ?? false;
                return (
                  <li key={key}>
                    <button type="button" className="no-print text-left" onClick={() => setOpenFeatures((prev) => ({ ...prev, [key]: !open }))}>
                      <strong>{feature.name}</strong> · {feature.source} · level {feature.level}
                    </button>
                    <p className="print-label"><strong>{feature.name}</strong> · {feature.source} · level {feature.level}</p>
                    <p className={open ? "feat-body" : "feat-body screen-collapsed"}>{feature.text}</p>
                  </li>
                );
              })}
            </ul>
            {Object.entries(derived.resources).map(([name, value]) => <p key={name} className="fine">{name}: {value}</p>)}
          </section>
        </div>

        <footer className="paper-foot">
          <div>
            <h3>Proficiencies</h3>
            <p><strong>Armor / weapons / tools.</strong> {derived.proficiencyText}</p>
            <p><strong>Other speeds.</strong> {derived.speed} ft.</p>
          </div>
          <div>
            <h3>Languages</h3>
            <TextInput value={character.languages.join(", ")} onChange={(e) => save({ ...character, languages: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
            <h3>Equipped</h3>
            <p>{rules.armor.find((item) => item.id === character.armorId)?.name ?? "No armor"}{character.shield ? ", shield" : ""} · {character.weapons.map((weapon) => rules.weapons.find((item) => item.id === weapon.id)?.name).filter(Boolean).join(", ") || "no weapons"}</p>
            <p>{creditsLabel(character.credits)} · cybernetics {character.cybernetics.length}/{derived.cyberLimit}: {character.cybernetics.map((item) => rules.cybernetics.find((cyber) => cyber.id === item.id)?.name).join(", ") || "none"}</p>
            <ul>{character.inventory.map((item, index) => <li key={index}>{item.qty}× {item.name}</li>)}</ul>
          </div>
        </footer>
      </article>
      <TechSheet
        character={character}
        rules={rules}
        derived={derived}
        onNote={(key, value) => save({ ...character, sheetNotes: { ...character.sheetNotes, [key]: value } })}
        onExpend={setExpended}
      />
      {derived.warnings.map((warning) => <p key={warning} className="text-sm text-pink">{warning}</p>)}

      {levelOpen && (
        <div className="no-print fixed inset-0 z-50 grid place-items-end bg-black/70 p-4 pb-16 sm:place-items-center sm:pb-4">
          <div className="neon-card max-h-[85vh] w-full max-w-lg space-y-3 overflow-auto p-4">
            <h2 className="brand text-xl text-pink">Level up to {character.level + 1}</h2>
            <p className="text-sm text-muted">MP will be set to the chart’s total for the new level. It does not have to be earned first. {character.level >= 4 && derived.mpToNext != null ? `Leaving level ${character.level} is listed as ${derived.mpToNext} MP.` : "Levels 1–4 are not on the MP chart."}</p>
            <Select value={target} onChange={(e) => { setGainClass(e.target.value); setPendingSubclass(""); }}>
              {entries.map((entry) => <option key={entry.id} value={entry.id}>Another level of {findClass(rules, entry.id)?.name} ({entry.level})</option>)}
              {rules.classes.filter((item) => !entries.some((entry) => entry.id === item.id)).map((item) => {
                const check = canTakeClassLevel(character, item.id, derived.scores);
                return <option key={item.id} value={item.id} disabled={!check.ok}>{item.name}{check.ok ? "" : ` — ${check.reason}`}</option>;
              })}
            </Select>
            {!gate.ok && <p className="text-sm text-pink">{gate.reason}</p>}
            {needsSub && targetClass && (
              <Select value={pendingSubclass} onChange={(e) => setPendingSubclass(e.target.value)}>
                <option value="">Choose a subclass</option>
                {rules.subclasses.filter((item) => item.classId === targetClass.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            )}
            {targetClass && classNeedsFightingStyle(targetClass, nextClassLevel) && character.fightingStyles.length === 0 && (
              <Select value={pendingStyle} onChange={(e) => setPendingStyle(e.target.value)}>
                <option value="">Choose a fighting style</option>
                {(FIGHTING_STYLES[targetClass.id] ?? []).map((style) => <option key={style} value={style}>{style}</option>)}
              </Select>
            )}
            {needsAsi && (
              <>
                <p className="text-sm">This class level includes an ability score improvement. One score +2, or two scores +1, and the total stops at 20 before cybernetics.</p>
                {!pendingFeat && <AsiPicker mode="flex" value={pendingAsi} onChange={(next) => { setPendingAsi(next); setPendingFeat(""); }} />}
                <Select value={pendingFeat} onChange={(e) => { setPendingFeat(e.target.value); setPendingFeatAbility(""); setPendingAsi({}); }}>
                  <option value="">Or take a feat</option>
                  {rules.feats.map((feat) => <option key={feat.id} value={feat.id}>{feat.name}</option>)}
                </Select>
                {pendingFeat && featAsi[pendingFeat] && (
                  <div className="flex flex-wrap gap-2">
                    {featAsi[pendingFeat].choices.map((ability) => (
                      <button key={ability} type="button" className={`border px-2 py-1 text-xs ${pendingFeatAbility === ability ? "border-pink text-pink" : "border-white/20"}`} onClick={() => setPendingFeatAbility(ability)}>{ABILITY_NAME[ability]} +{featAsi[pendingFeat].amount}</button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2">
              <Button disabled={!gate.ok || (needsSub && !pendingSubclass) || (needsAsi && !pendingFeat && !asiAssignmentOk("flex", pendingAsi)) || (Boolean(targetClass && classNeedsFightingStyle(targetClass, nextClassLevel) && character.fightingStyles.length === 0 && !pendingStyle))} onClick={() => {
                let next = applyLevelUp(character, rules, target, pendingSubclass || null);
                if (needsAsi) {
                  next = {
                    ...next,
                    asiPicks: [...next.asiPicks, pendingFeat
                      ? { level: nextClassLevel, classId: target, mode: "feat" as const, featId: pendingFeat, abilities: pendingFeatAbility && featAsi[pendingFeat] ? { [pendingFeatAbility]: featAsi[pendingFeat].amount } : featAsi[pendingFeat]?.choices.length === 1 ? { [featAsi[pendingFeat].choices[0]]: featAsi[pendingFeat].amount } : {} }
                      : { level: nextClassLevel, classId: target, mode: "asi" as const, abilities: pendingAsi }],
                  };
                }
                if (pendingStyle) next = { ...next, fightingStyles: [pendingStyle], defenseStyle: pendingStyle === "Defense" };
                save(next);
                setLevelOpen(false);
                setPendingAsi({});
                setPendingFeat("");
              }}>Confirm</Button>
              <Button variant="ghost" onClick={() => setLevelOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SheetPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading sheet…</p>}>
      <SheetInner />
    </Suspense>
  );
}
