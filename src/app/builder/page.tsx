"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { Button, Chip, Field, Select, TextInput } from "@/components/ui";
import { AsiPicker } from "@/components/asi-picker";
import { ChoiceCard, FactList, HeritageField } from "@/components/choice";
import { ABILITIES, ABILITY_NAME, type Ability, type CatalogEntry, type Character, type ClassDef, type Rules } from "@/lib/types";
import { isHiddenLineage, loadCatalog, loadEntry, loadFlavor, loadRules, originLabel, type FlavorFile } from "@/lib/data";
import { getCharacter, upsertCharacter } from "@/lib/storage";
import {
  addClassLevel,
  asiAssignmentOk,
  asiLevels,
  assignPooledScore,
  blankCharacter,
  classEntries,
  classNeedsFightingStyle,
  creditsLabel,
  derive,
  FIGHTING_STYLES,
  findClass,
  fitClassLevels,
  lineageAsiMode,
  lineageGrantsFeat,
  normalizeCharacter,
  pointBuySpent,
  rankFor,
  rollAbilityScores,
  skillKey,
  standardScores,
} from "@/lib/character";
import { TechPicker } from "@/components/tech-picker";
import { pickLineage, traitGroups, unfilledLineageChoices } from "@/lib/traits";
import { builderIntent, draftHasWork } from "@/lib/draft";
import {
  SKILL_BLURB,
  carryCapacity,
  extraLineageSkills,
  featBlocked,
  GEAR_FILTERS,
  applyItemStats,
  gearCatalog,
  gearSummary,
  chosenEquipment,
  equipmentLines,
  gearBalance,
  gearLedger,
  grantEquipment,
  itemsNamedIn,
  packPieces,
  skillPickBudget,
  sortGear,
  type ItemStat,
  startingMoney,
  xpForLevel,
} from "@/lib/creation";

const STEPS = ["Basics", "Class", "Lineage", "Scores", "Upbringing", "Equipment", "Techs", "Review"];

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

function FlavorNote({ card }: { card?: FlavorFile["classes"][string] }) {
  if (!card) return null;
  const label = card.origin ? card.book ?? "" : originLabel(card);
  return (
    <div className="mt-2 space-y-2">
      {card.image && (
        // Static export: files in public/art are already sized. next/image would require a loader.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image} alt={card.credit || ""} loading="lazy" width={480} height={270} className="h-36 w-full rounded-sm object-cover object-top" />
      )}
      {label && <p className="text-xs uppercase tracking-wide text-cyan">{label}</p>}
      {card.blurb && <p className="text-sm text-muted">{card.blurb}</p>}
      {card.examples && card.examples.length > 0 && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer text-cyan">Example characters</summary>
          <ul className="mt-1 space-y-2 italic">{card.examples.map((line) => <li key={line.slice(0, 48)}>{line}</li>)}</ul>
        </details>
      )}
    </div>
  );
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
  const params = useSearchParams();
  const editId = params.get("id");
  const fresh = params.get("new") === "1";
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
  const [hint, setHint] = useState<string | null>(null);
  const [kitPicks, setKitPicks] = useState<Record<string, string>>({});
  const [flavor, setFlavor] = useState<FlavorFile | null>(null);
  const [techText, setTechText] = useState<Record<string, { summary: string; effect: string }>>({});
  const [pendingDraft, setPendingDraft] = useState<Character | null>(null);
  const skipDraftReload = useRef(false);

  useEffect(() => {
    loadRules().then(setRules).catch((err: Error) => setError(err.message));
    loadCatalog().then(setCatalog).catch(() => undefined);
    fetch("/data/feat-meta.json").then((res) => res.json()).then(setFeats).catch(() => undefined);
    fetch("/data/upbringing-ideas.json").then((res) => res.json()).then(setIdeas).catch(() => undefined);
    fetch("/data/item-details.json").then((res) => res.json()).then(setItemStats).catch(() => undefined);
    fetch("/data/feat-asi.json").then((res) => res.json()).then(setFeatAsi).catch(() => undefined);
    loadFlavor().then(setFlavor).catch(() => undefined);
    fetch("/data/tech-text.json").then((res) => res.json()).then(setTechText).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (editId) {
      const found = getCharacter(editId);
      setPendingDraft(null);
      setStep(0);
      setCharacter(found ? normalizeCharacter(found) : blankCharacter());
      return;
    }
    if (fresh) {
      skipDraftReload.current = true;
      sessionStorage.removeItem("ncl.draft");
      setPendingDraft(null);
      setStep(0);
      setCharacter(blankCharacter());
      router.replace("/builder/");
      return;
    }
    if (skipDraftReload.current) {
      skipDraftReload.current = false;
      return;
    }
    const raw = sessionStorage.getItem("ncl.draft");
    if (raw) {
      try {
        const parsed = normalizeCharacter(JSON.parse(raw) as Character);
        if (builderIntent({ id: null, fresh: false, draftHasWork: draftHasWork(parsed) }) === "ask") {
          setCharacter(null);
          setPendingDraft(parsed);
          return;
        }
      } catch { /* start blank */ }
    }
    setPendingDraft(null);
    setStep(0);
    setCharacter(blankCharacter());
  }, [editId, fresh, router]);
  useEffect(() => {
    if (!character || editId) return;
    sessionStorage.setItem("ncl.draft", JSON.stringify(character));
  }, [character, editId]);
  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const setCache = (id: string, md: string) => setCacheState((prev) => ({ ...prev, [id]: md }));
  const derived = useMemo(() => (rules && character ? derive(character, rules) : null), [rules, character]);
  if (error) return <p className="text-pink">{error}</p>;
  if (!rules) return <p className="text-muted">Warming up the builder…</p>;
  if (pendingDraft && !character) {
    return (
      <div className="neon-card space-y-3 p-4">
        <h1 className="brand text-3xl text-pink">Character builder</h1>
        <p>An unfinished draft is still in this browser{pendingDraft.name.trim() ? `: ${pendingDraft.name}` : ""}.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setCharacter(pendingDraft); setPendingDraft(null); setStep(0); }}>Continue draft</Button>
          <Button variant="ghost" onClick={() => { sessionStorage.removeItem("ncl.draft"); setPendingDraft(null); setStep(0); setCharacter(blankCharacter()); }}>Start new</Button>
        </div>
      </div>
    );
  }
  if (!character || !derived) return <p className="text-muted">Warming up the builder…</p>;

  const patch = (partial: Partial<Character>) => setCharacter({ ...character, ...partial });
  const summary = (id: string) => catalog.find((entry) => entry.id === id)?.summary ?? "";
  const entries = classEntries(character);
  const money = startingMoney(character.level);
  const catalogRows = sortGear(applyItemStats(gearCatalog(rules, catalog), itemStats), gearSort);
  const unpriced = catalogRows.filter((row) => row.cost == null).length;
  const undescribed = catalogRows.filter((row) => !row.description && !row.effect && !row.detail).length;
  const visible = STEPS.filter((name) => {
    if (name === "Techs") return derived.tricksMax > 0 || derived.slots.some((count) => count > 0) || derived.pactSlots > 0;
    return true;
  });
  const current = visible[Math.min(step, visible.length - 1)];
  const lineage = character.lineageId ? rules.lineages.find((item) => item.id === character.lineageId) : null;
  const lineageMode = lineage ? lineageAsiMode(lineage) : "none";
  const lineageReady = !lineage || lineage.asi === "none" || lineage.asi === "unknown" || asiAssignmentOk(lineageMode, character.lineageAsi);
  const pointsReady = character.scoreMethod !== "pointbuy" || pointBuySpent(character.baseScores, rules) <= rules.pointBuy.budget;
  const levelsReady = !entries.length || entries.reduce((sum, entry) => sum + entry.level, 0) === character.level;
  const styleNeeded = entries.some((entry) => {
    const cls = findClass(rules, entry.id);
    return Boolean(cls && classNeedsFightingStyle(cls, entry.level));
  });
  const subclassNeeded = entries.some((entry) => {
    const cls = findClass(rules, entry.id);
    return Boolean(cls?.subclassLevel && entry.level >= cls.subclassLevel && !entry.subclassId);
  });
  const upbringing = rules.upbringings.find((item) => item.id === character.upbringingId);
  const granted = new Set((upbringing?.skills ?? []).map(skillKey));
  const budget = skillPickBudget(character, rules);
  const chosen = character.skillProfs.filter((skill) => !granted.has(skillKey(skill)));
  const missing = [
    !character.name.trim() ? "Name" : "",
    !entries.length ? "Class" : "",
    !levelsReady ? "Class levels must add up to the character level" : "",
    subclassNeeded ? "Subclass" : "",
    styleNeeded && character.fightingStyles.length === 0 ? "Fighting style" : "",
    !character.lineageId ? "Lineage" : "",
    character.lineageId && !lineageReady ? "Lineage ability score increase" : "",
    character.lineageId === "race:jerboan" && !character.sublineage ? "Jerboan heritage" : "",
    ...unfilledLineageChoices(character, rules.lineages),
    !pointsReady ? "Point buy is over 27" : "",
    !character.upbringingId ? "Upbringing" : "",
    character.upbringingId && chosen.length < budget ? `Skill picks (${budget - chosen.length} left)` : "",
  ].filter(Boolean);
  const nextBlocked = (current === "Basics" && !character.name.trim())
    || (current === "Class" && (!entries.length || !levelsReady || subclassNeeded || (styleNeeded && character.fightingStyles.length === 0)))
    || (current === "Lineage" && (!character.lineageId || !lineageReady || (character.lineageId === "race:jerboan" && !character.sublineage)))
    || (current === "Scores" && !pointsReady)
    || (current === "Upbringing" && (!character.upbringingId || chosen.length < budget));
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
      credits: gearBalance(money.credits, gearLedger(draft, book)),
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

  function gearFromKit(classId: string, picks: Record<string, string>, keepExtra: boolean) {
    const cls = findClass(book, classId);
    if (!cls) return {};
    const lines = equipmentLines(cls, book);
    const source = `Class: ${cls.name}`;
    const items = (lines.length ? chosenEquipment(lines, picks) : []).filter((item) => item.category !== "cybernetics");
    const granted = grantEquipment(items, source);
    if (!keepExtra) return granted;
    const extraInventory = draft.inventory.filter((item) => !item.notes.startsWith("Class:"));
    const extraWeapons = draft.weapons.filter((weapon) => !weapon.source?.startsWith("Class:"));
    return {
      ...granted,
      weapons: [...granted.weapons, ...extraWeapons],
      inventory: [...granted.inventory, ...extraInventory],
      armorId: granted.armorId ?? (draft.armorSource?.startsWith("Class:") ? null : draft.armorId),
      armorSource: granted.armorSource ?? (draft.armorSource?.startsWith("Class:") ? null : draft.armorSource),
      shield: granted.shield || Boolean(draft.shield && !draft.shieldSource?.startsWith("Class:")),
      shieldSource: granted.shieldSource ?? (draft.shieldSource?.startsWith("Class:") ? null : draft.shieldSource),
    };
  }

  function lineageOptions(item: NonNullable<typeof lineage>) {
    if (!character || !rules) return null;
    return (
      <>
        <AsiPicker mode={lineageAsiMode(item)} value={character.lineageAsi} onChange={(lineageAsi) => patch({ lineageAsi })} />
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
          onChange={(name) => patch({ sublineage: name, subAsi: {}, lineagePicks: character.lineagePicks.filter((pick) => !pick.startsWith("nu-") && !pick.startsWith("major:") && !pick.startsWith("minor:")) })}
          onAsi={(ability, amount) => patch({ subAsi: { [ability]: amount } })}
        />
        {traitGroups(character, rules.lineages).map((group) => {
          const picked = character.lineagePicks.filter((id) => group.traits.some((trait) => trait.id === id) || (group.trickList ? id.startsWith(`bonus-tech:${group.trickList}:`) : false));
          return (
            <div key={group.id} className="mt-3 space-y-2">
              <p className="text-xs uppercase tracking-wider text-cyan">{group.title} · {picked.length}/{group.max}</p>
              {group.trickList ? (
                <Select value={character.lineagePicks.find((id) => id.startsWith(`bonus-tech:${group.trickList}:`)) ?? ""} onChange={(event) => {
                  const rest = character.lineagePicks.filter((id) => !id.startsWith(`bonus-tech:${group.trickList}:`));
                  patch({ lineagePicks: event.target.value ? [...rest, event.target.value] : rest });
                }}>
                  <option value="">Choose a trick</option>
                  {rules.techs.filter((tech) => tech.trick && (tech.classes ?? []).includes(group.trickList!)).map((tech) => (
                    <option key={tech.id} value={`bonus-tech:${group.trickList}:${tech.id}`}>{tech.name}</option>
                  ))}
                </Select>
              ) : (
                <div className="flex max-h-48 flex-wrap gap-2 overflow-auto">
                  {group.traits.map((trait) => {
                    const on = character.lineagePicks.includes(trait.id);
                    return (
                      <Chip key={trait.id} active={on} onClick={() => {
                        if (on) {
                          patch({ lineagePicks: character.lineagePicks.filter((id) => id !== trait.id) });
                          return;
                        }
                        const inGroup = character.lineagePicks.filter((id) => group.traits.some((entry) => entry.id === id));
                        if (group.lineageCap) {
                          const lineages = new Set(inGroup.map(pickLineage).filter(Boolean));
                          const nextLineage = pickLineage(trait.id);
                          if (nextLineage && !lineages.has(nextLineage) && lineages.size >= group.lineageCap) return;
                        }
                        const withoutOldest = inGroup.length >= group.max ? character.lineagePicks.filter((id) => id !== inGroup[0]) : character.lineagePicks;
                        patch({ lineagePicks: [...withoutOldest, trait.id] });
                      }}>{trait.name}</Chip>
                    );
                  })}
                </div>
              )}
              {group.traits.filter((trait) => character.lineagePicks.includes(trait.id)).slice(0, 4).map((trait) => <p key={trait.id} className="text-xs text-muted">{trait.summary}</p>)}
            </div>
          );
        })}
      </>
    );
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
      <div className="flex gap-1" aria-hidden="true">
        {visible.map((name, index) => <div key={name} className={`h-1.5 flex-1 ${index <= Math.min(step, visible.length - 1) ? "bg-pink" : "bg-white/15"}`} />)}
      </div>
      <p className="text-xs text-muted">{visible.map((name, index) => (
        <button key={name} type="button" className={`mr-2 min-h-11 underline-offset-2 ${index === Math.min(step, visible.length - 1) ? "text-pink" : "text-cyan"}`} onClick={() => setStep(index)}>{name}</button>
      ))}</p>
      {lineage && current !== "Lineage" && (
        <details className="border border-white/10 p-3 text-sm">
          <summary className="min-h-11 cursor-pointer text-cyan">Lineage choices · {lineage.name}. Open this on any step. The rest of the runner stays.</summary>
          <div className="mt-3 space-y-2">{lineageOptions(lineage)}</div>
        </details>
      )}
      {current !== "Review" && missing.length > 0 && (
        <p className="text-sm text-pink">Still needed before Review: {missing.join(", ")}.</p>
      )}
      <section className="neon-card space-y-4 p-4">
        {current === "Basics" && (
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
            <p className="text-sm">How will you assign ability scores? The numbers themselves come on the Scores step, after lineage bonuses are known.</p>
            <div className="flex flex-wrap gap-2">
              {(["standard", "pointbuy", "roll"] as const).map((method) => (
                <Chip key={method} active={character.scoreMethod === method} onClick={() => patch({ scoreMethod: method, baseScores: method === "standard" ? standardScores() : { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } })}>{method === "roll" ? "Roll 4d6 drop lowest" : method === "pointbuy" ? "27-point buy" : "Standard array"}</Chip>
              ))}
            </div>
          </>
        )}
        {current === "Lineage" && rules.lineages.filter((item) => !isHiddenLineage(item.id)).map((item) => {
          const selected = character.lineageId === item.id;
          const sizeFromHeritage = item.sublineages.some((sub) => sub.traits.some((trait) => trait.name === "Size"));
          return (
            <ChoiceCard key={item.id} choiceId={item.id} title={item.name} selected={selected} onSelect={() => {
              if (selected) return;
              patch({ lineageId: item.id, sublineage: null, lineageAsi: {}, subAsi: {}, lineageOption: null, lineagePicks: [] });
            }}>
              <FlavorNote card={flavor?.lineages[item.id]} />
              <FactList rows={[
                { label: "Ability score increase", text: item.asiText ?? "The wiki does not state an ability score increase." },
                { label: "House rule", text: item.houseRule ?? "" },
                { label: "Size", text: item.size ?? (sizeFromHeritage ? "Set by the heritage." : "The wiki does not state a size.") },
                { label: "Speed", text: item.speedText ?? (item.speed ? `${item.speed} feet.` : "The wiki does not state a speed.") },
                { label: "Languages", text: item.languages ?? "The wiki does not grant a language." },
                ...item.traits.map((trait) => ({ label: trait.name, text: trait.line })),
              ]} />
              <Reveal id={item.id} text="Full wiki text, including naming notes." cache={cache} setCache={setCache} />
              {selected && <div className="mt-2 space-y-2">{lineageOptions(item)}</div>}
            </ChoiceCard>
          );
        })}
        {current === "Upbringing" && rules.upbringings.map((item) => (
          <ChoiceCard key={item.id} choiceId={item.id} title={item.name} selected={character.upbringingId === item.id} onSelect={() => {
            if (character.upbringingId === item.id) return;
            const source = `Upbringing: ${item.name}`;
            const granted = grantEquipment(itemsNamedIn(gearCatalog(book), item.equipment).filter((piece) => piece.category !== "cybernetics"), source);
            const keptInventory = draft.inventory.filter((entry) => !entry.notes.startsWith("Upbringing:"));
            const keptWeapons = draft.weapons.filter((weapon) => !weapon.source?.startsWith("Upbringing:"));
            patch({
              upbringingId: item.id,
              toolProfs: item.tools.filter((tool) => tool.toLowerCase() !== "none"),
              weapons: [...keptWeapons, ...granted.weapons],
              inventory: [...keptInventory, ...granted.inventory],
              ...(granted.armorId && !draft.armorId ? { armorId: granted.armorId, armorSource: source } : {}),
            });
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
                <ChoiceCard key={item.id} choiceId={item.id} title={flavor?.classes[item.id]?.origin ? `${item.name}, from ${flavor.classes[item.id].origin}` : item.name} selected={selected} onSelect={() => {
                  if (selected) return;
                  setKitPicks({});
                  patch({
                    classId: item.id,
                    subclassId: null,
                    fightingStyles: [],
                    defenseStyle: false,
                    classLevels: [{ id: item.id, level: character.level, subclassId: null }],
                    ...gearFromKit(item.id, {}, false),
                  });
                }}>
                  {selected && <TextInput className="mt-2 w-24" type="number" min={1} max={character.level} aria-label={`${item.name} levels`} value={entries.find((entry) => entry.id === item.id)?.level ?? 1} onChange={(e) => {
                    const level = Number(e.target.value) || 1;
                    const next = fitClassLevels(entries.map((entry) => entry.id === item.id ? { ...entry, level } : entry), character.level, item.id);
                    patch({ classLevels: next, classId: next[0]?.id ?? item.id, subclassId: next[0]?.subclassId ?? null });
                  }} />}
                  <FlavorNote card={flavor?.classes[item.id]} />
                  <FactList rows={classFacts(item)} />
                  <Reveal id={item.id} text="Full wiki text." cache={cache} setCache={setCache} />
                  {selected && item.subclassLevel && (entries.find((entry) => entry.id === item.id)?.level ?? 0) >= item.subclassLevel && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm text-cyan">Subclass, from level {item.subclassLevel}</p>
                      {rules.subclasses.filter((sub) => sub.classId === item.id).map((sub) => {
                        const entry = entries.find((row) => row.id === item.id);
                        return (
                          <ChoiceCard key={sub.id} choiceId={sub.id} title={flavor?.classes[sub.id]?.origin ? `${sub.name}, from ${flavor.classes[sub.id].origin}` : sub.name} selected={entry?.subclassId === sub.id} onSelect={() => {
                            if (entry?.subclassId === sub.id) return;
                            patch({ classLevels: entries.map((row) => row.id === item.id ? { ...row, subclassId: sub.id } : row), subclassId: entries[0]?.id === item.id ? sub.id : character.subclassId });
                          }}>
                            <FlavorNote card={flavor?.classes[sub.id]} />
                            <p className="mt-2 text-sm text-muted">{sub.blurb || summary(sub.id) || "The wiki page has no short summary."}</p>
                            <Reveal id={sub.id} text="Full wiki text." cache={cache} setCache={setCache} />
                          </ChoiceCard>
                        );
                      })}
                    </div>
                  )}
                  {selected && entries.some((entry) => entry.id === item.id && classNeedsFightingStyle(item, entry.level)) && entries.find((entry) => { const cls = findClass(rules, entry.id); return cls && classNeedsFightingStyle(cls, entry.level); })?.id === item.id && (
                    <Field label="Fighting style">
                      <Select value={character.fightingStyles[0] ?? ""} onChange={(e) => patch({ fightingStyles: e.target.value ? [e.target.value] : [], defenseStyle: e.target.value === "Defense" })}>
                        <option value="">Choose a fighting style</option>
                        {[...new Set(entries.flatMap((entry) => FIGHTING_STYLES[entry.id] ?? []))].map((style) => <option key={style} value={style}>{style}</option>)}
                      </Select>
                      <p className="mt-1 text-xs text-muted">Defense is +1 AC in armor and +2 in heavy armor, for every class whose style says so. Mariner is +1 AC while you are not in heavy armor or using a shield. Dueling adds +2 damage with a single one-handed melee weapon.</p>
                    </Field>
                  )}
                </ChoiceCard>
              );
            })}
            <Field label="Add a second class">
              <Select value="" onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                const next = addClassLevel(entries, id, character.level);
                if (!next) {
                  setHint("Every class is already at 1 level. Raise the starting level before splitting further.");
                  return;
                }
                setHint(null);
                patch({ classLevels: next, classId: next[0]?.id ?? id, subclassId: next[0]?.subclassId ?? null });
              }}>
                <option value="">Choose…</option>
                {rules.classes.filter((item) => !entries.some((entry) => entry.id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            {hint && <p className="text-sm text-pink">{hint}</p>}
            <p className={entries.reduce((sum, entry) => sum + entry.level, 0) === character.level ? "text-cyan" : "text-pink"}>Assigned {entries.reduce((sum, entry) => sum + entry.level, 0)} / {character.level}</p>
          </>
        )}
        {current === "Scores" && (
          <>
            <p className="text-sm text-muted">Method chosen in Basics: {character.scoreMethod === "pointbuy" ? "27-point buy" : character.scoreMethod === "roll" ? "4d6 drop lowest" : "standard array"}. Lineage increases are added on top and stop at 20 before cybernetics.</p>
            {lineage && <p className="text-sm">Lineage increase: {lineage.asiText}</p>}
            {Object.entries(character.lineageAsi).filter(([, amount]) => amount).map(([ability, amount]) => <p key={ability} className="text-sm text-cyan">{ABILITY_NAME[ability as Ability]} +{amount} from lineage</p>)}
            {Object.entries(character.subAsi).filter(([, amount]) => amount).map(([ability, amount]) => <p key={ability} className="text-sm text-cyan">{ABILITY_NAME[ability as Ability]} +{amount} from heritage</p>)}
            {character.asiPicks.filter((pick) => pick.mode === "asi").flatMap((pick) => Object.entries(pick.abilities ?? {}).filter(([, amount]) => amount).map(([ability, amount]) => (
              <p key={`${pick.classId}-${pick.level}-${ability}`} className="text-sm text-cyan">{ABILITY_NAME[ability as Ability]} +{amount} from {findClass(rules, pick.classId ?? "")?.name ?? "class"} level {pick.level}</p>
            )))}
            {entries.some((entry) => { const cls = findClass(rules, entry.id); return cls && asiLevels(cls, entry.level).length > 0; }) && (
              <p className="text-sm">Class ability score improvements are included in the modifiers. Assign each one below, or take a feat instead.</p>
            )}
            {character.scoreMethod === "pointbuy" && <p>Points left: {rules.pointBuy.budget - pointBuySpent(character.baseScores, rules)}</p>}
            {character.scoreMethod === "roll" && <Button variant="ghost" onClick={() => { const rolledScores = rollAbilityScores(); patch({ rolledScores, baseScores: { str: rolledScores[0], dex: rolledScores[1], con: rolledScores[2], int: rolledScores[3], wis: rolledScores[4], cha: rolledScores[5] } }); }}>Roll six scores</Button>}
            {character.rolledScores.length > 0 && character.scoreMethod === "roll" && <p className="text-cyan">Pool: {character.rolledScores.join(", ")}</p>}
            {character.scoreMethod === "pointbuy" && pointBuySpent(character.baseScores, rules) > rules.pointBuy.budget && <p className="text-sm text-pink">That assignment spends more than 27 points.</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ABILITIES.map((ability) => (
                <Field key={ability} label={`${ABILITY_NAME[ability]} ${derived.mods[ability] >= 0 ? "+" : ""}${derived.mods[ability]}`}>
                  {character.scoreMethod === "pointbuy" ? (
                    <TextInput type="number" min={8} max={15} value={character.baseScores[ability]} onChange={(e) => {
                      const value = Math.min(15, Math.max(8, Number(e.target.value) || 8));
                      const baseScores = { ...character.baseScores, [ability]: value };
                      if (pointBuySpent(baseScores, rules) > rules.pointBuy.budget) return;
                      patch({ baseScores });
                    }} />
                  ) : (
                    <Select value={character.baseScores[ability]} onChange={(e) => patch({ baseScores: assignPooledScore(character.baseScores, ability, Number(e.target.value)) })}>
                      {(character.scoreMethod === "roll" ? (character.rolledScores.length ? character.rolledScores : [character.baseScores[ability]]) : rules.standardArray).map((score, index) => (
                        <option key={`${score}-${index}`} value={score}>{score}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              ))}
            </div>
          </>
        )}
        {current === "Upbringing" && character.upbringingId && (
          <>
            <p className="text-sm">Picks left: {Math.max(0, budget - chosen.length)}. Filled dots are from upbringing{extraLineageSkills(character.lineageId, character.sublineage) ? " or lineage" : ""} and do not spend a pick.</p>
            {derived.expertiseCap > 0 && <p className="text-sm text-cyan">Expertise {character.skillExpertise.length}/{derived.expertiseCap}. It doubles proficiency on a skill you already have.</p>}
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
                        {derived.expertiseCap > 0 && on && (
                          <button type="button" className={`ml-2 text-xs ${character.skillExpertise.some((name) => skillKey(name) === key) ? "text-pink" : "text-cyan"}`} onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const has = character.skillExpertise.some((name) => skillKey(name) === key);
                            if (has) patch({ skillExpertise: character.skillExpertise.filter((name) => skillKey(name) !== key) });
                            else if (character.skillExpertise.length < derived.expertiseCap) patch({ skillExpertise: [...character.skillExpertise, skill.name] });
                          }}>{character.skillExpertise.some((name) => skillKey(name) === key) ? "Expertise" : "Add expertise"}</button>
                        )}
                        <span className="block text-sm text-muted">{SKILL_BLURB[skill.id] ?? ""}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {current === "Techs" && (
          <TechPicker
            rules={rules}
            character={character}
            mods={derived.mods}
            slots={derived.slots}
            pactLevel={derived.pactLevel}
            techText={techText}
            onChange={(next) => patch(next)}
          />
        )}
        {current === "Scores" && (
          <>
            {entries.flatMap((entry) => {
              const cls = findClass(rules, entry.id);
              return (cls ? asiLevels(cls, entry.level) : []).map((lv) => (
                <div key={`${entry.id}-${lv}`} className="border border-white/10 p-2">
                  <p className="text-cyan">{findClass(rules, entry.id)?.name} level {lv}</p>
                  <div className="mt-2 space-y-2">
                    <Chip active={character.asiPicks.find((pick) => pick.level === lv && pick.classId === entry.id)?.mode === "feat"} onClick={() => patch({ asiPicks: [...character.asiPicks.filter((pick) => !(pick.level === lv && pick.classId === entry.id)), { level: lv, classId: entry.id, mode: "feat" }] })}>Feat instead</Chip>
                    {character.asiPicks.find((pick) => pick.level === lv && pick.classId === entry.id)?.mode !== "feat" && (
                      <AsiPicker mode="flex" value={character.asiPicks.find((pick) => pick.level === lv && pick.classId === entry.id)?.abilities ?? {}} onChange={(abilities) => patch({ asiPicks: [...character.asiPicks.filter((pick) => !(pick.level === lv && pick.classId === entry.id)), { level: lv, classId: entry.id, mode: "asi", abilities }] })} />
                    )}
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
        {current === "Equipment" && (
          <>
            <MoneyLines stipend={money.credits} note={money.note} lines={gearLedger(character, rules)} />
            <p className="text-sm text-muted">Carry {weight} / {carryCapacity(derived.scores.str) * derived.carryMultiplier} lb (Strength × 15{derived.carryMultiplier > 1 ? `, ×${derived.carryMultiplier} for Powerful Build or a taur body` : ""}; the wiki does not restate carry capacity). {character.level <= 2 ? "Levels 1–2 stay on a starter kit. Money is tight." : ""}</p>
            {entries[0] && findClass(rules, entries[0].id) && (() => {
              const cls = findClass(rules, entries[0].id)!;
              const lines = equipmentLines(cls, rules);
              const selected = chosenEquipment(lines, kitPicks);
              return (
                <div className="border border-white/10 p-3 text-sm">
                  <p className="text-cyan">Starting equipment. Each (a) or (b) line is one choice. Option A is on the sheet until you switch it. Switching a line replaces the kit and keeps anything you added from the list below.</p>
                  {lines.map((line) => (
                    <div key={line.id} className="mt-2">
                      {line.choice ? (
                        <div className="flex flex-wrap gap-2">
                          {line.options.map((option) => (
                            <Chip key={option.key} active={(kitPicks[line.id] ?? "a") === option.key} onClick={() => {
                              const next = { ...kitPicks, [line.id]: option.key };
                              setKitPicks(next);
                              patch(gearFromKit(cls.id, next, true));
                            }}>
                              ({option.key}) {option.items.map((item) => item.name).join(", ") || option.label}
                            </Chip>
                          ))}
                        </div>
                      ) : <p>{line.options[0]?.items.map((item) => item.name).join(", ") || line.options[0]?.label}</p>}
                    </div>
                  ))}
                  {selected.length === 0 && <p className="mt-2 text-muted">This option stays as written on the wiki. No catalog item matches it, so it is not added to the sheet.</p>}
                </div>
              );
            })()}
            <TextInput value={gearQuery} onChange={(e) => setGearQuery(e.target.value)} placeholder="Search gear" />
            <div className="flex flex-wrap gap-2">
              {GEAR_FILTERS.filter((cat) => cat !== "cybernetics").map((cat) => <Chip key={cat} active={gearCat === cat} onClick={() => setGearCat(cat)}>{cat}</Chip>)}
            </div>
            <div className="flex flex-wrap gap-2">
              {([["rarity", "rarity then price"], ["name", "name"], ["price", "price"]] as const).map(([mode, label]) => <Chip key={mode} active={gearSort === mode} onClick={() => setGearSort(mode)}>{label}</Chip>)}
            </div>
            <p className="text-xs text-muted">{catalogRows.filter((row) => (gearCat === "all" || (gearCat === "high-end" ? row.highEnd : row.category === gearCat)) && row.name.toLowerCase().includes(gearQuery.toLowerCase())).length} shown · {catalogRows.length} items. {unpriced} have no wiki price. {undescribed} have no wiki description. The wiki has no separate services price list.</p>
            <ul className="max-h-[32rem] space-y-2 overflow-auto">
              {catalogRows.filter((row) => row.category !== "cybernetics" && (gearCat === "all" || (gearCat === "high-end" ? row.highEnd : row.category === gearCat)) && row.name.toLowerCase().includes(gearQuery.toLowerCase())).map((row) => (
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
                          else inventory.push({ name: piece.name, qty: piece.qty, notes: "Purchased" });
                        }
                        patch({ inventory });
                        return;
                      }
                      if (row.category === "armor") patch({ armorId: row.id, armorSource: "Purchased" });
                      else if (row.category === "shields") patch({ shield: true, shieldSource: "Purchased" });
                      else if (row.category === "weapons" || row.category === "grenades") patch({ weapons: [...character.weapons, { id: row.id, source: "Purchased" }] });
                      else patch({ inventory: [...character.inventory, { name: row.name, qty: 1, notes: "Purchased" }] });
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
            {missing.length > 0 && (
              <div className="border border-pink/50 p-3">
                <p className="text-pink">Still needed before this runner can be saved:</p>
                <ul className="mt-1 list-disc pl-5">{missing.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            )}
            <p className="text-lg">{character.name || "Unnamed"} · level {character.level} · {derived.classLabels}</p>
            <p>HP {derived.hp} (minimum 1 per level) · AC {derived.ac} · proficiency {derived.pb >= 0 ? `+${derived.pb}` : derived.pb}</p>
            <p>{character.level < 5 ? `XP ${xpForLevel(character.level).toLocaleString()} (5e threshold; the wiki chart starts at level 5).` : `MP ${rankFor(rules, character.level)?.totalMp ?? 0} (wiki total for this level).`}</p>
            <MoneyLines stipend={money.credits} note={money.note} lines={gearLedger(character, rules)} />
            <p>Scores {ABILITIES.map((ability) => `${ability.toUpperCase()} ${derived.scores[ability]}`).join(" · ")}</p>
            {derived.warnings.map((warning) => <p key={warning} className="text-pink">{warning}</p>)}
            <Button disabled={missing.length > 0} onClick={save}>{editId ? "Save changes" : "Save runner and open sheet"}</Button>
          </div>
        )}
      </section>
      <div className="h-16 md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-14 z-30 mx-auto flex max-w-6xl justify-between gap-3 border-t border-cyan/30 bg-[#07060c]/95 px-4 py-3 md:static md:inset-auto md:z-auto md:mt-4 md:border-0 md:bg-transparent md:px-0">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((n) => Math.max(0, n - 1))}>Back</Button>
        {current !== "Review" && <Button disabled={nextBlocked} onClick={() => setStep((n) => Math.min(visible.length - 1, n + 1))}>Next</Button>}
      </div>
    </div>
  );
}

function MoneyLines({ stipend, note, lines }: { stipend: number; note: string; lines: { name: string; cost: number; source: string }[] }) {
  const balance = gearBalance(stipend, lines);
  return (
    <div className="space-y-1 text-sm" data-money={balance}>
      <p>Starting stipend {creditsLabel(stipend)}. {note}</p>
      <ul className="space-y-1">
        {lines.map((line, index) => (
          <li key={`${line.source}-${line.name}-${index}`}>{line.source} · {line.name} · {line.cost < 0 ? `adds ${creditsLabel(-line.cost)}` : creditsLabel(line.cost)}</li>
        ))}
      </ul>
      {balance < 0 ? (
        <p className="text-pink">Debt {creditsLabel(-balance)}. The gear costs more than the stipend. That debt stays on purpose, so the runner has a reason to take work.</p>
      ) : (
        <p>Left {creditsLabel(balance)}.</p>
      )}
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
