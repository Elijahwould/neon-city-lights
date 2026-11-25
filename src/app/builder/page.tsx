"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Markdown } from "@/components/markdown";
import { Button, Chip, Field, Select, TextInput } from "@/components/ui";
import { ChoiceCard, FactList, HeritageField } from "@/components/choice";
import { ABILITIES, ABILITY_NAME, type Ability, type CatalogEntry, type Character, type ClassDef, type Rules } from "@/lib/types";
import { loadCatalog, loadEntry, loadRules } from "@/lib/data";
import { getCharacter, upsertCharacter } from "@/lib/storage";
import {
  asiLevels,
  blankCharacter,
  classEntries,
  creditsLabel,
  derive,
  findClass,
  findSubclass,
  lineageGrantsFeat,
  normalizeCharacter,
  pointBuySpent,
  rankFor,
  rollAbilityScores,
  skillKey,
  standardScores,
  techListFor,
} from "@/lib/character";
import {
  SKILL_BLURB,
  carryCapacity,
  extraLineageSkills,
  featBlocked,
  GEAR_FILTERS,
  applyItemStats,
  gearCatalog,
  gearSummary,
  packPieces,
  skillPickBudget,
  sortGear,
  starterKit,
  type ItemStat,
  startingMoney,
  xpForLevel,
} from "@/lib/creation";

const STEPS = ["Identity", "Lineage", "Upbringing", "Class", "Scores", "Skills", "Subclass", "Techs", "Feats", "Gear", "Review"];

function classFacts(cls: ClassDef) {
  const skills = cls.skillOptions[0] === "*"
    ? `Choose any ${cls.skillCount}.`
    : `Choose ${cls.skillCount} from ${cls.skillOptions.join(", ")}.`;
  return [
    { label: "Hit die", text: cls.hitDie ? `d${cls.hitDie}` : "The wiki does not state a hit die." },
    { label: "Primary abilities", text: cls.primary ? `${cls.primary}. The wiki states these as the multiclass minimum.` : "The wiki does not name primary abilities." },
    { label: "Saves", text: cls.saves.map((ability) => ABILITY_NAME[ability]).join(", ") || "None listed." },
    { label: "Armor", text: cls.armor || "None." },
    { label: "Weapons", text: cls.weapons || "None." },
    { label: "Tools", text: cls.tools || "None." },
    { label: "Skills", text: skills },
    { label: "Techcasting", text: cls.techAbility ? `${ABILITY_NAME[cls.techAbility]}, ${cls.caster}.` : "None." },
    ...(cls.level1 ?? []).map((row) => ({ label: row.name, text: row.line || "See the full class text." })),
  ];
}

function Reveal({ text, id, cache, setCache }: { text: string; id: string; cache: Record<string, string>; setCache: (id: string, md: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && !cache[id]) loadEntry(id).then((entry) => setCache(id, entry.markdown)).catch(() => setCache(id, "_Could not load this page._"));
  }, [open, id, cache, setCache]);
  return (
    <div className="mt-1">
      <p className="text-sm text-muted">{text}</p>
      <button type="button" className="text-xs text-cyan" onClick={() => setOpen((value) => !value)}>{open ? "Hide full text" : "Full details"}</button>
      {open && <div className="mt-2 max-h-64 overflow-auto border border-white/10 p-2 text-sm">{cache[id] ? <Markdown source={cache[id]} /> : <p>Loading…</p>}</div>}
    </div>
  );
}

type IdeaBook = Record<string, { traits: string[]; ideals: { text: string; tag?: string }[]; bonds: string[]; flaws: string[] }>;

function BuilderInner() {
  const router = useRouter();
  const editId = useSearchParams().get("id");
  const [rules, setRules] = useState<Rules | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [feats, setFeats] = useState<{ id: string; prerequisite: string | null }[]>([]);
  const [cache, setCacheState] = useState<Record<string, string>>({});
  const [character, setCharacter] = useState<Character | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gearQuery, setGearQuery] = useState("");
  const [gearCat, setGearCat] = useState("all");
  const [gearSort, setGearSort] = useState<"rarity" | "name" | "price">("rarity");
  const [featQuery, setFeatQuery] = useState("");
  const [openGear, setOpenGear] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<IdeaBook>({});
  const [itemStats, setItemStats] = useState<Record<string, ItemStat>>({});
  const [featAsi, setFeatAsi] = useState<Record<string, { amount: number; choices: Ability[] }>>({});

  useEffect(() => {
    loadRules().then(setRules).catch((err: Error) => setError(err.message));
    loadCatalog().then(setCatalog).catch(() => undefined);
    fetch("/data/feat-meta.json").then((res) => res.json()).then(setFeats).catch(() => undefined);
    fetch("/data/upbringing-ideas.json").then((res) => res.json()).then(setIdeas).catch(() => undefined);
    fetch("/data/item-details.json").then((res) => res.json()).then(setItemStats).catch(() => undefined);
    fetch("/data/feat-asi.json").then((res) => res.json()).then(setFeatAsi).catch(() => undefined);
    if (editId) {
      const found = getCharacter(editId);
      if (found) {
        setCharacter(normalizeCharacter(found));
        return;
      }
    }
    const draft = sessionStorage.getItem("ncl.draft");
    if (draft) {
      try { setCharacter(normalizeCharacter(JSON.parse(draft) as Character)); return; } catch { /* fresh */ }
    }
    setCharacter(blankCharacter());
  }, [editId]);
  useEffect(() => { if (character) sessionStorage.setItem("ncl.draft", JSON.stringify(character)); }, [character]);

  const setCache = (id: string, md: string) => setCacheState((prev) => ({ ...prev, [id]: md }));
  const derived = useMemo(() => (rules && character ? derive(character, rules) : null), [rules, character]);
  if (error) return <p className="text-pink">{error}</p>;
  if (!rules || !character || !derived) return <p className="text-muted">Warming up the builder…</p>;

  const patch = (partial: Partial<Character>) => setCharacter({ ...character, ...partial });
  const summary = (id: string) => catalog.find((entry) => entry.id === id)?.summary ?? "";
  const entries = classEntries(character);
  const money = startingMoney(character.level);
  const catalogRows = sortGear(applyItemStats(gearCatalog(rules, catalog), itemStats), gearSort);
  const unpriced = catalogRows.filter((row) => row.cost == null).length;
  const undescribed = catalogRows.filter((row) => !row.description && !row.effect && !row.detail).length;
  const visible = STEPS.filter((name) => {
    if (name === "Subclass") return entries.some((entry) => { const cls = findClass(rules, entry.id); return cls?.subclassLevel && entry.level >= cls.subclassLevel; });
    if (name === "Techs") return derived.tricksMax > 0 || derived.slots.some((n) => n > 0);
    return true;
  });
  const current = visible[Math.min(step, visible.length - 1)];
  const upbringing = rules.upbringings.find((item) => item.id === character.upbringingId);
  const granted = new Set((upbringing?.skills ?? []).map(skillKey));
  const budget = skillPickBudget(character, rules);
  const chosen = character.skillProfs.filter((skill) => !granted.has(skillKey(skill)));
  const spent = catalogRows.reduce((sum, row) => {
    if (row.id === character.armorId) return sum + (row.cost ?? 0);
    if (character.weapons.some((item) => item.id === row.id)) return sum + (row.cost ?? 0);
    if (character.cybernetics.some((item) => item.id === row.id)) return sum + (row.cost ?? 0);
    if (character.inventory.some((item) => skillKey(item.name) === skillKey(row.name))) return sum + (row.cost ?? 0);
    return sum;
  }, 0);
  const weight = catalogRows.reduce((sum, row) => {
    const owned = row.id === character.armorId || character.weapons.some((item) => item.id === row.id) || character.inventory.some((item) => skillKey(item.name) === skillKey(row.name));
    return owned ? sum + row.weight : sum;
  }, 0);

  const draft = character;
  const book = rules;
  function setLevel(level: number) {
    const next = Math.min(20, Math.max(1, level));
    const pay = startingMoney(next);
    const mp = next >= 5 ? rankFor(book, next)?.totalMp ?? 0 : 0;
    const levels = entries.length ? entries.map((entry, index) => index === 0 ? { ...entry, level: Math.max(1, next - entries.slice(1).reduce((sum, item) => sum + item.level, 0)) } : entry) : draft.classId ? [{ id: draft.classId, level: next, subclassId: draft.subclassId }] : [];
    patch({ level: next, credits: pay.credits, xp: xpForLevel(next), mpEarned: mp, classLevels: levels });
  }

  function save() {
    const saved: Character = {
      ...draft,
      credits: editId ? draft.credits : money.credits,
      xp: editId ? draft.xp : xpForLevel(draft.level),
      mpEarned: editId ? draft.mpEarned : (draft.level >= 5 ? rankFor(book, draft.level)?.totalMp ?? 0 : 0),
      classLevels: entries,
      classId: entries[0]?.id ?? draft.classId,
      subclassId: entries[0]?.subclassId ?? null,
    };
    upsertCharacter(saved);
    sessionStorage.removeItem("ncl.draft");
    router.push(`/sheet/?id=${saved.id}`);
  }

  function addStory(field: "personality" | "ideals" | "bonds" | "flaws", line: string) {
    const current = draft[field];
    if (current.split("\n").includes(line)) return;
    patch({ [field]: current ? `${current}\n${line}` : line });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="brand text-3xl text-pink">{editId ? "Edit runner" : "Character builder"}</h1>
        {editId && <p className="text-sm text-cyan">Saving updates this runner. It does not create a second copy.</p>}
        <p className="text-sm text-muted">Step {Math.min(step, visible.length - 1) + 1} of {visible.length} · {current} · level {character.level}</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {visible.map((name, index) => <button key={name} className={`shrink-0 text-xs uppercase tracking-wider ${index === Math.min(step, visible.length - 1) ? "text-cyan" : "text-muted"}`} onClick={() => setStep(index)}>{name}</button>)}
      </div>
      <section className="neon-card space-y-4 p-4">
        {current === "Identity" && (
          <>
            <Field label="Name"><TextInput value={character.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
            <Field label="Pronouns"><TextInput value={character.pronouns} onChange={(e) => patch({ pronouns: e.target.value })} /></Field>
            <Field label="Concept"><TextInput value={character.concept} onChange={(e) => patch({ concept: e.target.value })} /></Field>
            <Field label="Starting level (1–20)"><TextInput type="number" min={1} max={20} value={character.level} onChange={(e) => setLevel(Number(e.target.value) || 1)} /></Field>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 10, 15, 20].map((level) => (
                <Chip key={level} active={character.level === level} onClick={() => setLevel(level)}>
                  Lv {level} · {creditsLabel(startingMoney(level).credits)}
                </Chip>
              ))}
            </div>
            <p className="text-sm">Starting money <strong className="text-cyan">{creditsLabel(money.credits)}</strong>. {money.note}</p>
            <p className="text-sm text-muted">{character.level < 5 ? `No wiki MP for levels 1–4. Using the 5e XP threshold instead: ${xpForLevel(character.level).toLocaleString()} XP.` : `Milestone points set to the wiki total for level ${character.level}: ${rankFor(rules, character.level)?.totalMp ?? 0} MP.`}</p>
          </>
        )}
        {current === "Lineage" && rules.lineages.map((item) => {
          const selected = character.lineageId === item.id;
          const sizeFromHeritage = item.sublineages.some((sub) => sub.traits.some((trait) => trait.name === "Size"));
          return (
            <ChoiceCard key={item.id} choiceId={item.id} title={item.name} selected={selected} onSelect={() => {
              if (selected) return;
              patch({ lineageId: item.id, sublineage: null, lineageAsi: {}, subAsi: {}, lineageOption: null });
            }}>
              <FactList rows={[
                { label: "Ability score increase", text: item.asiText ?? "The wiki does not state an ability score increase." },
                { label: "Size", text: item.size ?? (sizeFromHeritage ? "Set by the heritage." : "The wiki does not state a size.") },
                { label: "Speed", text: item.speedText ?? (item.speed ? `${item.speed} feet.` : "The wiki does not state a speed.") },
                { label: "Languages", text: item.languages ?? "The wiki does not grant a language." },
                ...item.traits.map((trait) => ({ label: trait.name, text: trait.line })),
              ]} />
              <Reveal id={item.id} text="Full wiki text, including naming notes." cache={cache} setCache={setCache} />
              {selected && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-cyan">Assign the ability score increase.</p>
                  <div className="flex flex-wrap gap-2">
                    {ABILITIES.map((ability) => <Chip key={ability} active={(character.lineageAsi[ability] ?? 0) > 0} onClick={() => patch({ lineageAsi: { ...character.lineageAsi, [ability]: character.lineageAsi[ability] ? 0 : item.asi === "plus1plus1" ? 1 : 2 } })}>{ABILITY_NAME[ability]}</Chip>)}
                  </div>
                  {item.id === "race:new-human" && (
                    <Field label="Ancestral Diversity">
                      <Select value={character.lineageOption ?? ""} onChange={(e) => patch({ lineageOption: e.target.value || null })}>
                        <option value="">Choose</option>
                        <option>Specialized Predisposition</option>
                        <option>Natural Biodiversity</option>
                        <option>Hyper Adaptability</option>
                      </Select>
                    </Field>
                  )}
                  <HeritageField
                    required={item.id === "race:jerboan"}
                    heritages={item.sublineages}
                    value={character.sublineage}
                    subAsi={character.subAsi}
                    onChange={(name) => patch({ sublineage: name, subAsi: {} })}
                    onAsi={(ability, amount) => patch({ subAsi: { [ability]: amount } })}
                  />
                </div>
              )}
            </ChoiceCard>
          );
        })}
        {current === "Upbringing" && rules.upbringings.map((item) => (
          <ChoiceCard key={item.id} choiceId={item.id} title={item.name} selected={character.upbringingId === item.id} onSelect={() => {
            if (character.upbringingId === item.id) return;
            patch({ upbringingId: item.id, toolProfs: item.tools.filter((tool) => tool.toLowerCase() !== "none") });
          }}>
            <FactList rows={[
              { label: "Skills", text: item.skills.join(", ") || "None listed." },
              { label: "Tools", text: item.tools.join(", ") || "None." },
              { label: "Languages", text: item.languages || "The wiki does not grant a language." },
              { label: "Weapons", text: item.weapons || "" },
              { label: "Equipment", text: item.equipment || "None listed." },
              { label: "Credchip", text: item.credits ? creditsLabel(item.credits) : "No credchip on this upbringing." },
              { label: item.feature ? `Feature: ${item.feature}` : "Feature", text: item.featureLine || "The wiki does not describe a feature." },
            ]} />
            <Reveal id={item.id} text="Full wiki text." cache={cache} setCache={setCache} />
            {character.upbringingId === item.id && ideas[item.id] && (
              <div className="mt-3 space-y-2 text-sm" onClick={(event) => event.stopPropagation()}>
                <p className="text-cyan">Suggestions, written for this upbringing. Click one to fill the sheet, or type your own.</p>
                {(["traits", "bonds", "flaws"] as const).map((key) => (
                  <div key={key}>
                    <p className="text-xs uppercase tracking-wider text-muted">{key === "traits" ? "Personality traits" : key}</p>
                    <div className="flex flex-wrap gap-2">
                      {(ideas[item.id][key] as string[]).map((line) => (
                        <button type="button" key={line} className="border border-white/15 px-2 py-1 text-left text-xs" onClick={() => addStory(key === "traits" ? "personality" : key, line)}>{line}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Ideals</p>
                  <div className="flex flex-wrap gap-2">
                    {ideas[item.id].ideals.map((line) => (
                      <button type="button" key={line.text} className="border border-white/15 px-2 py-1 text-left text-xs" onClick={() => addStory("ideals", line.tag ? `${line.text} (${line.tag})` : line.text)}>
                        {line.tag && <span className="text-pink">{line.tag}. </span>}{line.text}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">Personality<textarea className="mt-1 w-full border border-white/15 bg-black/40 p-2" value={character.personality} onChange={(e) => patch({ personality: e.target.value })} /></label>
                <label className="block">Ideals<textarea className="mt-1 w-full border border-white/15 bg-black/40 p-2" value={character.ideals} onChange={(e) => patch({ ideals: e.target.value })} /></label>
                <label className="block">Bonds<textarea className="mt-1 w-full border border-white/15 bg-black/40 p-2" value={character.bonds} onChange={(e) => patch({ bonds: e.target.value })} /></label>
                <label className="block">Flaws<textarea className="mt-1 w-full border border-white/15 bg-black/40 p-2" value={character.flaws} onChange={(e) => patch({ flaws: e.target.value })} /></label>
              </div>
            )}
          </ChoiceCard>
        ))}
        {current === "Class" && (
          <>
            <p className="text-sm text-muted">Put all {character.level} levels in one class, or split them. The first class listed takes the level-1 hit die.</p>
            {rules.classes.map((item) => {
              const selected = entries.some((entry) => entry.id === item.id);
              return (
                <ChoiceCard key={item.id} choiceId={item.id} title={item.name} selected={selected} onSelect={() => {
                  if (selected) return;
                  patch({ classId: item.id, classLevels: [{ id: item.id, level: character.level, subclassId: null }] });
                }}>
                  {selected && <TextInput className="mt-2 w-24" type="number" min={1} max={character.level} aria-label={`${item.name} levels`} value={entries.find((entry) => entry.id === item.id)?.level ?? 1} onChange={(e) => {
                    const level = Number(e.target.value) || 1;
                    patch({ classLevels: entries.map((entry) => entry.id === item.id ? { ...entry, level } : entry) });
                  }} />}
                  <FactList rows={classFacts(item)} />
                  <Reveal id={item.id} text="Full wiki text." cache={cache} setCache={setCache} />
                </ChoiceCard>
              );
            })}
            <Field label="Add a second class">
              <Select value="" onChange={(e) => e.target.value && patch({ classLevels: [...entries.filter((entry) => entry.id !== e.target.value), { id: e.target.value, level: 1, subclassId: null }] })}>
                <option value="">Choose…</option>
                {rules.classes.filter((item) => !entries.some((entry) => entry.id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <p className={entries.reduce((sum, entry) => sum + entry.level, 0) === character.level ? "text-cyan" : "text-pink"}>Assigned {entries.reduce((sum, entry) => sum + entry.level, 0)} / {character.level}</p>
          </>
        )}
        {current === "Scores" && (
          <>
            <div className="flex flex-wrap gap-2">
              {(["standard", "pointbuy", "roll"] as const).map((method) => (
                <Chip key={method} active={character.scoreMethod === method} onClick={() => patch({ scoreMethod: method, baseScores: method === "standard" ? standardScores() : { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } })}>{method === "roll" ? "Roll 4d6 drop lowest" : method === "pointbuy" ? "27-point buy" : "Standard array"}</Chip>
              ))}
            </div>
            {character.scoreMethod === "pointbuy" && <p>Points left: {rules.pointBuy.budget - pointBuySpent(character.baseScores, rules)}</p>}
            {character.scoreMethod === "roll" && <Button variant="ghost" onClick={() => { const rolledScores = rollAbilityScores(); patch({ rolledScores, baseScores: { str: rolledScores[0], dex: rolledScores[1], con: rolledScores[2], int: rolledScores[3], wis: rolledScores[4], cha: rolledScores[5] } }); }}>Roll six scores</Button>}
            {character.rolledScores.length > 0 && character.scoreMethod === "roll" && <p className="text-cyan">Pool: {character.rolledScores.join(", ")}</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ABILITIES.map((ability) => (
                <Field key={ability} label={`${ABILITY_NAME[ability]} ${derived.mods[ability] >= 0 ? "+" : ""}${derived.mods[ability]}`}>
                  <TextInput type="number" min={character.scoreMethod === "roll" ? 3 : 8} max={character.scoreMethod === "roll" ? 18 : 15} value={character.baseScores[ability]} onChange={(e) => patch({ baseScores: { ...character.baseScores, [ability]: Number(e.target.value) || 8 } })} />
                </Field>
              ))}
            </div>
          </>
        )}
        {current === "Skills" && (
          <>
            <p className="text-sm">Picks left: {Math.max(0, budget - chosen.length)}. Filled dots are from upbringing{extraLineageSkills(character.lineageId, character.sublineage) ? " or lineage" : ""} and do not spend a pick.</p>
            <ul className="space-y-2">
              {rules.skills.map((skill) => {
                const key = skillKey(skill.id);
                const fromGrant = granted.has(key);
                const on = fromGrant || character.skillProfs.some((name) => skillKey(name) === key);
                return (
                  <li key={skill.id}>
                    <label data-choice={skill.id} className={`flex cursor-pointer items-start gap-3 border p-3 ${on ? "border-pink bg-pink/10" : "border-white/10"}`}>
                      <input className="mt-1 h-5 w-5" type="checkbox" checked={on} disabled={fromGrant} onChange={() => {
                        if (fromGrant) return;
                        const has = character.skillProfs.some((name) => skillKey(name) === key);
                        if (has) patch({ skillProfs: character.skillProfs.filter((name) => skillKey(name) !== key) });
                        else if (chosen.length < budget) patch({ skillProfs: [...character.skillProfs, skill.name] });
                      }} />
                      <span>
                        <strong>{skill.name}</strong> <span className="text-xs uppercase text-cyan">{skill.ability}</span>
                        {fromGrant && <span className="text-xs text-pink"> · granted</span>}
                        <span className="block text-sm text-muted">{SKILL_BLURB[skill.id] ?? ""}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {current === "Subclass" && entries.map((entry) => {
          const cls = findClass(rules, entry.id);
          if (!cls?.subclassLevel || entry.level < cls.subclassLevel) return null;
          return (
            <div key={entry.id}>
              <h2 className="text-cyan">{cls.name} at level {cls.subclassLevel}</h2>
              {rules.subclasses.filter((item) => item.classId === cls.id).map((item) => (
                <ChoiceCard key={item.id} choiceId={item.id} title={item.name} selected={entry.subclassId === item.id} onSelect={() => {
                  if (entry.subclassId === item.id) return;
                  patch({ classLevels: entries.map((row) => row.id === entry.id ? { ...row, subclassId: item.id } : row), subclassId: entries[0]?.id === entry.id ? item.id : character.subclassId });
                }}>
                  <p className="mt-2 text-sm text-muted">{item.blurb || summary(item.id) || "The wiki page has no short summary."}</p>
                  <Reveal id={item.id} text="Full wiki text." cache={cache} setCache={setCache} />
                </ChoiceCard>
              ))}
            </div>
          );
        })}
        {current === "Techs" && (
          <div className="max-h-[28rem] space-y-1 overflow-auto">
            <p className="text-sm text-muted">Tricks {character.techs.filter((id) => rules.techs.find((tech) => tech.id === id)?.trick).length}/{derived.tricksMax}. Slots {derived.slots.map((n, i) => n ? `${i + 1}:${n}` : "").filter(Boolean).join(" ") || "none"}.</p>
            {entries.flatMap((entry) => techListFor(rules, findClass(rules, entry.id), findSubclass(rules, entry.subclassId))).filter((tech, index, list) => list.findIndex((item) => item.id === tech.id) === index).map((tech) => (
              <button type="button" key={tech.id} className={`block min-h-11 w-full border px-3 py-2 text-left text-sm ${character.techs.includes(tech.id) ? "border-cyan text-cyan" : "border-white/10"}`} onClick={() => patch({ techs: character.techs.includes(tech.id) ? character.techs.filter((id) => id !== tech.id) : [...character.techs, tech.id] })}>
                {tech.name} · {tech.trick ? "trick" : `level ${tech.level}`} · {tech.sector}
              </button>
            ))}
          </div>
        )}
        {current === "Feats" && (
          <>
            {entries.flatMap((entry) => {
              const cls = findClass(rules, entry.id);
              return (cls ? asiLevels(cls, entry.level) : []).map((lv) => (
                <div key={`${entry.id}-${lv}`} className="border border-white/10 p-2">
                  <p className="text-cyan">{findClass(rules, entry.id)?.name} level {lv}</p>
                  <div className="flex gap-2">
                    {ABILITIES.map((ability) => <Chip key={ability} active={character.asiPicks.find((pick) => pick.level === lv && pick.classId === entry.id)?.mode === "asi" && (character.asiPicks.find((pick) => pick.level === lv && pick.classId === entry.id)?.abilities?.[ability] ?? 0) > 0} onClick={() => patch({ asiPicks: [...character.asiPicks.filter((pick) => !(pick.level === lv && pick.classId === entry.id)), { level: lv, classId: entry.id, mode: "asi", abilities: { [ability]: 2 } }] })}>+2 {ABILITY_NAME[ability]}</Chip>)}
                    <Chip active={character.asiPicks.find((pick) => pick.level === lv && pick.classId === entry.id)?.mode === "feat"} onClick={() => patch({ asiPicks: [...character.asiPicks.filter((pick) => !(pick.level === lv && pick.classId === entry.id)), { level: lv, classId: entry.id, mode: "feat" }] })}>Feat</Chip>
                  </div>
                </div>
              ));
            })}
            {lineageGrantsFeat(character.lineageId, character.lineageOption, rules.lineages.find((item) => item.id === character.lineageId)?.bonusFeat ?? false) && <p className="text-sm text-cyan">This lineage grants a feat. Pick it from the list.</p>}
            <TextInput value={featQuery} onChange={(e) => setFeatQuery(e.target.value)} placeholder="Search feats" />
            <ul className="max-h-[28rem] space-y-2 overflow-auto">
              {rules.feats.filter((feat) => feat.name.toLowerCase().includes(featQuery.toLowerCase())).map((feat) => {
                const meta = feats.find((item) => item.id === feat.id);
                const block = featBlocked(meta?.prerequisite ?? null, character, derived.scores, derived.slots.some((n) => n > 0) || derived.tricksMax > 0, `${entries.map((entry) => findClass(rules, entry.id)?.armor).join(" ")} ${entries.map((entry) => findClass(rules, entry.id)?.weapons).join(" ")}`.toLowerCase());
                const picked = character.asiPicks.some((pick) => pick.featId === feat.id);
                return (
                  <li key={feat.id}>
                    <ChoiceCard choiceId={feat.id} title={feat.name} selected={picked} disabled={Boolean(block)} onSelect={() => {
                      if (block || picked) return;
                      const grant = featAsi[feat.id];
                      const abilities = grant?.choices.length === 1 ? { [grant.choices[0]]: grant.amount } : {};
                      const open = character.asiPicks.find((pick) => pick.mode === "feat" && !pick.featId);
                      const next = { ...(open ?? { level: 0, mode: "feat" as const }), featId: feat.id, abilities };
                      if (open) patch({ asiPicks: character.asiPicks.map((pick) => pick === open ? next : pick) });
                      else patch({ asiPicks: [...character.asiPicks, next] });
                    }}>
                      {meta?.prerequisite && <p className="mt-2 text-xs text-pink">{meta.prerequisite}{block ? ` — ${block}` : ""}</p>}
                      <Reveal id={feat.id} text={summary(feat.id)} cache={cache} setCache={setCache} />
                      {picked && featAsi[feat.id] && (
                        <div className="mt-2">
                          <p className="text-xs text-cyan">+{featAsi[feat.id].amount}, maximum 20 before cybernetics. {featAsi[feat.id].choices.length === 1 ? "Applied to the only listed score." : "Pick the score."}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {featAsi[feat.id].choices.map((ability) => {
                              const pick = character.asiPicks.find((item) => item.featId === feat.id);
                              return <Chip key={ability} active={(pick?.abilities?.[ability] ?? 0) > 0} onClick={() => patch({ asiPicks: character.asiPicks.map((item) => item.featId === feat.id ? { ...item, abilities: { [ability]: featAsi[feat.id].amount } } : item) })}>{ABILITY_NAME[ability]} +{featAsi[feat.id].amount}</Chip>;
                            })}
                          </div>
                        </div>
                      )}
                    </ChoiceCard>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {current === "Gear" && (
          <>
            <p>Budget {creditsLabel(money.credits)} · spent {creditsLabel(spent)} · left {creditsLabel(money.credits - spent)}</p>
            <p className="text-sm text-muted">Carry {weight} / {carryCapacity(derived.scores.str)} lb (Strength × 15, the 5e rule; the wiki does not restate carry capacity). {character.level <= 2 ? "Levels 1–2 stay on a starter kit. Money is tight." : ""}</p>
            {entries[0] && findClass(rules, entries[0].id) && (() => {
              const cls = findClass(rules, entries[0].id)!;
              const kit = starterKit(cls, rules);
              const enriched = kit.items.map((item) => catalogRows.find((row) => row.id === item.id) ?? item);
              return (
                <div className="border border-white/10 p-3 text-sm">
                  <Button variant="ghost" onClick={() => {
                    const weapon = enriched.find((item) => item.category === "weapons" || item.category === "grenades");
                    const armor = enriched.find((item) => item.category === "armor");
                    const note = kit.fromWiki ? "From the class’s starting equipment" : "Suggested kit — the class page did not name this item";
                    const inventory = character.inventory.map((item) => ({ ...item }));
                    const lines = enriched.flatMap((item) => {
                      if (item.contents.length) return packPieces(item.contents).map((piece) => ({ name: piece.name, qty: piece.qty, notes: `${note}; from ${item.name}` }));
                      if (["weapons", "grenades", "armor", "shields", "cybernetics"].includes(item.category)) return [];
                      return [{ name: item.name, qty: 1, notes: note }];
                    });
                    for (const line of lines) {
                      const found = inventory.find((item) => skillKey(item.name) === skillKey(line.name));
                      if (found) found.qty += line.qty;
                      else inventory.push(line);
                    }
                    patch({ weapons: weapon ? [{ id: weapon.id }] : [], armorId: armor?.id ?? null, inventory });
                  }}>Add {cls.name} starter kit</Button>
                  <p className="mt-2 text-muted">{kit.fromWiki ? "Named on the class’s starting equipment." : "Suggested kit. The class page did not name these exact items."}</p>
                  <ul className="mt-2 space-y-2">
                    {enriched.map((item) => (
                      <li key={item.id}>
                        <strong>{item.name}</strong>
                        {item.contents.length > 0 && (
                          <ul className="ml-4 list-disc text-muted">{item.contents.map((line) => <li key={line}>{line}</li>)}</ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
            <TextInput value={gearQuery} onChange={(e) => setGearQuery(e.target.value)} placeholder="Search gear" />
            <div className="flex flex-wrap gap-2">
              {GEAR_FILTERS.map((cat) => <Chip key={cat} active={gearCat === cat} onClick={() => setGearCat(cat)}>{cat}</Chip>)}
            </div>
            <div className="flex flex-wrap gap-2">
              {([["rarity", "rarity then price"], ["name", "name"], ["price", "price"]] as const).map(([mode, label]) => <Chip key={mode} active={gearSort === mode} onClick={() => setGearSort(mode)}>{label}</Chip>)}
            </div>
            <p className="text-xs text-muted">{catalogRows.filter((row) => (gearCat === "all" || (gearCat === "high-end" ? row.highEnd : row.category === gearCat)) && row.name.toLowerCase().includes(gearQuery.toLowerCase())).length} shown · {catalogRows.length} items. {unpriced} have no wiki price. {undescribed} have no wiki description. The wiki has no separate services price list.</p>
            <ul className="max-h-[32rem] space-y-2 overflow-auto">
              {catalogRows.filter((row) => (gearCat === "all" || (gearCat === "high-end" ? row.highEnd : row.category === gearCat)) && row.name.toLowerCase().includes(gearQuery.toLowerCase())).map((row) => (
                <li key={row.id} className="border border-white/10 p-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="min-h-11 text-left" onClick={() => setOpenGear(openGear === row.id ? null : row.id)}>
                      <strong>{row.name}</strong>
                      <span className="block text-muted">{gearSummary(row)}{row.weight ? ` · ${row.weight} lb` : ""}</span>
                    </button>
                    <Button variant="ghost" className="min-h-11 min-w-16" onClick={() => {
                      if (row.contents.length) {
                        const inventory = character.inventory.map((item) => ({ ...item }));
                        for (const piece of packPieces(row.contents)) {
                          const found = inventory.find((item) => skillKey(item.name) === skillKey(piece.name));
                          if (found) found.qty += piece.qty;
                          else inventory.push({ name: piece.name, qty: piece.qty, notes: `From ${row.name}` });
                        }
                        patch({ inventory });
                        return;
                      }
                      if (row.category === "armor") patch({ armorId: row.id });
                      else if (row.category === "shields") patch({ shield: true });
                      else if (row.category === "weapons" || row.category === "grenades") patch({ weapons: [...character.weapons, { id: row.id }] });
                      else if (row.category === "cybernetics") patch({ cybernetics: [...character.cybernetics, { id: row.id }] });
                      else patch({ inventory: [...character.inventory, { name: row.name, qty: 1, notes: "" }] });
                    }}>{row.contents.length ? "Add pack" : "Add"}</Button>
                  </div>
                  {openGear === row.id && (
                    <div className="mt-1 text-muted">
                      <p>{row.detail || row.effect || "Description not listed in wiki."}</p>
                      {row.contents.length > 0 && <ul className="ml-4 mt-1 list-disc">{row.contents.map((line) => <li key={line}>{line}</li>)}</ul>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {current === "Review" && (
          <div className="space-y-2 text-sm">
            <p className="text-lg">{character.name || "Unnamed"} · level {character.level} · {derived.classLabels}</p>
            <p>HP {derived.hp} (minimum 1 per level) · AC {derived.ac} · proficiency {derived.pb >= 0 ? `+${derived.pb}` : derived.pb}</p>
            <p>{character.level < 5 ? `XP ${xpForLevel(character.level).toLocaleString()} (5e threshold; the wiki chart starts at level 5).` : `MP ${rankFor(rules, character.level)?.totalMp ?? 0} (wiki total for this level).`}</p>
            <p>{creditsLabel(money.credits)} budget · {creditsLabel(spent)} of gear · {money.houseRule ? money.note : ""}</p>
            <p>Scores {ABILITIES.map((ability) => `${ability.toUpperCase()} ${derived.scores[ability]}`).join(" · ")}</p>
            {derived.warnings.map((warning) => <p key={warning} className="text-pink">{warning}</p>)}
            <Button onClick={save}>{editId ? "Save changes" : "Save runner and open sheet"}</Button>
          </div>
        )}
      </section>
      <div className="flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((n) => Math.max(0, n - 1))}>Back</Button>
        {current !== "Review" && <Button disabled={current === "Lineage" && character.lineageId === "race:jerboan" && !character.sublineage} onClick={() => setStep((n) => Math.min(visible.length - 1, n + 1))}>Next</Button>}
      </div>
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<p className="text-muted">Warming up the builder…</p>}>
      <BuilderInner />
    </Suspense>
  );
}
