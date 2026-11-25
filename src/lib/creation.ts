import type { Ability, CatalogEntry, Character, ClassDef, Rules } from "./types";
import { classEntries, creditsLabel, featuresThrough, skillKey } from "./character";

/** 5e XP required to be this level. The wiki has no MP value for levels 1–4. */
export const XP_TO_BE_LEVEL = [
  0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

export function xpForLevel(level: number) {
  return XP_TO_BE_LEVEL[Math.min(20, Math.max(1, level))] ?? 0;
}

/** Creation stipend. Levels 1–5 are the figures given for this companion. Above 5 the wiki has no creation stipend, so each later level adds $10,000 as a house rule. */
export function startingMoney(level: number): { credits: number; note: string; houseRule: boolean } {
  const stated: Record<number, number> = { 1: 10000, 2: 10000, 3: 20000, 4: 30000, 5: 40000 };
  if (level <= 5) {
    const tight = level <= 2 ? " Levels 1–2 are a tight starter budget." : "";
    return {
      credits: stated[level],
      note: (level === 5 ? "Level 5 uses the wiki’s $40,000 creation stipend." : "Starting money for this level.") + tight,
      houseRule: false,
    };
  }
  return {
    credits: 40000 + (level - 5) * 10000,
    note: "House rule: the wiki does not list a creation stipend above level 5, so each level after 5 adds $10,000.",
    houseRule: true,
  };
}

export const SKILL_BLURB: Record<string, string> = {
  acrobatics: "Balance, tumble, and slip out of a grab.",
  "animal handling": "Calm, herd, or read an animal.",
  athletics: "Climb, jump, swim, or force something open.",
  culture: "Recall faiths, rites, corporations, and the stories people live by. Replaces Religion.",
  deception: "Lie, bluff, or wear a false face.",
  history: "Recall settlements, wars, and recorded events.",
  insight: "Tell when someone is hiding what they want.",
  intimidation: "Frighten or pressure someone into backing down.",
  investigation: "Search a room, a file, or a contradiction.",
  medicine: "Stabilize the dying and treat a wound.",
  nature: "Recall terrain, weather, plants, and animals.",
  perception: "Notice a tail, a trap, or a sound.",
  performance: "Play, speak, or hold a crowd.",
  persuasion: "Talk someone into a reasonable ask.",
  "sleight of hand": "Palm an object, plant a bug, or pick a pocket.",
  stealth: "Hide, move quietly, and slip a tail.",
  survival: "Track, forage, and read the waste.",
  technology: "Recall how a system, program, or tech works. Replaces Arcana.",
};

export function extraLineageSkills(lineageId: string | null, sublineage: string | null) {
  if (lineageId === "race:human" || lineageId === "race:new-human") return 1;
  if (lineageId === "race:jerboan" && (sublineage ?? "").toLowerCase().includes("nu metal")) return 1;
  if (lineageId === "race:artificiate" && (sublineage ?? "").toLowerCase().includes("research")) return 2;
  if (lineageId === "race:remake" && (sublineage ?? "").toLowerCase().includes("life-lite")) return 1;
  return 0;
}

export function skillPickBudget(character: Character, rules: Rules) {
  const entries = classEntries(character);
  const first = entries[0];
  const cls = rules.classes.find((item) => item.id === first?.id);
  let picks = cls?.skillCount ?? 0;
  for (const entry of entries.slice(1)) {
    const text = (awaitProf(entry.id) ?? "").toLowerCase();
    if (text.includes("one skill")) picks += 1;
  }
  picks += extraLineageSkills(character.lineageId, character.sublineage);
  return picks;
}

function awaitProf(classId: string) {
  const table: Record<string, string> = {
    influencer: "one skill of your choice",
    outlaw: "one skill from the outlaw skill list",
  };
  return table[classId] ?? "";
}

const ABILITY_WORD: Record<string, Ability> = {
  strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha",
};

export function featBlocked(prerequisite: string | null, character: Character, scores: Record<Ability, number>, canCast: boolean, armorText: string): string | null {
  if (!prerequisite) return null;
  const text = prerequisite.toLowerCase();
  const levelMatch = text.match(/character level (\d+)/);
  if (levelMatch && character.level < Number(levelMatch[1])) return `Requires level ${levelMatch[1]}`;
  if ((text.includes("cast") || text.includes("techcasting") || text.includes("gifted tech")) && !canCast && !text.includes("or")) {
    return "Requires techcasting";
  }
  if (text.includes("medium armor") && !armorText.includes("medium") && !armorText.includes("all armor")) return "Requires medium armor proficiency";
  if (text.includes("heavy armor") && !armorText.includes("heavy") && !armorText.includes("all armor")) return "Requires heavy armor proficiency";
  if (text.includes("light armor") && !armorText.includes("light") && !armorText.includes("all armor")) return "Requires light armor proficiency";
  if (text.includes("military weapon") && !armorText.includes("military")) return "Requires a military weapon proficiency";
  const abilityNeeds = [...text.matchAll(/(strength|dexterity|constitution|intelligence|wisdom|charisma)[^\d]{0,24}(\d+)/g)];
  if (abilityNeeds.length) {
    const orMode = text.includes(" or ");
    const ok = abilityNeeds.map((match) => scores[ABILITY_WORD[match[1]]] >= Number(match[2]));
    if (orMode ? !ok.some(Boolean) : !ok.every(Boolean)) {
      return prerequisite.replace(/^\*?prerequisite:?\s*/i, "");
    }
  }
  return null;
}

export function carryCapacity(strength: number) {
  return strength * 15;
}

export function parseWeight(weight?: string | null) {
  const match = weight?.match(/([\d.]+)/);
  return match ? Number(match[1]) : 0;
}

export type CatalogItem = {
  id: string;
  name: string;
  category: string;
  cost: number | null;
  weight: number;
  blurb: string;
  detail: string;
  contents: string[];
  highEnd: boolean;
  rarity: string;
  damage: string;
  damageType: string;
  properties: string;
  ac: string;
  strengthReq: string;
  stealth: string;
  effect: string;
  description: string;
};

export function packContents(text: string): string[] {
  const match = text.match(/this pack contains\s+([\s\S]+)/i);
  if (!match) return [];
  const blob = match[1].split(/\n\n/)[0].replace(/\.\s*$/, "");
  return blob
    .split(/,|\band\b/i)
    .map((part) => part.replace(/^\s*or\s+/i, "").trim())
    .filter((part) => part.length > 1);
}

const COUNT_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

export function packPieces(contents: string[]): { name: string; qty: number }[] {
  return contents.map((line) => {
    const match = line.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(.+)$/i);
    if (!match) return { name: line, qty: 1 };
    if (/^(feet|foot|days|day|lb|lbs|pounds)\b/i.test(match[2])) return { name: line, qty: 1 };
    const qty = COUNT_WORDS[match[1].toLowerCase()] ?? Number(match[1]);
    return { name: match[2], qty: Number.isFinite(qty) && qty > 0 ? qty : 1 };
  });
}

export type ItemStat = {
  cost?: number | null;
  rarity?: string;
  description?: string;
  effect?: string;
  damage?: string;
  damageType?: string;
  properties?: string;
  ac?: string;
  strengthReq?: string;
  stealth?: string;
  weight?: string;
  contents?: string[];
};

const RARITY_ORDER = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"];

export function sortGear(rows: CatalogItem[], mode: "rarity" | "name" | "price"): CatalogItem[] {
  const price = (row: CatalogItem) => (row.cost == null ? Number.POSITIVE_INFINITY : row.cost);
  const rarity = (row: CatalogItem) => {
    const index = RARITY_ORDER.indexOf((row.rarity || "").toLowerCase());
    return index === -1 ? RARITY_ORDER.length : index;
  };
  return [...rows].sort((a, b) => {
    if (mode === "name") return a.name.localeCompare(b.name) || price(a) - price(b);
    if (mode === "price") return price(a) - price(b) || a.name.localeCompare(b.name);
    return rarity(a) - rarity(b) || price(a) - price(b) || a.name.localeCompare(b.name);
  });
}

export function gearSummary(row: CatalogItem): string {
  const price = row.cost == null ? "Not listed in wiki" : creditsLabel(row.cost);
  const parts = [row.category, row.rarity || "Rarity not listed in wiki", price];
  if (row.damage) parts.push(`${row.damage}${row.damageType ? ` ${row.damageType}` : ""}`);
  else if (row.category === "weapons" || row.category === "grenades") parts.push("Damage not listed in wiki");
  if (row.properties) parts.push(row.properties);
  if (row.ac) parts.push(`AC ${row.ac}`);
  else if (row.category === "armor" || row.category === "shields") parts.push("AC not listed in wiki");
  if (row.strengthReq) parts.push(`Str ${row.strengthReq}`);
  if (row.stealth) parts.push(`stealth ${row.stealth}`);
  if (row.effect && !row.damage) parts.push(row.effect.length > 160 ? `${row.effect.slice(0, 157)}…` : row.effect);
  if (!row.detail && !row.effect && !row.description) parts.push("Description not listed in wiki");
  return parts.filter(Boolean).join(" · ");
}

const LOOT_UI: Record<string, string> = {
  weapon: "weapons",
  "highend-weapon": "weapons",
  "weapon-mod": "mods",
  armor: "armor",
  "highend-armor": "armor",
  "armor-mod": "mods",
  cybernetic: "cybernetics",
  vehicle: "vehicles",
  "vehicle-mod": "vehicles",
  gizmo: "gizmos",
  peripheral: "gear",
  keyring: "gear",
  consumable: "gear",
  burner: "gear",
  gear: "gear",
};

export const GEAR_FILTERS = ["all", "weapons", "armor", "shields", "grenades", "cybernetics", "tools", "packs", "gear", "vehicles", "gizmos", "mods", "high-end"] as const;

function gearBucket(name: string, category: string): string {
  if (category === "grenades" || category === "shields" || category === "tools" || category === "packs") return category;
  if (/grenade|explosive/i.test(name) && category === "weapons") return "grenades";
  if (/shield/i.test(name) && (category === "armor" || category === "mods")) return "shields";
  if (/pack/i.test(name) && category === "gear") return "packs";
  if (/tool|kit/i.test(name) && category === "gear" && !/pack/i.test(name)) return "tools";
  return category;
}

const EMPTY_GEAR = { rarity: "", damage: "", damageType: "", properties: "", ac: "", strengthReq: "", stealth: "", effect: "", description: "" };

export function applyItemStats(rows: CatalogItem[], stats: Record<string, ItemStat>): CatalogItem[] {
  return rows.map((row) => {
    const stat = stats[row.id];
    if (!stat) return row;
    const contents = stat.contents?.length ? stat.contents : row.contents;
    return {
      ...row,
      cost: stat.cost ?? row.cost,
      rarity: stat.rarity || row.rarity,
      description: stat.description || row.description,
      effect: stat.effect || row.effect,
      damage: stat.damage || row.damage,
      damageType: stat.damageType || row.damageType,
      properties: stat.properties || row.properties,
      ac: stat.ac || row.ac,
      strengthReq: stat.strengthReq || row.strengthReq,
      stealth: stat.stealth || row.stealth,
      weight: stat.weight ? parseWeight(stat.weight) || row.weight : row.weight,
      contents,
      detail: stat.description || stat.effect || row.detail,
      blurb: contents.length ? `Pack · ${contents.length} items inside` : row.blurb,
    };
  });
}

export function gearCatalog(rules: Rules, entries: CatalogEntry[] = []): CatalogItem[] {
  const rows: CatalogItem[] = [];
  const seen = new Set<string>();
  const push = (row: Omit<CatalogItem, keyof typeof EMPTY_GEAR> & Partial<CatalogItem>) => {
    if (!row.id || seen.has(row.id)) return;
    seen.add(row.id);
    rows.push({ ...EMPTY_GEAR, ...row });
  };
  for (const weapon of rules.weapons) {
    push({
      id: weapon.id,
      name: weapon.name,
      category: gearBucket(weapon.name, weapon.category === "explosive" ? "grenades" : "weapons"),
      cost: weapon.cost ?? null,
      weight: parseWeight(weapon.weight),
      blurb: [weapon.damage, weapon.properties].filter(Boolean).join(" · "),
      detail: weapon.features ?? "",
      contents: packContents(weapon.features ?? ""),
      highEnd: weapon.id.startsWith("highend-"),
    });
  }
  for (const armor of rules.armor) {
    push({
      id: armor.id,
      name: armor.name,
      category: gearBucket(armor.name, armor.category === "shield" ? "shields" : "armor"),
      cost: armor.cost ?? null,
      weight: parseWeight(armor.weight),
      blurb: [armor.ac, armor.strength, armor.stealth].filter(Boolean).join(" · "),
      detail: `${armor.category} armor`,
      contents: [],
      highEnd: armor.id.startsWith("highend-"),
    });
  }
  for (const item of rules.gear) {
    const detail = item.description ?? "";
    const contents = packContents(detail);
    push({
      id: item.id,
      name: item.name,
      category: gearBucket(item.name, "gear"),
      cost: item.cost ?? null,
      weight: parseWeight(item.weight),
      blurb: contents.length ? `Pack · ${contents.length} items inside` : (item.weight ?? ""),
      detail,
      contents,
      highEnd: false,
    });
  }
  for (const cyber of rules.cybernetics) {
    push({
      id: cyber.id,
      name: cyber.name,
      category: "cybernetics",
      cost: cyber.cost ?? null,
      weight: 0,
      blurb: cyber.tier ?? "",
      detail: cyber.effect ?? "",
      contents: [],
      highEnd: false,
    });
  }
  for (const entry of entries) {
    if (entry.hub || seen.has(entry.id)) continue;
    const bucket = LOOT_UI[entry.category];
    if (!bucket) continue;
    const detail = entry.summary ?? "";
    const contents = packContents(detail);
    push({
      id: entry.id,
      name: entry.title,
      category: gearBucket(entry.title, bucket),
      cost: entry.cost ?? null,
      weight: 0,
      blurb: contents.length ? `Pack · ${contents.length} items inside` : detail.slice(0, 140),
      detail,
      contents,
      highEnd: entry.category.startsWith("highend"),
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export interface EquipmentOption {
  key: string;
  label: string;
  items: CatalogItem[];
}

export interface EquipmentLine {
  id: string;
  choice: boolean;
  options: EquipmentOption[];
}

function equipmentBullets(text: string) {
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const bullets = lines.filter((line) => /^[-*]/.test(line)).map((line) => line.replace(/^[-*]\s*/, ""));
  return bullets.length ? bullets : lines.filter((line) => !/^you start/i.test(line));
}

function itemsNamedIn(catalog: CatalogItem[], text: string) {
  const low = text.toLowerCase().replace(/[’‘]/g, "'");
  const named = catalog
    .filter((item) => item.name.length >= 3 && low.includes(item.name.toLowerCase().replace(/[’‘]/g, "'")))
    .sort((a, b) => b.name.length - a.name.length);
  const chosen: CatalogItem[] = [];
  let rest = low;
  for (const item of named) {
    const name = item.name.toLowerCase().replace(/[’‘]/g, "'");
    if (!rest.includes(name)) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pair = new RegExp(`\\btwo\\s+${escaped}\\b`).test(rest);
    chosen.push(item);
    if (pair && (item.category === "weapons" || item.category === "grenades")) chosen.push({ ...item });
    rest = rest.replace(name, " ");
  }
  return chosen;
}

/** Split a class’s starting equipment into fixed gear and (a) or (b) choices. Option A is the default. */
export function equipmentLines(cls: ClassDef, rules: Rules): EquipmentLine[] {
  const catalog = gearCatalog(rules);
  const bullets = equipmentBullets(cls.equipment.replace(/[’‘]/g, "'"));
  if (!bullets.length) return [];
  return bullets.map((bullet, index) => {
    const choice = bullet.match(/^\(?([a-d])\)\s*([\s\S]+?)\s+or\s+\(?([a-d])\)\s*([\s\S]+)$/i);
    if (!choice) {
      return { id: `line-${index}`, choice: false, options: [{ key: "fixed", label: bullet, items: itemsNamedIn(catalog, bullet) }] };
    }
    return {
      id: `line-${index}`,
      choice: true,
      options: [
        { key: choice[1].toLowerCase(), label: choice[2].trim(), items: itemsNamedIn(catalog, choice[2]) },
        { key: choice[3].toLowerCase(), label: choice[4].trim(), items: itemsNamedIn(catalog, choice[4]) },
      ],
    };
  });
}

export function chosenEquipment(lines: EquipmentLine[], picks: Record<string, string> = {}): CatalogItem[] {
  return lines.flatMap((line) => {
    if (!line.choice) return line.options[0]?.items ?? [];
    const key = picks[line.id] ?? "a";
    return (line.options.find((option) => option.key === key) ?? line.options[0])?.items ?? [];
  });
}

export function starterKit(cls: ClassDef, rules: Rules): { items: CatalogItem[]; fromWiki: boolean } {
  const lines = equipmentLines(cls, rules);
  const fromWiki = lines.some((line) => line.options.some((option) => option.items.length));
  if (fromWiki) return { items: chosenEquipment(lines, {}), fromWiki: true };
  const catalog = gearCatalog(rules);
  const suggested: CatalogItem[] = [];
  const knife = catalog.find((item) => item.id === "weapon:knife");
  const pistol = catalog.find((item) => item.id === "weapon:light-pistol");
  const film = catalog.find((item) => item.id === "armor:nanofilm");
  const pack = catalog.find((item) => item.id === "gear:backpack");
  const weapons = cls.weapons.toLowerCase();
  if (weapons.includes("civilian") && knife) suggested.push(knife);
  if (weapons.includes("pistol") && pistol) suggested.push(pistol);
  if ((cls.armor.toLowerCase().includes("light") || cls.armor.toLowerCase().includes("all")) && film) suggested.push(film);
  if (pack) suggested.push(pack);
  return { items: suggested, fromWiki: false };
}

export function grantEquipment(items: CatalogItem[], note: string) {
  const weapons = items.filter((item) => item.category === "weapons" || item.category === "grenades");
  const armor = items.find((item) => item.category === "armor");
  const shield = items.some((item) => item.category === "shields");
  const cybernetics = items.filter((item) => item.category === "cybernetics").map((item) => ({ id: item.id }));
  const inventory = items.flatMap((item) => {
    if (item.contents.length) return packPieces(item.contents).map((piece) => ({ name: piece.name, qty: piece.qty, notes: `${note}; from ${item.name}` }));
    if (["weapons", "grenades", "armor", "shields", "cybernetics"].includes(item.category)) return [];
    return [{ name: item.name, qty: 1, notes: note }];
  });
  return {
    weapons: weapons.map((item) => ({ id: item.id })),
    armorId: armor?.id ?? null,
    shield,
    cybernetics,
    inventory,
  };
}

export function classBlurb(cls: ClassDef) {
  const first = featuresThrough(cls, 1).join(", ") || "See the class page text.";
  return `d${cls.hitDie} · saves ${cls.saves.join("/")} · ${cls.skillCount} skills · level 1: ${first}`;
}

export function spentOn(character: Character, rules: Rules) {
  const catalog = gearCatalog(rules);
  const shield = character.shield ? catalog.find((row) => row.id === "armor:riot-shield") : undefined;
  const ids = [
    character.armorId,
    shield?.id,
    ...character.weapons.map((item) => item.id),
    ...character.cybernetics.map((item) => item.id),
    ...character.inventory.map((item) => catalog.find((row) => skillKey(row.name) === skillKey(item.name))?.id).filter(Boolean) as string[],
  ];
  return ids.reduce((sum, id) => sum + (catalog.find((row) => row.id === id)?.cost ?? 0), 0);
}
