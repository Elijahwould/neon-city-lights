import { activeTraits, borrowedNotes, traitAbility } from "./traits";
import {
  ABILITIES,
  ABILITY_NAME,
  type Ability,
  type Character,
  type ClassDef,
  type ClassLevel,
  type Rules,
  type SkillDef,
  type SubclassDef,
  type TechPick,
} from "./types";

export function modifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function formatMod(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function skillKey(name: string) {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export function blankScores(): Record<Ability, number> {
  return { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
}

export function standardScores(): Record<Ability, number> {
  return { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
}

const zeros = () => [0, 0, 0, 0, 0, 0, 0, 0, 0];

export function blankCharacter(): Character {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `runner-${Date.now()}`,
    version: 1,
    name: "",
    pronouns: "",
    concept: "",
    level: 1,
    credits: 0,
    mpEarned: 0,
    xp: 0,
    lineageId: null,
    sublineage: null,
    lineageAsi: {},
    subAsi: {},
    upbringingId: null,
    classId: null,
    subclassId: null,
    scoreMethod: "standard",
    rolledScores: [],
    baseScores: standardScores(),
    classLevels: [],
    lineageOption: null,
    lineagePicks: [],
    asiPicks: [],
    skillProfs: [],
    skillExpertise: [],
    toolProfs: [],
    languages: ["Common"],
    hpOverride: null,
    defenseStyle: false,
    fightingStyles: [],
    armorId: null,
    armorSource: null,
    shield: false,
    shieldSource: null,
    weapons: [],
    techs: [],
    techPicks: [],
    prepared: [],
    inventory: [],
    cybernetics: [],
    notes: "",
    biography: "",
    sheetNotes: {},
    choices: [],
    playerName: "",
    alignment: "",
    personality: "",
    ideals: "",
    bonds: "",
    flaws: "",
    inspiration: false,
    hpCurrent: null,
    hpTemp: 0,
    deathSuccess: 0,
    deathFail: 0,
    slotsExpended: zeros(),
    bonusSlots: zeros(),
    sourcePointsSpent: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeCharacter(input: Character): Character {
  const base = blankCharacter();
  return {
    ...base,
    ...input,
    rolledScores: input.rolledScores ?? [],
    classLevels: input.classLevels ?? [],
    lineageOption: input.lineageOption ?? null,
    lineagePicks: input.lineagePicks ?? [],
    asiPicks: input.asiPicks ?? [],
    playerName: input.playerName ?? "",
    alignment: input.alignment ?? "",
    personality: input.personality ?? "",
    ideals: input.ideals ?? "",
    bonds: input.bonds ?? "",
    flaws: input.flaws ?? "",
    inspiration: input.inspiration ?? false,
    hpCurrent: input.hpCurrent ?? null,
    hpTemp: input.hpTemp ?? 0,
    deathSuccess: input.deathSuccess ?? 0,
    deathFail: input.deathFail ?? 0,
    slotsExpended: input.slotsExpended?.length === 9 ? input.slotsExpended : zeros(),
    bonusSlots: input.bonusSlots?.length === 9 ? input.bonusSlots : zeros(),
    sourcePointsSpent: input.sourcePointsSpent ?? 0,
    xp: input.xp ?? 0,
    sheetNotes: input.sheetNotes ?? {},
    fightingStyles: input.fightingStyles ?? (input.defenseStyle ? ["Defense"] : []),
    techPicks: input.techPicks ?? [],
    armorSource: input.armorSource ?? null,
    shieldSource: input.shieldSource ?? null,
  };
}

export function roll4d6DropLowest(rng: () => number = Math.random) {
  const dice = [0, 1, 2, 3].map(() => 1 + Math.floor(rng() * 6)).sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}

export function rollAbilityScores(rng: () => number = Math.random) {
  return [0, 1, 2, 3, 4, 5].map(() => roll4d6DropLowest(rng));
}

export function pointBuySpent(scores: Record<Ability, number>, rules: Rules) {
  return ABILITIES.reduce((sum, ability) => sum + (rules.pointBuy.costs[String(scores[ability])] ?? 99), 0);
}

export function findClass(rules: Rules, id: string | null) {
  return rules.classes.find((c) => c.id === id) ?? null;
}

export function findSubclass(rules: Rules, id: string | null) {
  return rules.subclasses.find((s) => s.id === id) ?? null;
}

export function classEntries(character: Character): ClassLevel[] {
  if (character.classLevels?.length) return character.classLevels;
  if (character.classId) return [{ id: character.classId, level: character.level, subclassId: character.subclassId }];
  return [];
}

export function levelRow(cls: ClassDef, level: number) {
  return cls.levels.find((row) => row.level === level) ?? cls.levels[cls.levels.length - 1];
}

export function proficiencyBonus(_cls: ClassDef | null, level: number) {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

export function featuresThrough(cls: ClassDef, level: number) {
  const names: string[] = [];
  for (const row of cls.levels) {
    if (row.level > level) break;
    for (const feature of row.features) {
      if (!names.includes(feature)) names.push(feature);
    }
  }
  return names;
}

export function hasFeature(cls: ClassDef, level: number, needle: string) {
  const key = needle.toLowerCase();
  return featuresThrough(cls, level).some((feature) => feature.toLowerCase().includes(key));
}

export function asiLevels(cls: ClassDef, level: number) {
  return cls.levels.filter((row) => row.level <= level && row.features.some((f) => f.toLowerCase().includes("ability score improvement"))).map((row) => row.level);
}

export function expertiseCap(cls: ClassDef | null, level: number) {
  if (!cls) return 0;
  return cls.levels.filter((row) => row.level <= level && row.features.some((f) => f.toLowerCase() === "expertise")).length * 2;
}

export function rankFor(rules: Rules, level: number) {
  const row = rules.mpTable.find((entry) => entry.level === level);
  if (row) return row;
  if (level < 5) return { level, rank: "Not on the rank chart", mpToNext: null, totalMp: 0 };
  return null;
}

const ABILITY_WORD: Record<string, Ability> = {
  strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha",
};

/** Wiki multiclass prerequisites. Pretender is parsed as (Str or Dex) AND (Int or Wis). */
const PREREQS: Record<string, string> = {
  auditor: "Dexterity 13 and Wisdom 13",
  brawler: "Dexterity 13 and Wisdom 13",
  enforcer: "Strength 13 and Charisma 13",
  influencer: "Charisma 13",
  mechanist: "Intelligence 13",
  ordinator: "Wisdom 13",
  outlaw: "Dexterity 13",
  renegade: "Strength 13",
  ronin: "Strength 13 or Dexterity 13",
  shutin: "Wisdom 13",
  sourcecoder: "Charisma 13",
  streamer: "Charisma 13",
  streetfighter: "Strength 13 and Constitution 13",
  techwizard: "Intelligence 13",
};

export const MULTICLASS_PROFICIENCIES: Record<string, string> = {
  auditor: "Light armor, medium armor, shields, civilian weapons, military weapons",
  brawler: "Civilian weapons, machetes",
  enforcer: "Light armor, medium armor, shields, civilian weapons, military weapons",
  influencer: "Light armor, one skill of your choice, one streaming tool of your choice",
  mechanist: "Light armor, medium armor, shields, locksmith's kit, one basic toolkit of your choice",
  ordinator: "Light armor, medium armor, shields",
  outlaw: "Light armor, one skill from the outlaw skill list, locksmith's kit",
  pretender: "Light armor, medium armor, shields, civilian weapons, military weapons, microlabs",
  ronin: "Light armor, medium armor, shields, civilian weapons, military weapons",
  renegade: "Shields, civilian weapons, military weapons",
  shutin: "Light armor, medium armor, shields",
  sourcecoder: "",
  streamer: "Light armor, civilian weapons",
  streetfighter: "Light armor, improvised weapons",
  techwizard: "",
};

export function meetsMulticlassPrereq(classId: string, scores: Record<Ability, number>) {
  if (classId === "pretender") {
    return (scores.str >= 13 || scores.dex >= 13) && (scores.int >= 13 || scores.wis >= 13);
  }
  const text = PREREQS[classId];
  if (!text) return true;
  return text.split(/ and /i).every((part) =>
    part.split(/ or /i).some((option) => {
      const match = option.match(/([A-Za-z]+)\s+(\d+)/);
      if (!match) return false;
      const ability = ABILITY_WORD[match[1].toLowerCase()];
      return ability ? scores[ability] >= Number(match[2]) : false;
    }),
  );
}

export function canTakeClassLevel(character: Character, classId: string, scores: Record<Ability, number>) {
  const entries = classEntries(character);
  const already = entries.some((entry) => entry.id === classId);
  const wouldMulticlass = entries.length > 1 || (entries.length >= 1 && !already);
  if (!wouldMulticlass) return { ok: true, reason: "" };
  const ids = already ? entries.map((entry) => entry.id) : [...entries.map((entry) => entry.id), classId];
  for (const id of ids) {
    if (!meetsMulticlassPrereq(id, scores)) {
      return { ok: false, reason: `${findName(id)} requires ${id === "pretender" ? "(Str 13 or Dex 13) and (Int 13 or Wis 13)" : PREREQS[id]}.` };
    }
  }
  return { ok: true, reason: "" };
}

function findName(id: string) {
  return id.replace(/^\w/, (c) => c.toUpperCase());
}

export function applyLevelUp(character: Character, rules: Rules, classId: string, subclassId?: string | null): Character {
  const current = normalizeCharacter(character);
  const entries = classEntries(current).map((entry) => ({ ...entry }));
  const found = entries.find((entry) => entry.id === classId);
  if (found) {
    found.level += 1;
    if (subclassId) found.subclassId = subclassId;
  } else {
    entries.push({ id: classId, level: 1, subclassId: subclassId ?? null });
  }
  const level = entries.reduce((sum, entry) => sum + entry.level, 0);
  const mp = rankFor(rules, level);
  return {
    ...current,
    classLevels: entries,
    classId: entries[0]?.id ?? classId,
    subclassId: entries[0]?.subclassId ?? null,
    level,
    mpEarned: mp?.totalMp ?? current.mpEarned,
    hpOverride: null,
  };
}

/** Full casters, half casters (including Mechanist, whose table matches a half caster), and one-third casters. Streamer Gifted Tech stays separate, like pact slots. */
const FULL_CASTERS = new Set(["influencer", "ordinator", "shutin", "sourcecoder", "techwizard"]);
const HALF_CASTERS = new Set(["enforcer", "auditor", "mechanist"]);

const MULTICLASS_SLOTS = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

export const SOURCE_SLOT_COST = [0, 2, 3, 5, 6, 7];

export function cyberdeckSize(wizardLevel: number) {
  if (wizardLevel <= 0) return 0;
  return 6 + (wizardLevel - 1) * 2;
}

export function lineageGrantsFeat(lineageId: string | null, option: string | null, bonusFeat: boolean) {
  if (lineageId === "race:new-human") return option === "Specialized Predisposition";
  return bonusFeat;
}

/** Wiki ability-score patterns. Splicer is not the usual +2-or-two-+1 flex increase. */
export function lineageAsiMode(lineage: { id: string; asi: string }) {
  if (lineage.id === "race:splicer") return "splicer";
  return lineage.asi;
}

export function asiAssignmentOk(mode: string, bonuses: Partial<Record<Ability, number>>) {
  const amounts = ABILITIES.map((ability) => bonuses[ability] ?? 0).filter((amount) => amount > 0);
  const twos = amounts.filter((amount) => amount === 2).length;
  const ones = amounts.filter((amount) => amount === 1).length;
  if (amounts.some((amount) => amount !== 1 && amount !== 2)) return false;
  if (mode === "plus1") return ones === 1 && twos === 0;
  if (mode === "plus2") return twos === 1 && ones === 0;
  if (mode === "plus1plus1") return ones === 2 && twos === 0;
  if (mode === "flex") return (twos === 1 && ones === 0) || (ones === 2 && twos === 0);
  if (mode === "spread") return (twos === 1 && ones === 1) || (ones === 3 && twos === 0);
  if (mode === "splicer") return (twos === 2 && ones === 0) || (twos === 1 && ones === 2);
  if (mode === "none" || mode === "unknown") return amounts.length === 0;
  return false;
}

export function assignPooledScore(scores: Record<Ability, number>, ability: Ability, value: number) {
  const next = { ...scores };
  const other = ABILITIES.find((candidate) => candidate !== ability && next[candidate] === value);
  if (other) next[other] = next[ability];
  next[ability] = value;
  return next;
}

/** Keep class levels adding up to the character level. The edited class keeps its request when another class can absorb the difference. */
export function fitClassLevels(entries: ClassLevel[], total: number, editedId?: string): ClassLevel[] {
  const level = Math.max(1, total);
  if (!entries.length) return [];
  const next = entries.map((entry) => ({ ...entry, level: Math.max(1, Math.min(level, entry.level || 1)) }));
  if (next.length === 1) {
    next[0].level = level;
    return next;
  }
  const locked = editedId ? next.find((entry) => entry.id === editedId) : undefined;
  if (locked) locked.level = Math.max(1, Math.min(level - (next.length - 1), locked.level));
  let guard = 0;
  while (next.reduce((sum, entry) => sum + entry.level, 0) !== level && guard < 40) {
    guard += 1;
    const sum = next.reduce((totalLevels, entry) => totalLevels + entry.level, 0);
    const delta = level - sum;
    const target = next.find((entry) => entry.id !== editedId && (delta > 0 || entry.level > 1))
      ?? next.find((entry) => delta > 0 || entry.level > 1);
    if (!target) break;
    target.level += Math.sign(delta);
  }
  return next;
}

export function addClassLevel(entries: ClassLevel[], classId: string, total: number): ClassLevel[] | null {
  if (entries.some((entry) => entry.id === classId)) return entries;
  if (!entries.length) return [{ id: classId, level: Math.max(1, total), subclassId: null }];
  const draft = entries.map((entry) => ({ ...entry }));
  const donor = draft.find((entry) => entry.level > 1);
  if (!donor) return null;
  donor.level -= 1;
  draft.push({ id: classId, level: 1, subclassId: null });
  return fitClassLevels(draft, total);
}

export const FIGHTING_STYLES: Record<string, string[]> = {
  enforcer: ["Blind Fighting", "Defense", "Dueling", "Great Weapon Fighting", "Gun-Fu", "Interception", "Mariner", "Ordained Warrior", "Protection", "Thrown Weapon Fighting", "Unarmed Fighting"],
  auditor: ["Blind Fighting", "Defense", "Dueling", "Gun-Fu", "Introvert", "Mariner", "Marksmanship", "Pugilism", "Thrown Weapon Fighting", "Two-Weapon Fighting"],
  ronin: ["Blind Fighting", "Defense", "Dueling", "Great Weapon Fighting", "Gun-Fu", "Interception", "Mariner", "Marksmanship", "Protection", "Pugilism", "Riot Fighting", "Tactical Technique", "Thrown Weapon Fighting", "Two-Weapon Fighting"],
  pretender: ["Blind Fighting", "Clobbering Swing", "Dancing Thorns", "Dueling", "Great Weapon Fighting", "Gun-Fu", "Marksmanship", "Riot Fighting", "Thrown Weapon Fighting", "Two-Weapon Fighting", "Unarmed Fighting"],
};

export function trickAllowance(styles: string[], tricksMax: number, techs: { trick: boolean; level: number | null; classes: string[] }[], ownClassIds: string[]) {
  const bonusLists = [styles.includes("Ordained Warrior") ? "ordinator" : "", styles.includes("Introvert") ? "shutin" : ""].filter(Boolean);
  const own = new Set(ownClassIds);
  const isBonusOnly = (tech: { classes: string[] }) => tech.classes.some((id) => bonusLists.includes(id)) && !tech.classes.some((id) => own.has(id));
  const tricks = techs.filter((tech) => tech.trick || tech.level === 0);
  const bonusUsed = Object.fromEntries(bonusLists.map((id) => [id, tricks.filter((tech) => isBonusOnly(tech) && tech.classes.includes(id)).length]));
  const bonusTotal = Object.values(bonusUsed).reduce((sum, count) => sum + count, 0);
  return {
    bonusLists,
    ownCap: Math.max(0, tricksMax - bonusLists.length * 2),
    ownUsed: tricks.length - bonusTotal,
    bonusCap: 2,
    bonusUsed,
    isBonusOnly,
  };
}

export function classNeedsFightingStyle(cls: ClassDef, level: number) {
  return hasFeature(cls, level, "fighting style") && Boolean(FIGHTING_STYLES[cls.id]);
}

export function cyberStatOptions(id: string): Ability[] | null {
  const family = CYBER_FAMILIES.find((row) => row.ids.includes(id));
  return family ? family.pool : null;
}

export function cyberNeedsSkill(id: string) {
  return id === "cybernetic:skill-chip" || id === "cybernetic:datamatrix";
}

const BONUS_TECHS: Record<string, { id: string; note: string }[]> = {
  auditor: [{ id: "tech:bug", note: "Auditor feature. No concentration, and twice per long rest without a tech slot." }],
};

export function bonusTechOffers(entries: ClassLevel[]) {
  return entries.flatMap((entry) => BONUS_TECHS[entry.id] ?? []);
}

function sumBonuses(parts: Partial<Record<Ability, number>>[]) {
  const total = blankScores();
  for (const ability of ABILITIES) total[ability] = 0;
  for (const part of parts) {
    for (const ability of ABILITIES) total[ability] += part[ability] ?? 0;
  }
  return total;
}

const CYBER_FAMILIES: { ids: string[]; bonus: number[]; cap: number[]; pool: Ability[] }[] = [
  { ids: ["cybernetic:biomod", "cybernetic:biomod-plus", "cybernetic:biomod-xl"], bonus: [2, 4, 6], cap: [20, 22, 24], pool: ["str", "dex", "con"] },
  { ids: ["cybernetic:neuromod", "cybernetic:neuromod-plus", "cybernetic:neuromod-xl"], bonus: [2, 4, 6], cap: [20, 22, 24], pool: ["int", "wis", "cha"] },
];

function cyberValue(id: string) {
  for (const family of CYBER_FAMILIES) {
    const index = family.ids.indexOf(id);
    if (index >= 0) return 100 + index;
  }
  return 1;
}

export function techAbilityOf(cls: ClassDef | null, sub: SubclassDef | null): Ability | null {
  if (cls?.techAbility) return cls.techAbility;
  if (sub && (sub.id.endsWith("hacktivist") || sub.id.endsWith("technoblade"))) return "int";
  return null;
}

export function castingProfile(cls: ClassDef, sub: SubclassDef | null, level: number) {
  const row = levelRow(cls, level);
  let slots = [...(row?.slots ?? zeros())];
  let tricks = row?.tricks ?? 0;
  let known = row?.techsKnown ?? null;
  const baseHasSlots = slots.some((n) => n > 0);
  if (sub?.techProgression && !baseHasSlots) {
    const subRow = [...sub.techProgression].reverse().find((entry) => entry.level <= level);
    if (subRow) {
      slots = [...subRow.slots];
      tricks = subRow.tricks ?? tricks;
      known = subRow.techsKnown ?? known;
    } else {
      slots = zeros();
      tricks = 0;
      known = 0;
    }
  }
  return { slots, tricks, known, pactSlots: row?.pactSlots ?? null, pactLevel: row?.pactLevel ?? null };
}

function isThirdCaster(entry: ClassLevel) {
  return (entry.id === "ronin" && entry.subclassId === "ronin:technoblade") || (entry.id === "outlaw" && entry.subclassId === "outlaw:hacktivist");
}

function contributesCasterLevels(entry: ClassLevel) {
  return FULL_CASTERS.has(entry.id) || HALF_CASTERS.has(entry.id) || isThirdCaster(entry);
}

function casterContribution(entry: ClassLevel) {
  if (FULL_CASTERS.has(entry.id)) return entry.level;
  if (HALF_CASTERS.has(entry.id)) return Math.floor(entry.level / 2);
  if (isThirdCaster(entry)) return Math.floor(entry.level / 3);
  return 0;
}

function parseAcFormula(formula: string, dex: number, replacement: number | null) {
  const text = formula.toLowerCase();
  const base = Number(text.match(/-?\d+/)?.[0] ?? 10);
  if (!text.includes("dex") && !text.includes("modifier")) return base;
  const cap = text.match(/max\.?\s*(\d+)/);
  let bonus = replacement ?? dex;
  if (cap) bonus = Math.min(bonus, Number(cap[1]));
  return base + bonus;
}

function weaponProficient(text: string, name: string, category: string) {
  const compact = text.replace(/[^a-z]/g, "");
  const weapon = name.toLowerCase().replace(/[^a-z]/g, "");
  if (weapon && compact.includes(weapon)) return true;
  if (category.startsWith("civilian") && text.includes("civilian")) return true;
  if (category.startsWith("military") && text.includes("military")) return true;
  if (category === "explosive" && text.includes("military")) return true;
  if (category === "explosive" && (text.includes("grenade") || text.includes("explosive"))) return true;
  return false;
}

function extraAttacks(cls: ClassDef, level: number) {
  let extra = 0;
  for (const row of cls.levels) {
    if (row.level > level) break;
    for (const feature of row.features) {
      const match = feature.match(/extra attack(?:\s*\(x(\d+)\))?/i);
      if (match) extra = Math.max(extra, match[1] ? Number(match[1]) : 1);
    }
  }
  return extra;
}

export interface AttackLine {
  name: string;
  toHit: number;
  damage: string;
  proficient: boolean;
  notes: string;
}

export interface Derived {
  scores: Record<Ability, number>;
  mods: Record<Ability, number>;
  pb: number;
  rank: string;
  mpToNext: number | null;
  mpTotalForLevel: number | null;
  hp: number;
  hitDie: string;
  hitDicePool: string;
  ac: number;
  acNotes: string[];
  initiative: number;
  speed: number;
  size: string;
  saves: { ability: Ability; name: string; mod: number; proficient: boolean }[];
  skills: { name: string; ability: Ability; mod: number; proficient: boolean; expertise: boolean; disadvantage: boolean }[];
  passivePerception: number;
  attacks: AttackLine[];
  attackCount: number;
  features: string[];
  resources: Record<string, string>;
  slots: number[];
  pactSlots: number;
  pactLevel: number | null;
  tricksMax: number;
  techsKnownMax: number | null;
  preparedMax: number | null;
  deckMax: number;
  techAbility: Ability | null;
  techDc: number | null;
  techAttack: number | null;
  styleNotes: string[];
  traitNotes: string[];
  movement: string;
  carryMultiplier: number;
  grantedTechIds: string[];
  grantedTechNotes: GrantedTechNote[];
  bonusOffers: { id: string; note: string }[];
  cyberLimit: number;
  cyberOverflow: boolean;
  expertiseCap: number;
  classLabels: string;
  proficiencyText: string;
  sourcePoints: number;
  warnings: string[];
  featAsiNotes: string[];
}

export function derive(raw: Character, rules: Rules): Derived {
  const character = normalizeCharacter(raw);
  const entries = classEntries(character);
  const classes = entries.map((entry) => ({ entry, cls: findClass(rules, entry.id), sub: findSubclass(rules, entry.subclassId) })).filter((row) => row.cls);
  const primary = classes[0];
  const cls = primary?.cls ?? null;
  const lineage = rules.lineages.find((item) => item.id === character.lineageId) ?? null;
  const upbringing = rules.upbringings.find((item) => item.id === character.upbringingId) ?? null;
  const level = Math.max(1, entries.reduce((sum, entry) => sum + entry.level, 0) || character.level);
  const warnings: string[] = [];
  const styles = new Set(character.fightingStyles ?? []);
  if (character.defenseStyle) styles.add("Defense");
  const traits = activeTraits(character);

  const asi = sumBonuses(character.asiPicks.filter((pick) => pick.mode === "asi").map((pick) => pick.abilities ?? {}));
  const featAsi = sumBonuses(character.asiPicks.filter((pick) => pick.mode === "feat").map((pick) => pick.abilities ?? {}));
  const featAsiNotes = character.asiPicks.flatMap((pick) => {
    if (pick.mode !== "feat" || !pick.abilities) return [];
    const featName = rules.feats.find((feat) => feat.id === pick.featId)?.name ?? "Feat";
    return ABILITIES.filter((ability) => pick.abilities?.[ability]).map((ability) => `${featName}: ${ABILITY_NAME[ability]} +${pick.abilities?.[ability]} (maximum 20 before cybernetics)`);
  });
  const preCyber = blankScores();
  for (const ability of ABILITIES) {
    const total = (character.baseScores[ability] ?? 10) + (character.lineageAsi[ability] ?? 0) + (character.subAsi[ability] ?? 0) + asi[ability] + featAsi[ability];
    preCyber[ability] = Math.min(20, total);
  }

  const pb = proficiencyBonus(null, level);
  const rankedCyber = [...character.cybernetics].sort((a, b) => cyberValue(b.id) - cyberValue(a.id));
  const activeCyber = rankedCyber.slice(0, pb);
  if (character.cybernetics.length > pb) warnings.push(`Cybernetics are limited to your proficiency bonus (${pb}). The highest-tier installs are the ones that apply.`);

  const scores = { ...preCyber };
  for (const family of CYBER_FAMILIES) {
    let best = -1;
    let chosen: Ability | undefined;
    activeCyber.forEach((install) => {
      const index = family.ids.indexOf(install.id);
      if (index > best && install.stat && family.pool.includes(install.stat)) {
        best = index;
        chosen = install.stat;
      } else if (index >= 0 && !install.stat) {
        warnings.push(`${install.id.replace("cybernetic:", "")} is installed with no ability chosen, so it does not change a score.`);
      }
    });
    if (best >= 0 && chosen) scores[chosen] = Math.min(family.cap[best], scores[chosen] + family.bonus[best]);
  }
  const mods = blankScores();
  for (const ability of ABILITIES) mods[ability] = modifier(scores[ability]);

  const skillChip = activeCyber.find((install) => install.id === "cybernetic:skill-chip");
  const matrix = activeCyber.find((install) => install.id === "cybernetic:datamatrix");
  if (skillChip && !skillChip.skill) warnings.push("Skill Chip needs a skill before it adds +2.");
  if (matrix && !matrix.skill) warnings.push("Datamatrix needs a proficient skill before it grants expertise.");
  const profs = new Set([...character.skillProfs, ...(upbringing?.skills ?? []), ...traits.flatMap((trait) => trait.skill ? [trait.skill] : [])].map(skillKey));
  const expertise = new Set(character.skillExpertise.map(skillKey));
  if (matrix?.skill) expertise.add(skillKey(matrix.skill));
  const jack = classes.some((row) => row.cls && hasFeature(row.cls, row.entry.level, "jack of all trades"));

  const features = classes.flatMap((row) => (row.cls ? featuresThrough(row.cls, row.entry.level).map((name) => `${row.cls!.name}: ${name}`) : []));
  if (styles.size) features.push(`Fighting style: ${[...styles].join(", ")}`);
  const resources: Record<string, string> = {};
  classes.forEach((row) => {
    if (!row.cls) return;
    Object.assign(resources, levelRow(row.cls, row.entry.level).resources);
  });

  const armor = rules.armor.find((item) => item.id === character.armorId) ?? null;
  const wearingBody = Boolean(armor && armor.category !== "shield");
  const strNeed = Number(armor?.strength?.match(/(\d+)/)?.[1] ?? 0);
  const strengthShort = Boolean(wearingBody && strNeed && scores.str < strNeed);
  const armorStealth = Boolean(armor?.stealth?.toLowerCase().includes("disadvantage"));
  const dexDisadvantage = new Set(strengthShort ? ["acrobatics", "sleight of hand", "stealth"] : []);
  if (armorStealth) dexDisadvantage.add("stealth");

  const skills = rules.skills.map((skill) => {
    const key = skillKey(skill.id);
    const proficient = profs.has(key);
    const expert = proficient && expertise.has(key);
    let mod = mods[skill.ability];
    if (expert) mod += pb * 2;
    else if (proficient) mod += pb;
    else if (jack) mod += Math.floor(pb / 2);
    if (skillChip?.skill && skillKey(skillChip.skill) === key) mod += 2;
    if (key === "intimidation" && traits.some((trait) => trait.id.startsWith("minor:visage")) && mods.str > mods.cha) mod += mods.str - mods.cha;
    return { name: displaySkill(skill), ability: skill.ability, mod, proficient, expertise: expert, disadvantage: dexDisadvantage.has(key) };
  });

  const saveProfs = new Set(cls?.saves ?? []);
  const saves = ABILITIES.map((ability) => ({
    ability,
    name: ABILITY_NAME[ability],
    mod: mods[ability] + (saveProfs.has(ability) ? pb : 0) + (character.inspiration ? 0 : 0),
    proficient: saveProfs.has(ability),
  }));

  const tough = character.asiPicks.some((pick) => pick.featId === "feat:tough");
  let hp = 0;
  let firstLevel = true;
  const dice = new Map<number, number>();
  classes.forEach((row) => {
    if (!row.cls?.hitDie) return;
    for (let lv = 1; lv <= row.entry.level; lv++) {
      const die = firstLevel ? row.cls.hitDie : row.cls.hpAverage ?? Math.floor(row.cls.hitDie / 2) + 1;
      firstLevel = false;
      hp += Math.max(1, die + mods.con);
      dice.set(row.cls.hitDie, (dice.get(row.cls.hitDie) ?? 0) + 1);
    }
  });
  if (tough) hp += level * 2;
  if (character.lineageId === "race:jerboan" && character.sublineage === "Punk Rock Jerboan") hp += level;
  if (character.hpOverride != null) hp = character.hpOverride;

  const acNotes: string[] = [];
  const shield = character.shield || armor?.category === "shield";
  const unarmoredClass = classes.find((row) => row.cls?.unarmored)?.cls ?? null;
  let ac = 10 + mods.dex;
  const unarmoredOk = Boolean(unarmoredClass?.unarmored) && !wearingBody && (!shield || unarmoredClass?.unarmored?.allowsShield);
  if (wearingBody && armor?.ac) {
    const replacement = unarmoredClass?.unarmored?.lightArmorUses && armor.category === "light" ? mods[unarmoredClass.unarmored.lightArmorUses] : null;
    ac = parseAcFormula(armor.ac, mods.dex, replacement);
    if (armorStealth) acNotes.push("Disadvantage on Stealth");
    if (strengthShort) {
      const slow = character.lineageId === "race:jerboan" ? "" : "speed −10, ";
      acNotes.push(`Strength below ${strNeed}: ${slow}disadvantage on Acrobatics, Sleight of Hand, and Stealth`);
    }
    if (styles.has("Defense")) {
      const heavyDefense = armor.category === "heavy";
      ac += heavyDefense ? 2 : 1;
      acNotes.push(heavyDefense ? "Defense fighting style +2 in heavy armor" : "Defense fighting style +1");
    }
  } else if (unarmoredOk && unarmoredClass?.unarmored) {
    ac = unarmoredClass.unarmored.base + unarmoredClass.unarmored.abilities.reduce((sum, ability) => sum + mods[ability], 0);
    acNotes.push("Unarmored");
  }
  if (shield) {
    if (unarmoredClass?.unarmored && !unarmoredClass.unarmored.allowsShield && !wearingBody) {
      ac = 10 + mods.dex;
      acNotes.push("Shield replaces unarmored defense");
    }
    ac += 2;
  }
  if (styles.has("Mariner") && !shield && armor?.category !== "heavy") {
    ac += 1;
    acNotes.push("Mariner +1 while not in heavy armor or behind a shield");
  }
  if (traits.some((trait) => trait.naturalArmor)) {
    const natural = 13 + mods.dex + (shield ? 2 : 0);
    if (natural > ac) {
      ac = natural;
      acNotes.push("Natural armor 13 + Dexterity");
    }
  }

  let speed = lineage?.speed ?? 30;
  const move = resources["Unarmored Movement"];
  if (move && !wearingBody && !shield) {
    const bonus = Number(move.match(/(\d+)/)?.[1] ?? 0);
    if (bonus) speed += bonus;
  }
  if (strengthShort && character.lineageId !== "race:jerboan") speed = Math.max(0, speed - 10);
  for (const trait of traits) {
    if (trait.speedSet) speed = Math.max(speed, trait.speedSet);
  }
  for (const trait of traits) speed += trait.speedBonus ?? 0;

  const castingClasses = classes.filter((row) => row.cls && (row.cls.caster !== "none" || row.sub?.techProgression || contributesCasterLevels(row.entry)));
  const separateStreamer = castingClasses.filter((row) => row.entry.id === "streamer");
  const pooled = castingClasses.filter((row) => row.entry.id !== "streamer" && (contributesCasterLevels(row.entry) || row.cls?.caster !== "none" || row.sub?.techProgression));
  let slots = zeros();
  let pactSlots = 0;
  let pactLevel: number | null = null;
  let tricksMax = 0;
  let techsKnownMax: number | null = null;
  let preparedMax: number | null = null;
  let techAbility: Ability | null = null;

  if (separateStreamer.length === 1 && pooled.length === 0) {
    const only = separateStreamer[0];
    const cast = castingProfile(only.cls!, only.sub, only.entry.level);
    slots = cast.slots.map((count, index) => count + (character.bonusSlots[index] ?? 0));
    tricksMax = cast.tricks;
    techsKnownMax = cast.known;
    techAbility = techAbilityOf(only.cls!, only.sub);
  } else if (pooled.length <= 1 && separateStreamer.length === 0) {
    const only = pooled[0] ?? castingClasses[0];
    if (only?.cls) {
      const cast = castingProfile(only.cls, only.sub, only.entry.level);
      slots = cast.slots.map((count, index) => count + (character.bonusSlots[index] ?? 0));
      tricksMax = cast.tricks;
      techsKnownMax = cast.known;
      techAbility = techAbilityOf(only.cls, only.sub);
      if (only.cls.prepared && techAbility) {
        preparedMax = Math.max(only.cls.prepared.minimum, mods[only.cls.prepared.ability] + (only.cls.prepared.halfLevel ? Math.floor(only.entry.level / 2) : only.entry.level));
      }
    }
  } else if (pooled.length === 1 && separateStreamer.length > 0) {
    const only = pooled[0];
    const cast = castingProfile(only.cls!, only.sub, only.entry.level);
    slots = cast.slots.map((count, index) => count + (character.bonusSlots[index] ?? 0));
    tricksMax += cast.tricks;
    techsKnownMax = cast.known;
    techAbility = techAbilityOf(only.cls!, only.sub);
    if (only.cls!.prepared && only.cls!.techAbility) {
      preparedMax = Math.max(only.cls!.prepared.minimum, mods[only.cls!.prepared.ability] + (only.cls!.prepared.halfLevel ? Math.floor(only.entry.level / 2) : only.entry.level));
    }
  } else if (pooled.length > 1) {
    const casterLevel = Math.min(20, pooled.reduce((sum, row) => sum + casterContribution(row.entry), 0));
    slots = MULTICLASS_SLOTS[casterLevel].map((count, index) => count + (character.bonusSlots[index] ?? 0));
    pooled.forEach((row) => {
      const cast = castingProfile(row.cls!, row.sub, row.entry.level);
      tricksMax += cast.tricks;
      if (cast.known) techsKnownMax = (techsKnownMax ?? 0) + cast.known;
      techAbility = techAbility ?? techAbilityOf(row.cls!, row.sub);
      if (row.cls!.prepared && row.cls!.techAbility) {
        const max = Math.max(row.cls!.prepared.minimum, mods[row.cls!.prepared.ability] + (row.cls!.prepared.halfLevel ? Math.floor(row.entry.level / 2) : row.entry.level));
        preparedMax = (preparedMax ?? 0) + max;
      }
    });
  }
  if (separateStreamer.length && pooled.length > 0) {
    const stream = separateStreamer[0];
    const cast = castingProfile(stream.cls!, stream.sub, stream.entry.level);
    const levelIndex = cast.slots.findIndex((count) => count > 0);
    pactSlots = levelIndex >= 0 ? cast.slots[levelIndex] : 0;
    pactLevel = levelIndex >= 0 ? levelIndex + 1 : null;
    tricksMax += cast.tricks;
    if (cast.known) techsKnownMax = (techsKnownMax ?? 0) + cast.known;
  }

  const wizard = classes.find((row) => row.entry.id === "techwizard");
  const deckMax = wizard ? cyberdeckSize(wizard.entry.level) : 0;
  const grantedTechNotes = collectGrantedTechs(rules, character);
  const grantedTechIds = [...new Set(grantedTechNotes.map((note) => note.id))];
  const profText = classes.map((row, index) => {
    if (!row.cls) return "";
    if (index === 0) return `${row.cls.armor} ${row.cls.weapons} ${row.cls.tools}`;
    return MULTICLASS_PROFICIENCIES[row.entry.id] ?? "";
  }).join("; ");

  const thrownStyle = styles.has("Thrown Weapon Fighting")
    ? (classes.some((row) => row.entry.id === "enforcer") && !classes.some((row) => ["ronin", "auditor", "pretender"].includes(row.entry.id)) ? 1 : 2)
    : 0;
  const meleeWeapons = character.weapons.filter((equipped) => {
    const weapon = rules.weapons.find((item) => item.id === equipped.id);
    return Boolean(weapon && weapon.category.includes("melee") && !(weapon.properties ?? "").toLowerCase().includes("two-handed"));
  });
  let meleeSeen = 0;
  const attacks: AttackLine[] = character.weapons.flatMap((equipped) => {
    const weapon = rules.weapons.find((item) => item.id === equipped.id);
    if (!weapon) return [{ name: equipped.id, toHit: 0, damage: "—", proficient: false, notes: "Missing from the weapons table" }];
    const properties = (weapon.properties ?? "").toLowerCase();
    const finesse = properties.includes("finesse");
    const ranged = weapon.category.includes("ranged") || properties.includes("ammunition");
    const ability = equipped.ability ?? (finesse ? (mods.dex >= mods.str ? "dex" : "str") : ranged ? "dex" : "str");
    const proficient = weaponProficient(profText.toLowerCase(), weapon.name, weapon.category);
    const dice = weapon.damage?.match(/\d+d\d+(?:\s*\+\s*\d+)?|\d+/)?.[0] ?? weapon.damage ?? "—";
    const dtype = weapon.damage?.replace(dice, "").trim() ?? "";
    const twoHanded = properties.includes("two-handed") || properties.includes("two handed");
    const versatile = properties.includes("versatile");
    const melee = weapon.category.includes("melee") && !twoHanded;
    meleeSeen += melee ? 1 : 0;
    const offHand = melee && meleeSeen > 1 && meleeWeapons.length > 1;
    let damageMod = offHand && !styles.has("Two-Weapon Fighting") ? 0 : mods[ability];
    const notes = [properties];
    if (offHand) notes.push(styles.has("Two-Weapon Fighting") ? "off-hand, ability modifier" : "off-hand, no ability modifier");
    if (styles.has("Dueling") && character.weapons.length === 1 && melee) {
      damageMod += 2;
      notes.push("dueling +2");
    }
    if ((twoHanded || versatile) && melee && styles.has("Great Weapon Fighting")) notes.push("reroll a damage die of 1 or 2");
    let toHit = mods[ability] + (proficient ? pb : 0);
    if (styles.has("Marksmanship") && ranged && twoHanded) {
      toHit += 2;
      notes.push("marksmanship +2");
    }
    if (styles.has("Gun-Fu") && ranged && !twoHanded) {
      toHit += 1;
      notes.push("gun-fu +1");
    }
    const row: AttackLine = { name: weapon.name, toHit, damage: `${dice}${formatMod(damageMod)} ${dtype}`.trim(), proficient, notes: notes.filter(Boolean).join("; ") };
    if (!properties.includes("thrown") || !thrownStyle) return [row];
    const thrownAbility = finesse && mods.dex >= mods.str ? "dex" : "str";
    const thrownHit = mods[thrownAbility] + (proficient ? pb : 0);
    return [row, {
      name: `${weapon.name} (thrown)`,
      toHit: thrownHit,
      damage: `${dice}${formatMod(mods[thrownAbility] + thrownStyle)} ${dtype}`.trim(),
      proficient,
      notes: `thrown +${thrownStyle}`,
    }];
  });
  if (styles.has("Unarmed Fighting") || styles.has("Pugilism")) {
    const handsFree = character.weapons.length === 0 && !character.shield;
    const die = handsFree ? "1d8" : "1d6";
    attacks.push({ name: "Unarmed strike", toHit: mods.str + pb, damage: `${die}${formatMod(mods.str)} bludgeoning`, proficient: true, notes: handsFree ? "both hands free" : "one hand occupied" });
  }
  for (const trait of traits) {
    if (!trait.naturalWeapon) continue;
    const ability = traitAbility(trait, mods);
    attacks.push({
      name: trait.naturalWeapon.name,
      toHit: mods[ability] + pb,
      damage: `${trait.naturalWeapon.dice}${formatMod(mods[ability])} ${trait.naturalWeapon.type}`,
      proficient: true,
      notes: trait.name,
    });
  }
  const styleNotes: string[] = [];
  if (styles.has("Blind Fighting")) styleNotes.push("Blindsight 10 ft.");
  if (styles.has("Interception")) styleNotes.push(`Interception: reduce one hit by 1d10+${pb}.`);
  if (styles.has("Protection")) styleNotes.push("Protection: reaction, disadvantage on an attack against an ally within 5 ft. while you have a shield.");
  if (styles.has("Mariner") && !character.shield && armor?.category !== "heavy") styleNotes.push(`Swim and climb ${speed} ft.`);
  if (styles.has("Tactical Technique")) styleNotes.push("One superiority die (d6).");
  if (styles.has("Ordained Warrior")) styleNotes.push("Two ordinator tricks, cast with Charisma.");
  if (styles.has("Introvert")) styleNotes.push("Two shut-in tricks, cast with Wisdom.");
  if (styles.has("Riot Fighting")) styleNotes.push("Riot Fighting: bonus-action defensive stance.");
  if (styles.has("Clobbering Swing")) styleNotes.push("Clobbering Swing: splash your modifier on a second target when you have advantage.");
  if (styles.has("Dancing Thorns")) styleNotes.push("Dancing Thorns: a near-crit with advantage can become a critical hit.");
  const traitNotes = [...traits.flatMap((trait) => {
    const lines = [trait.note, trait.resistance ? `Resistance: ${trait.resistance}` : "", trait.tool ? `Tool: ${trait.tool}` : ""].filter((line): line is string => Boolean(line));
    return lines;
  }), ...borrowedNotes(character.lineagePicks ?? [], rules.lineages)];
  if (styles.has("Ordained Warrior") || styles.has("Introvert")) tricksMax += 2;

  const perception = skills.find((skill) => skillKey(skill.name) === "perception");
  const mp = rankFor(rules, level);
  const sourceRaw = Number(resources["Source Points"]?.match(/\d+/)?.[0] ?? 0);
  const techMod = techAbility ? mods[techAbility] : null;
  const attackCount = 1 + Math.max(0, ...classes.map((row) => (row.cls ? extraAttacks(row.cls, row.entry.level) : 0)));

  return {
    scores,
    mods,
    pb,
    rank: mp?.rank ?? "—",
    mpToNext: mp?.mpToNext ?? null,
    mpTotalForLevel: mp?.totalMp ?? null,
    hp,
    hitDie: cls?.hitDie ? `d${cls.hitDie}` : "—",
    hitDicePool: [...dice.entries()].map(([die, count]) => `${count}d${die}`).join(" + ") || "—",
    ac,
    acNotes,
    initiative: mods.dex + (traits.some((trait) => trait.initiative === "pb") ? pb : 0),
    speed,
    size: lineage?.size ?? "Medium",
    saves,
    skills,
    passivePerception: 10 + (perception?.mod ?? mods.wis),
    attacks,
    attackCount,
    features,
    resources,
    slots,
    pactSlots,
    pactLevel,
    tricksMax,
    techsKnownMax,
    preparedMax,
    deckMax,
    techAbility,
    techDc: techMod == null ? null : 8 + pb + techMod,
    techAttack: techMod == null ? null : pb + techMod,
    styleNotes,
    traitNotes,
    movement: [`${speed} ft. walk`, ...traits.flatMap((trait) => [trait.swim ? `${speed} ft. swim` : "", trait.climb === "speed" ? `${speed} ft. climb` : typeof trait.climb === "number" ? `${trait.climb} ft. climb` : ""]), ...styleNotes.filter((note) => note.startsWith("Swim"))].filter(Boolean).join(", "),
    carryMultiplier: traits.reduce((factor, trait) => factor * (trait.carryMultiplier ?? 1), 1),
    grantedTechIds,
    grantedTechNotes,
    bonusOffers: bonusTechOffers(entries),
    cyberLimit: pb,
    cyberOverflow: character.cybernetics.length > pb,
    expertiseCap: classes.reduce((sum, row) => sum + expertiseCap(row.cls, row.entry.level), 0),
    classLabels: classes.map((row) => `${row.cls?.name} ${row.entry.level}`).join(" / ") || "—",
    proficiencyText: [profText, ...traits.flatMap((trait) => trait.tool ? [trait.tool] : [])].filter(Boolean).join("; "),
    sourcePoints: Math.max(0, sourceRaw - character.sourcePointsSpent),
    warnings,
    featAsiNotes,
  };
}

function displaySkill(skill: SkillDef) {
  const names: Record<string, string> = { "animal handling": "Animal Handling", "sleight of hand": "Sleight of Hand" };
  return names[skill.id] ?? skill.id.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function classSkillOptions(cls: ClassDef, rules: Rules) {
  if (cls.skillOptions.includes("*")) return rules.skills.map((skill) => displaySkill(skill));
  return cls.skillOptions;
}

function tableUnlock(cls: ClassDef, sub: SubclassDef | null, slotIndex: number | "trick"): number | null {
  if (slotIndex === "trick") {
    const row = cls.levels.find((entry) => (entry.tricks ?? 0) > 0);
    if (row) return row.level;
    return sub?.techProgression?.find((entry) => (entry.tricks ?? 0) > 0)?.level ?? null;
  }
  const classHasSlots = cls.levels.some((entry) => entry.slots.some((count) => count > 0) || (entry.pactSlots ?? 0) > 0);
  if (!classHasSlots && sub?.techProgression) {
    return sub.techProgression.find((entry) => (entry.slots[slotIndex] ?? 0) > 0)?.level ?? null;
  }
  const row = cls.levels.find((entry) => (entry.slots[slotIndex] ?? 0) > 0 || ((entry.pactLevel ?? 0) >= slotIndex + 1 && (entry.pactSlots ?? 0) > 0));
  if (row) return row.level;
  return sub?.techProgression?.find((entry) => (entry.slots[slotIndex] ?? 0) > 0)?.level ?? null;
}

/** Whether this runner can learn a trick or a tech of this level, and the wiki level that unlocks it. */
export function techLevelAccess(rules: Rules, character: Character, slots: number[], pactLevel: number | null, tricksMax: number) {
  const entries = classEntries(character);
  const casters = entries.map((entry) => ({ entry, cls: findClass(rules, entry.id), sub: findSubclass(rules, entry.subclassId) })).filter((row) => row.cls);
  const pooled = casters.filter((row) => row.entry.id !== "streamer" && (FULL_CASTERS.has(row.entry.id) || HALF_CASTERS.has(row.entry.id) || ((row.entry.id === "ronin" && row.entry.subclassId === "ronin:technoblade") || (row.entry.id === "outlaw" && row.entry.subclassId === "outlaw:hacktivist"))));
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
    if (level === 0) {
      if (tricksMax > 0) return { level, open: true, reason: "" };
      const soon = casters.map((row) => ({ name: row.cls!.name, at: tableUnlock(row.cls!, row.sub, "trick") })).filter((row) => row.at);
      const next = soon.sort((a, b) => (a.at ?? 99) - (b.at ?? 99))[0];
      return { level, open: false, reason: next ? `Unlocks at ${next.name} ${next.at}` : "This class has no tricks." };
    }
    const open = (slots[level - 1] ?? 0) > 0 || (pactLevel != null && level <= pactLevel);
    if (open) return { level, open: true, reason: "" };
    if (pooled.length > 1) {
      const needed = MULTICLASS_SLOTS.findIndex((row) => (row[level - 1] ?? 0) > 0);
      return { level, open: false, reason: needed > 0 ? `Unlocks at combined caster level ${needed}` : "No class table grants this tech level." };
    }
    const owner = casters.find((row) => tableUnlock(row.cls!, row.sub, level - 1) != null) ?? casters[0];
    const at = owner?.cls ? tableUnlock(owner.cls, owner.sub, level - 1) : null;
    if (owner?.cls && at) return { level, open: false, reason: `Unlocks at ${owner.cls.name} ${at}` };
    if (owner?.entry.id === "streamer") return { level, open: false, reason: "Streamer gifted tech ends at 5th level." };
    return { level, open: false, reason: "No class table grants this tech level." };
  });
}

export function techListFor(rules: Rules, cls: ClassDef | null, sub: SubclassDef | null) {
  if (!cls) return [];
  const listId = sub && sub.techProgression ? sub.listId : cls.id;
  const sectors = sub?.sectors ?? [];
  return rules.techs.filter((tech) => {
    const lists = tech.classes ?? [];
    if (!lists.includes(listId) && !lists.includes(cls.id)) return false;
    if (sectors.length && tech.sector && !sectors.includes(tech.sector)) return false;
    if (sectors.length && !tech.sector) return false;
    return true;
  });
}

export interface ClassTechBudget {
  tricks: number;
  techs: number;
  prepared: number | null;
  mode: "known" | "prepared" | "deck";
}

export interface GrantedTechNote {
  id: string;
  classId: string;
  source: string;
  name: string;
}

/** Feats that name a specific trick or tech. These are added for free once the feat is taken. */
const NAMED_FEAT_TECHS: Record<string, string[]> = {
  "feat:helping-hand-hacker": ["tech:hovering-helping-hand"],
  "feat:ghetto-go-getter": ["tech:physical-cloaking"],
};

/** Feats that give extra picks. The picks do not spend the class table's trick or tech count. */
export const FEAT_TECH_CHOICES: Record<string, { tricks: number; techs: number; maxLevel: number }> = {
  "feat:gifted-techcaster": { tricks: 0, techs: 4, maxLevel: 7 },
  "feat:hacker-wannabe": { tricks: 2, techs: 1, maxLevel: 1 },
  "feat:mechanist-wannabe": { tricks: 1, techs: 1, maxLevel: 1 },
  "feat:boosted-wifi": { tricks: 1, techs: 0, maxLevel: 0 },
  "feat:ghetto-go-getter": { tricks: 0, techs: 1, maxLevel: 1 },
};

/** Tricks and techs this class can learn at this level, from its wiki table. */
export function classTechBudget(cls: ClassDef, sub: SubclassDef | null, level: number, abilityMod: number): ClassTechBudget {
  const cast = castingProfile(cls, sub, level);
  const tricks = cast.tricks ?? 0;
  if (cls.id === "techwizard") {
    const prepared = Math.max(cls.prepared?.minimum ?? 1, abilityMod + level);
    return { tricks, techs: cyberdeckSize(level), prepared, mode: "deck" };
  }
  if (cast.known == null && cls.prepared) {
    const prepared = Math.max(cls.prepared.minimum, abilityMod + (cls.prepared.halfLevel ? Math.floor(level / 2) : level));
    return { tricks, techs: prepared, prepared, mode: "prepared" };
  }
  return { tricks, techs: cast.known ?? 0, prepared: null, mode: "known" };
}

/** Levels this one class can learn, as if it were the only class. */
export function classLevelAccess(cls: ClassDef, sub: SubclassDef | null, classLevel: number) {
  const cast = castingProfile(cls, sub, classLevel);
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
    if (level === 0) {
      if ((cast.tricks ?? 0) > 0) return { level, open: true, reason: "" };
      const at = tableUnlock(cls, sub, "trick");
      return { level, open: false, reason: at ? `Unlocks at ${cls.name} ${at}` : "This class has no tricks." };
    }
    const open = (cast.slots[level - 1] ?? 0) > 0 || (cast.pactLevel != null && level <= cast.pactLevel && (cast.pactSlots ?? 0) > 0);
    if (open) return { level, open: true, reason: "" };
    const at = tableUnlock(cls, sub, level - 1);
    if (cls.id === "streamer" && at == null) return { level, open: false, reason: "Streamer gifted tech ends at 5th level." };
    if (at) return { level, open: false, reason: `Unlocks at ${cls.name} ${at}` };
    return { level, open: false, reason: "No class table grants this tech level." };
  });
}

/** Always-prepared and bonus tricks and techs that do not spend a class pick. */
export function collectGrantedTechs(rules: Rules, character: Character): GrantedTechNote[] {
  const notes: GrantedTechNote[] = [];
  const seen = new Set<string>();
  const add = (id: string, classId: string, source: string, name?: string) => {
    const key = `${classId}|${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    notes.push({ id, classId, source, name: name || rules.techs.find((tech) => tech.id === id)?.name || id });
  };
  for (const entry of classEntries(character)) {
    const cls = findClass(rules, entry.id);
    const sub = findSubclass(rules, entry.subclassId);
    if (!cls) continue;
    for (const block of sub?.grantedTechs ?? []) {
      if (block.level > entry.level) continue;
      block.techIds.forEach((id, index) => add(id, entry.id, `Granted by ${sub!.name} at level ${block.level}`, block.names[index]));
    }
    for (const bonus of BONUS_TECHS[entry.id] ?? []) add(bonus.id, entry.id, `Granted by ${cls.name} at level 1`);
  }
  const lineage = rules.lineages.find((item) => item.id === character.lineageId);
  for (const pick of character.lineagePicks ?? []) {
    if (!pick.startsWith("bonus-tech:")) continue;
    const rest = pick.slice("bonus-tech:".length);
    const split = rest.indexOf(":");
    const id = split >= 0 ? rest.slice(split + 1) : "";
    if (id) add(id, "lineage", `Granted by ${lineage?.name ?? "lineage"}`);
  }
  for (const pick of character.asiPicks ?? []) {
    const ids = pick.featId ? NAMED_FEAT_TECHS[pick.featId] : undefined;
    if (!pick.featId || !ids) continue;
    const feat = rules.feats.find((item) => item.id === pick.featId);
    for (const id of ids) add(id, `feat:${pick.featId}`, `Granted by ${feat?.name ?? "a feat"}`);
  }
  return notes;
}

export function techPickCounts(picks: TechPick[], classId: string, catalog: { id: string; trick: boolean; level: number | null }[], grantIds: Set<string>) {
  let tricks = 0;
  let techs = 0;
  for (const pick of picks) {
    if (pick.classId !== classId || grantIds.has(pick.id)) continue;
    const tech = catalog.find((item) => item.id === pick.id);
    if (!tech) continue;
    if (tech.trick || !tech.level) tricks += 1;
    else techs += 1;
  }
  return { tricks, techs };
}

/** Older saves stored only tech ids. Assign each one to the first class whose list contains it. */
export function resolvedTechPicks(character: Character, rules: Rules): TechPick[] {
  if (character.techPicks?.length) return character.techPicks;
  const entries = classEntries(character);
  return character.techs.map((id) => {
    const owner = entries.find((entry) => techListFor(rules, findClass(rules, entry.id), findSubclass(rules, entry.subclassId)).some((tech) => tech.id === id));
    return { id, classId: owner?.id ?? entries[0]?.id ?? "" };
  });
}

export function creditsLabel(amount: number) {
  return `$${amount.toLocaleString("en-US")}`;
}
