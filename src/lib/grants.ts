import type { Ability, Character, ClassLevel, Rules, WeaponDef, WeaponEquip } from "./types";

function skillKey(name: string) {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Wiki-backed sheet bonuses. The Google Sheet is only a checklist.
 * These records follow the wiki. Nexus and Singularity do not add initiative.
 * Influencer chooses three skills. Outlaw chooses four. Tool names use the
 * wiki's Neon City list, not the old D&D names. Retired subclass names stay off this list.
 */
export interface SheetBonus {
  level: number;
  initiative?: Ability;
  /** When set, a negative modifier does not lower initiative. */
  initiativeMin?: number;
  initiativeAdvantage?: boolean;
  speed?: number;
  when?: "unarmored" | "not-heavy" | "not-medium-heavy";
  /** Scout: the walking bonus also raises a swim or climb speed you already have. */
  alsoSwimClimb?: boolean;
  swim?: number | "walk";
  climb?: number | "walk";
  burrow?: number;
  fly?: number;
  flyNote?: string;
  ac?: { base: number; abilities: Ability[]; dexMax?: number };
  stealthDisadvantage?: boolean;
  acHeavy?: number;
  hpPerClassLevel?: boolean;
  hpPerCharacterLevel?: boolean;
}

export interface SheetProficiency {
  level: number;
  skills?: string[];
  expertise?: string[];
  /** Gain the skill, or expertise in it when it is already known. */
  skillOrExpertise?: string;
  /** Gain the skill, or one of `from` when it is already known. */
  skillUnless?: { skill: string; from: string[] };
  skillChoice?: { count: number; from: string[] };
  tools?: string[];
  toolChoice?: { count: number; from: string[] };
  armor?: string[];
  weapons?: string[];
  weaponChoice?: { count: number; from: "one-handed-melee" | "otaku" };
  /** A category, such as land vehicles, rather than named picks. */
  vehicleCategory?: string;
  vehicleChoice?: number;
  languages?: number;
}

interface SheetRecord {
  bonuses?: SheetBonus[];
  proficiencies?: SheetProficiency[];
}

const ANY = ["*"];
const GAMES = ["Dice", "Cards", "Roulette", "Slots", "Mahjong", "Pool", "Video games"];
const TOOLS = ["Mechanic's Tools", "Electrician's Tools", "Hacker's Kit", "Programmer's Kit", "Microlab", "Disguise kit", "First aid kit", "Artist's Supplies", "Microbrewing Kit", "Locksmith's tools", "Builder's tools"];
const LANGUAGES = ["Spanish", "Mandarin", "Japanese", "Arabic", "Hindi", "French", "Portuguese", "Russian", "German", "Korean"];
const LAND = ["Dirt bike", "Hoverbike", "Hovermoped", "Motorcycle", "Motorhome", "Pickup truck", "Sedan", "Street scooter", "Van"];
const SURGE = ["Aqueous", "Gaseous", "Phased", "Plasmatic", "Solid"];

const CLASS_SHEETS: Record<string, SheetRecord> = {
  renegade: {
    bonuses: [
      { level: 5, speed: 10, when: "not-heavy" },
      { level: 7, initiativeAdvantage: true },
    ],
  },
};

const SUBCLASS_SHEETS: Record<string, SheetRecord> = {
  "auditor:dark-stalker": { bonuses: [{ level: 3, initiative: "wis" }] },
  "outlaw:swashbuckler": { bonuses: [{ level: 3, initiative: "cha" }] },
  "techwizard:bulwark": { bonuses: [{ level: 2, initiative: "int", initiativeMin: 0 }] },
  "techwizard:stasis-technician": { bonuses: [{ level: 2, initiative: "int", initiativeMin: 0 }] },
  "outlaw:scout": {
    bonuses: [{ level: 9, speed: 10, alsoSwimClimb: true }],
    proficiencies: [{ level: 3, skills: ["Nature", "Survival"], expertise: ["Nature", "Survival"], weapons: ["hunting bows"] }],
  },
  "streamer:hentaihub": { bonuses: [{ level: 1, swim: 40 }] },
  "sourcecoder:surge-splicer": {
    bonuses: [
      { level: 1, ac: { base: 13, abilities: ["dex"] }, hpPerClassLevel: true },
      { level: 14 },
    ],
  },
  "ordinator:industrialist": {
    bonuses: [{ level: 6, acHeavy: 1 }],
    proficiencies: [{ level: 1, armor: ["heavy armor"], tools: ["Mechanic's Tools"] }],
  },
  "brawler:drunken-fist": { proficiencies: [{ level: 3, skills: ["Performance"], tools: ["Microbrewing Kit"] }] },
  "brawler:north-star": { proficiencies: [{ level: 3, skills: ["Insight", "Medicine"], tools: ["First aid kit"] }] },
  "brawler:otaku": { proficiencies: [{ level: 3, tools: ["Artist's Supplies"], weaponChoice: { count: 2, from: "otaku" } }] },
  "brawler:rave": { proficiencies: [{ level: 3, skills: ["Performance"], tools: ["electronic musical instrument"] }] },
  "enforcer:disruptor": { proficiencies: [{ level: 3, skills: ["Technology"] }] },
  "influencer:activist": { proficiencies: [{ level: 3, armor: ["medium armor", "shields"], weapons: ["military weapons"] }] },
  "influencer:personal-trainer": { proficiencies: [{ level: 3, armor: ["medium armor"], skillOrExpertise: "Athletics" }] },
  "influencer:vlogger": { proficiencies: [{ level: 3, skillChoice: { count: 3, from: ANY } }] },
  "mechanist:armorer": { proficiencies: [{ level: 3, armor: ["heavy armor"], tools: ["Mechanic's Tools"] }] },
  "mechanist:biochemist": { proficiencies: [{ level: 3, tools: ["Microlab"] }] },
  "mechanist:engineer": { proficiencies: [{ level: 3, tools: ["Electrician's Tools"] }] },
  "mechanist:field-mechanic": { proficiencies: [{ level: 3, tools: ["Mechanic's Tools"], weapons: ["military weapons"] }] },
  "mechanist:mech-pilot": { proficiencies: [{ level: 3, vehicleChoice: 2 }] },
  "ordinator:city": { proficiencies: [{ level: 1, weapons: ["civilian ranged weapons", "military ranged weapons"], vehicleCategory: "land vehicles" }] },
  "ordinator:grim": { proficiencies: [{ level: 1, weapons: ["military weapons"] }] },
  "ordinator:lifegiver": { proficiencies: [{ level: 1, armor: ["heavy armor"] }] },
  "ordinator:order": { proficiencies: [{ level: 1, armor: ["heavy armor"], skillChoice: { count: 1, from: ["Intimidation", "Persuasion"] } }] },
  "ordinator:peacebringer": { proficiencies: [{ level: 1, skillChoice: { count: 1, from: ["Insight", "Performance", "Persuasion"] } }] },
  "ordinator:sanguine": { proficiencies: [{ level: 1, weapons: ["military weapons"] }] },
  "ordinator:shadowdancer": { proficiencies: [{ level: 1, armor: ["heavy armor"], weapons: ["military weapons"] }] },
  "ordinator:stormrider": { proficiencies: [{ level: 1, armor: ["heavy armor"], weapons: ["military weapons"] }] },
  "ordinator:techie": { proficiencies: [{ level: 1, skills: ["Technology"] }] },
  "ordinator:trickster": { proficiencies: [{ level: 1, skillChoice: { count: 1, from: ["Deception", "Stealth"] } }] },
  "ordinator:warmonger": { proficiencies: [{ level: 1, armor: ["heavy armor"], weapons: ["military weapons"] }] },
  "ordinator:wastelander": { proficiencies: [{ level: 1, armor: ["heavy armor"], skillChoice: { count: 1, from: ["Animal Handling", "Nature", "Survival"] } }] },
  "outlaw:assassin": { proficiencies: [{ level: 3, tools: ["disguise kit", "poison kit"] }] },
  "outlaw:gambler": { proficiencies: [{ level: 3, toolChoice: { count: 3, from: GAMES } }] },
  "outlaw:investigator": { proficiencies: [{ level: 3, tools: ["disguise kit", "forgery kit"], toolChoice: { count: 1, from: GAMES }, languages: 2 }] },
  "outlaw:rebooted": { proficiencies: [{ level: 3, skillChoice: { count: 1, from: ANY }, toolChoice: { count: 1, from: TOOLS } }] },
  "ronin:tactical-sniper": { proficiencies: [{ level: 3, skillChoice: { count: 1, from: ["Technology", "Survival"] } }] },
  "streamer:esports": { proficiencies: [{ level: 1, armor: ["medium armor", "shields"], weapons: ["military weapons"] }] },
  "streetfighter:catch-wrestler": { proficiencies: [{ level: 3, skillOrExpertise: "Athletics" }] },
  "streetfighter:dirty-dog": { proficiencies: [{ level: 3, skillUnless: { skill: "Intimidation", from: ["Deception", "Sleight of Hand"] } }] },
  "streetfighter:lucha-libre": { proficiencies: [{ level: 3, skillUnless: { skill: "Performance", from: ["Intimidation", "Persuasion"] } }] },
  "streetfighter:street-detective": { proficiencies: [{ level: 3, skillChoice: { count: 2, from: ["Insight", "Investigation", "Perception"] } }] },
  "techwizard:sentai-savior": { proficiencies: [{ level: 2, armor: ["light armor"], skills: ["Performance"], weaponChoice: { count: 1, from: "one-handed-melee" } }] },
  "techwizard:it-generalist": { proficiencies: [{ level: 2, tools: ["Hacker's Kit", "Programmer's Kit"] }] },
};

const LINEAGE_SHEETS: Record<string, SheetRecord> = {
  "race:wukong": { bonuses: [{ level: 1, climb: 25 }] },
  "race:netnibbler": { bonuses: [{ level: 1, climb: "walk" }] },
  "race:jerboan": { proficiencies: [{ level: 1, weapons: ["axe", "sledgehammer", "maul"] }] },
  "race:new-human": { proficiencies: [{ level: 1, skillChoice: { count: 1, from: ANY }, toolChoice: { count: 1, from: TOOLS }, languages: 1 }] },
};

const SUBLINEAGE_SHEETS: Record<string, SheetRecord> = {
  "race:elf|Street": { bonuses: [{ level: 1, speed: 5 }] },
  "race:gobbo|Semi Aquatic": { bonuses: [{ level: 1, swim: "walk" }] },
  "race:kaijuborn|Baragora": { bonuses: [{ level: 1, burrow: 10 }] },
  "race:kaijuborn|Battra": { bonuses: [{ level: 1, fly: 30, when: "not-medium-heavy", flyNote: "limited flight; land at the end of the turn" }] },
  "race:kaijuborn|Gojira": { bonuses: [{ level: 1, swim: 30, hpPerCharacterLevel: true }] },
  "race:thulian|Jovian": { bonuses: [{ level: 1, climb: "walk" }] },
  "race:thulian|Mercurial": { bonuses: [{ level: 1, fly: 30, when: "not-heavy", flyNote: "limited flight in a straight line; land at the end of the turn" }] },
  "race:thulian|Neptunian": { bonuses: [{ level: 1, swim: 30 }] },
  "race:artificiate|Stackerbot": { bonuses: [{ level: 1, hpPerCharacterLevel: true }] },
  "race:artificiate|Researchbot": { proficiencies: [{ level: 1, skillChoice: { count: 2, from: ANY } }] },
  "race:artificiate|Sexbot": { proficiencies: [{ level: 1, skillChoice: { count: 1, from: ["Performance", "Persuasion"] } }] },
  "race:remake|Heavy Loader": { bonuses: [{ level: 1, ac: { base: 18, abilities: [] }, stealthDisadvantage: true }] },
  "race:remake|Nimble 36": { bonuses: [{ level: 1, ac: { base: 13, abilities: ["dex"], dexMax: 2 }, speed: 5 }] },
  "race:remake|Life-Lite": { proficiencies: [{ level: 1, skillChoice: { count: 1, from: ANY }, toolChoice: { count: 1, from: TOOLS } }], bonuses: [{ level: 1, ac: { base: 11, abilities: ["dex"] } }] },
  "race:jerboan|Adult Alternative Jerboan": { proficiencies: [{ level: 1, armor: ["light armor", "medium armor"] }] },
  "race:jerboan|Industrial Rock Jerboan": { proficiencies: [{ level: 1, toolChoice: { count: 1, from: ["Locksmith's tools", "Hacker's Kit"] } }] },
  "race:jerboan|Nu Metal Jerboan": { proficiencies: [{ level: 1, skillChoice: { count: 1, from: ANY }, toolChoice: { count: 1, from: TOOLS }, languages: 1 }] },
  "race:orcc|Austral Wormwood": { proficiencies: [{ level: 1, skills: ["Culture"], toolChoice: { count: 1, from: ["Armorer's Tools", "Artist's Supplies", "Builder's Tools", "Cook's Utensils", "Microbrewing Kit", "Tailor's Tools", "Weaponsmith's Tools"] } }] },
  "race:orcc|Tropical Palm": { bonuses: [{ level: 1, swim: 20 }], proficiencies: [{ level: 1, skills: ["Technology"] }] },
  "race:orcc|Swamp Truffle": { proficiencies: [{ level: 1, skills: ["Nature"] }] },
};

export interface ActiveSheet {
  source: string;
  owner: string;
  record: SheetRecord;
  level: number;
}

export interface GrantContext {
  wearingArmor: boolean;
  armorCategory: string | null;
  shield: boolean;
  mods: Record<Ability, number>;
  characterLevel: number;
  knownSkills: Set<string>;
}

export interface GrantChoice {
  id: string;
  source: string;
  count: number;
  options: string[];
  kind: string;
}

export interface ResolvedGrants {
  skills: { name: string; expertise: boolean; source: string }[];
  lines: string[];
  notes: string[];
  choices: GrantChoice[];
  initiativeBonus: number;
  initiativeNotes: string[];
  initiativeAdvantage: boolean;
  speedBonus: number;
  swimClimbBonus: number;
  moves: { kind: "swim" | "climb" | "burrow" | "fly"; feet: number | "walk"; note: string }[];
  unarmored: { ac: number; note: string; stealthDisadvantage: boolean }[];
  acHeavy: number;
  acHeavyNote: string | null;
  hpBonus: number;
}

function sourceName(rules: Rules, owner: string) {
  return rules.subclasses.find((sub) => sub.id === owner)?.name
    ?? rules.classes.find((cls) => cls.id === owner)?.name
    ?? rules.lineages.find((lineage) => lineage.id === owner)?.name
    ?? owner;
}

export function activeSheets(character: Character, rules: Rules, entries: ClassLevel[]): ActiveSheet[] {
  const sheets: ActiveSheet[] = [];
  const push = (owner: string, source: string, record: SheetRecord | undefined, level: number) => {
    if (!record) return;
    sheets.push({ owner, source, record, level });
  };
  for (const entry of entries) {
    push(entry.id, sourceName(rules, entry.id), CLASS_SHEETS[entry.id], entry.level);
    if (entry.subclassId) push(entry.subclassId, sourceName(rules, entry.subclassId), SUBCLASS_SHEETS[entry.subclassId], entry.level);
  }
  if (character.lineageId) {
    push(character.lineageId, sourceName(rules, character.lineageId), LINEAGE_SHEETS[character.lineageId], 20);
    const key = `${character.lineageId}|${character.sublineage ?? ""}`;
    const heritage = character.sublineage ? `${sourceName(rules, character.lineageId)} (${character.sublineage})` : "";
    push(key, heritage, SUBLINEAGE_SHEETS[key], 20);
  }
  return sheets;
}

function conditionMet(when: SheetBonus["when"], ctx: GrantContext) {
  if (when === "unarmored") return !ctx.wearingArmor && !ctx.shield;
  if (when === "not-heavy") return ctx.armorCategory !== "heavy";
  if (when === "not-medium-heavy") return ctx.armorCategory !== "medium" && ctx.armorCategory !== "heavy";
  return true;
}

function brawlerSpeed(level: number) {
  if (level < 2) return 0;
  if (level < 6) return 10;
  if (level < 10) return 15;
  if (level < 14) return 20;
  if (level < 18) return 25;
  return 30;
}

function abilityBonus(bonus: SheetBonus, ctx: GrantContext) {
  if (!bonus.initiative) return 0;
  const raw = ctx.mods[bonus.initiative];
  return bonus.initiativeMin == null ? raw : Math.max(bonus.initiativeMin, raw);
}

function unarmoredValue(bonus: SheetBonus, ctx: GrantContext) {
  if (!bonus.ac) return 0;
  return bonus.ac.base + bonus.ac.abilities.reduce((sum, ability) => {
    const mod = ability === "dex" && bonus.ac?.dexMax != null ? Math.min(ctx.mods.dex, bonus.ac.dexMax) : ctx.mods[ability];
    return sum + mod;
  }, 0);
}

function picks(character: Character, id: string) {
  return character.grantPicks?.[id] ?? [];
}

function skillList(from: string[], rules: Rules) {
  return from.includes("*") ? rules.skills.map((skill) => skill.name) : from;
}

function weaponList(rules: Rules, from: "one-handed-melee" | "otaku") {
  return rules.weapons.filter((weapon) => {
    const properties = weapon.properties ?? "";
    if (from === "one-handed-melee") return weapon.category.includes("melee") && !/two-handed|heavy/i.test(properties);
    return /civilian|military/.test(weapon.category) && !/heavy|special/i.test(properties);
  }).map((weapon) => weapon.name);
}

function surgeMove(affinity: string | undefined): Pick<SheetBonus, "swim" | "fly" | "burrow"> | null {
  if (affinity === "Aqueous") return { swim: "walk" };
  if (affinity === "Gaseous" || affinity === "Plasmatic") return { fly: 0 };
  if (affinity === "Solid") return { burrow: 0 };
  return null;
}

export function resolveGrants(character: Character, rules: Rules, entries: ClassLevel[], ctx: GrantContext): ResolvedGrants {
  const resolved: ResolvedGrants = {
    skills: [],
    lines: [],
    notes: [],
    choices: [],
    initiativeBonus: 0,
    initiativeNotes: [],
    initiativeAdvantage: false,
    speedBonus: 0,
    swimClimbBonus: 0,
    moves: [],
    unarmored: [],
    acHeavy: 0,
    acHeavyNote: null,
    hpBonus: 0,
  };
  const known = new Set(ctx.knownSkills);
  for (const sheet of activeSheets(character, rules, entries)) {
    for (const bonus of sheet.record.bonuses ?? []) {
      if (sheet.level < bonus.level) continue;
      const speed = bonus.speed;
      if (bonus.initiative) {
        const amount = abilityBonus(bonus, ctx);
        resolved.initiativeBonus += amount;
        const ability = bonus.initiative === "wis" ? "Wisdom" : bonus.initiative === "cha" ? "Charisma" : "Intelligence";
        resolved.initiativeNotes.push(`${ability} ${amount >= 0 ? "+" : ""}${amount} (${sheet.source}${bonus.initiativeMin === 0 ? ", minimum 0" : ""})`);
      }
      if (bonus.initiativeAdvantage) {
        resolved.initiativeAdvantage = true;
        resolved.initiativeNotes.push(`Advantage (${sheet.source})`);
      }
      if (speed && conditionMet(bonus.when, ctx)) {
        resolved.speedBonus += speed;
        resolved.notes.push(`+${speed} ft. speed (${sheet.source})`);
        if (bonus.alsoSwimClimb) resolved.swimClimbBonus += speed;
      }
      if (!conditionMet(bonus.when, ctx)) {
        /* A gated movement mode stays off while the armor condition fails. */
      } else if (sheet.owner === "sourcecoder:surge-splicer" && bonus.level === 14) {
        const surge = surgeMove(picks(character, "affinity:sourcecoder:surge-splicer")[0]);
        if (surge?.swim) resolved.moves.push({ kind: "swim", feet: "walk", note: `${sheet.source}, Aqueous` });
        if (surge?.fly != null) resolved.moves.push({ kind: "fly", feet: "walk", note: `${sheet.source}, ${picks(character, "affinity:sourcecoder:surge-splicer")[0]}` });
        if (surge?.burrow != null) resolved.moves.push({ kind: "burrow", feet: "walk", note: `${sheet.source}, Solid` });
      } else {
        if (bonus.swim != null) resolved.moves.push({ kind: "swim", feet: bonus.swim, note: sheet.source });
        if (bonus.climb != null) resolved.moves.push({ kind: "climb", feet: bonus.climb, note: sheet.source });
        if (bonus.burrow != null) resolved.moves.push({ kind: "burrow", feet: bonus.burrow, note: sheet.source });
        if (bonus.fly != null) resolved.moves.push({ kind: "fly", feet: bonus.fly, note: `${sheet.source}${bonus.flyNote ? `; ${bonus.flyNote}` : ""}` });
      }
      if (bonus.ac && !ctx.wearingArmor) {
        resolved.unarmored.push({ ac: unarmoredValue(bonus, ctx), note: `${sheet.source} ${bonus.ac.base}${bonus.ac.abilities.length ? " + Dexterity" : ""}${bonus.ac.dexMax != null ? ` (maximum ${bonus.ac.dexMax})` : ""}`, stealthDisadvantage: Boolean(bonus.stealthDisadvantage) });
      }
      if (bonus.acHeavy && ctx.armorCategory === "heavy") {
        resolved.acHeavy += bonus.acHeavy;
        resolved.acHeavyNote = `+${bonus.acHeavy} AC in heavy armor (${sheet.source})`;
      }
      if (bonus.hpPerClassLevel) resolved.hpBonus += sheet.level;
      if (bonus.hpPerCharacterLevel) resolved.hpBonus += ctx.characterLevel;
    }
    if (sheet.owner === "sourcecoder:surge-splicer" && sheet.level >= 1) {
      resolved.choices.push({ id: "affinity:sourcecoder:surge-splicer", source: sheet.source, count: 1, options: SURGE, kind: "surge affinity" });
    }
    for (const grant of sheet.record.proficiencies ?? []) {
      if (sheet.level < grant.level) continue;
      for (const skill of grant.skills ?? []) resolved.skills.push({ name: skill, expertise: (grant.expertise ?? []).includes(skill), source: sheet.source });
      for (const skill of grant.expertise ?? []) {
        if (!(grant.skills ?? []).includes(skill)) resolved.skills.push({ name: skill, expertise: true, source: sheet.source });
      }
      if (grant.skillOrExpertise) {
        const already = known.has(skillKey(grant.skillOrExpertise));
        resolved.skills.push({ name: grant.skillOrExpertise, expertise: already, source: sheet.source });
      }
      if (grant.skillUnless) {
        if (known.has(skillKey(grant.skillUnless.skill))) {
          resolved.choices.push({ id: `alt:${sheet.owner}`, source: sheet.source, count: 1, options: grant.skillUnless.from, kind: "skill" });
        } else {
          resolved.skills.push({ name: grant.skillUnless.skill, expertise: false, source: sheet.source });
        }
      }
      if (grant.skillChoice) {
        resolved.choices.push({ id: `skill:${sheet.owner}`, source: sheet.source, count: grant.skillChoice.count, options: skillList(grant.skillChoice.from, rules), kind: "skill" });
      }
      for (const tool of grant.tools ?? []) resolved.lines.push(`${tool} (${sheet.source})`);
      if (grant.toolChoice) resolved.choices.push({ id: `tool:${sheet.owner}`, source: sheet.source, count: grant.toolChoice.count, options: grant.toolChoice.from, kind: "tool" });
      for (const armor of grant.armor ?? []) resolved.lines.push(`${armor} (${sheet.source})`);
      for (const weapon of grant.weapons ?? []) resolved.lines.push(`${weapon} (${sheet.source})`);
      if (grant.weaponChoice) resolved.choices.push({ id: `weapon:${sheet.owner}`, source: sheet.source, count: grant.weaponChoice.count, options: weaponList(rules, grant.weaponChoice.from), kind: "weapon" });
      if (grant.vehicleCategory) resolved.lines.push(`${grant.vehicleCategory} (${sheet.source})`);
      if (grant.vehicleChoice) resolved.choices.push({ id: `vehicle:${sheet.owner}`, source: sheet.source, count: grant.vehicleChoice, options: LAND, kind: "land vehicle" });
      if (grant.languages) resolved.choices.push({ id: `language:${sheet.owner}`, source: sheet.source, count: grant.languages, options: LANGUAGES, kind: "language" });
      if (sheet.owner === "techwizard:it-generalist") resolved.notes.push("Hacker's Kit and Programmer's Kit work through the retrostyle cyberdeck (IT Generalist).");
      if (sheet.owner === "outlaw:rebooted") resolved.notes.push("Rebooted skill and tool can be changed after a rest.");
    }
    if (sheet.owner === "race:jerboan|Nu Metal Jerboan") {
      resolved.choices.push({ id: "option:nu-metal", source: sheet.source, count: 1, options: ["Bring Me To Life", "Animal I Have Become", "Awake", "Down With the Sickness"], kind: "lineage option" });
      if (picks(character, "option:nu-metal").includes("Awake")) {
        resolved.speedBonus += 5;
        resolved.notes.push("+5 ft. speed (Nu Metal Jerboan, Awake)");
      }
    }
  }
  for (const choice of resolved.choices) {
    const chosen = picks(character, choice.id).slice(0, choice.count);
    for (const value of chosen) {
      if (choice.kind === "skill" || choice.kind === "surge affinity") {
        if (choice.kind === "skill") resolved.skills.push({ name: value, expertise: false, source: choice.source });
      } else if (choice.kind === "language") resolved.lines.push(`${value} (${choice.source})`);
      else resolved.lines.push(`${value} (${choice.source})`);
    }
  }
  for (const skill of resolved.skills) known.add(skillKey(skill.name));
  return resolved;
}

export function missingGrantLabels(character: Character, rules: Rules, entries: ClassLevel[]) {
  const grants = resolveGrants(character, rules, entries, {
    wearingArmor: false,
    armorCategory: null,
    shield: false,
    mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    characterLevel: character.level,
    knownSkills: new Set(character.skillProfs.map(skillKey)),
  });
  return grants.choices.flatMap((choice) => {
    const count = picks(character, choice.id).length;
    return count >= choice.count ? [] : [`${choice.source}: ${choice.count - count} ${choice.kind}${choice.count - count === 1 ? "" : "s"}`];
  });
}

export function describeGrants(character: Character, rules: Rules, entries: ClassLevel[]) {
  const described = activeSheets(character, rules, entries).flatMap((sheet) => {
    const lines: string[] = [];
    for (const bonus of sheet.record.bonuses ?? []) {
      if (sheet.level < bonus.level) continue;
      if (bonus.initiative) lines.push(`Initiative adds ${bonus.initiative === "wis" ? "Wisdom" : bonus.initiative === "cha" ? "Charisma" : "Intelligence"}${bonus.initiativeMin === 0 ? " (minimum 0)" : ""} (${sheet.source})`);
      if (bonus.initiativeAdvantage) lines.push(`Advantage on initiative (${sheet.source})`);
      if (bonus.speed) lines.push(`+${bonus.speed} ft. speed (${sheet.source})`);
      if (bonus.ac) lines.push(`Unarmored AC ${bonus.ac.base}${bonus.ac.abilities.includes("dex") ? " + Dexterity" : ""} (${sheet.source})`);
      if (bonus.hpPerClassLevel || bonus.hpPerCharacterLevel) lines.push(`+1 hit point per ${bonus.hpPerClassLevel ? "class" : "character"} level (${sheet.source})`);
      if (bonus.swim || bonus.climb || bonus.burrow || bonus.fly || bonus.level === 14 && sheet.owner === "sourcecoder:surge-splicer") lines.push(`Extra movement (${sheet.source})`);
    }
    for (const grant of sheet.record.proficiencies ?? []) {
      if (sheet.level < grant.level) continue;
      const parts = [...(grant.skills ?? []), ...(grant.tools ?? []), ...(grant.armor ?? []), ...(grant.weapons ?? []), grant.vehicleCategory ?? ""].filter(Boolean);
      if (parts.length) lines.push(`${parts.join(", ")} (${sheet.source})`);
    }
    return lines;
  });
  const brawler = entries.find((entry) => entry.id === "brawler");
  if (brawler && brawler.level >= 2) described.push(`+${brawlerSpeed(brawler.level)} ft. while unarmored and without a shield (Brawler)`);
  return described;
}

const DAMAGE_TYPES = ["piercing", "slashing", "bludgeoning"];

export function weaponDamageTypes(weapon: WeaponDef) {
  return /varies/i.test(weapon.damage ?? "") ? DAMAGE_TYPES : [];
}

export function weaponIsVersatile(weapon: WeaponDef) {
  return /versatile/i.test(weapon.properties ?? "") && !/two-handed/i.test(weapon.properties ?? "");
}

export function versatileDice(weapon: WeaponDef) {
  return weapon.properties?.match(/versatile\s*\(([^)]+)\)/i)?.[1] ?? null;
}

export function sheetAttackName(weapon: WeaponDef, equip: WeaponEquip) {
  const twoHanded = /two-handed/i.test(weapon.properties ?? "") || equip.grip === "two";
  const type = (equip.damageType || weaponDamageTypes(weapon)[0] || "").toLowerCase();
  if (weapon.id === "weapon:brass-knuckles" && type) return `Brass Knuckles (${type})`;
  if (weapon.id === "weapon:polearm" && type) return `${type[0].toUpperCase()}${type.slice(1)} polearm`;
  if (weapon.id === "weapon:baseball-bat") return "Two-handed baseball bat";
  if (weapon.id === "weapon:quarterstaff" && twoHanded) return "Quarterstaff (Two-Handed)";
  if (twoHanded && weaponIsVersatile(weapon)) return `Two-handed ${weapon.name.toLowerCase()}`;
  return weapon.name;
}

export const LAND_VEHICLES = LAND;
