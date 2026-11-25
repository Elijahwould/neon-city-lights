import type { Ability, Character } from "./types";

export interface TraitDef {
  id: string;
  name: string;
  summary: string;
  skill?: string;
  tool?: string;
  speedSet?: number;
  speedBonus?: number;
  initiative?: "pb";
  naturalArmor?: boolean;
  carryMultiplier?: number;
  climb?: number | "speed";
  swim?: "speed";
  naturalWeapon?: { name: string; dice: string; ability: "str" | "dex" | "best"; type: string };
  resistance?: string;
  note?: string;
}

export interface TraitGroup {
  id: string;
  title: string;
  max: number;
  traits: TraitDef[];
}

const MAJOR: TraitDef[] = [
  { id: "major:aquatic", name: "Aquatic", summary: "Breathe underwater. Swim speed equals your walking speed.", swim: "speed" },
  { id: "major:bull-headed", name: "Bull-Headed", summary: "Horns deal 1d6 piercing, and you can slam or gore.", naturalWeapon: { name: "Horns", dice: "1d6", ability: "str", type: "piercing" } },
  { id: "major:darkvision", name: "Darkvision", summary: "See in dim light and darkness out to 60 feet.", note: "Darkvision 60 ft." },
  { id: "major:kaiju-scales", name: "Kaiju Scales", summary: "Resistance to fire, cold, lightning, or acid. Pick the type in the trait name you select.", resistance: "fire" },
  { id: "major:leporine", name: "Leporine Instincts", summary: "Add your proficiency bonus to initiative. Bunny Hop is a bonus-action jump.", initiative: "pb" },
  { id: "major:natural-armor", name: "Natural Armor", summary: "While unarmored, or when armor would be worse, your AC is 13 + Dexterity. A shield still applies.", naturalArmor: true },
  { id: "major:powerful-build", name: "Powerful Build", summary: "Count as one size larger for grappling, shoving, and carrying.", carryMultiplier: 2 },
  { id: "major:claws", name: "Retractable Claws", summary: "Climb speed 20 feet. Claws deal 1d4 slashing.", climb: 20, naturalWeapon: { name: "Claws", dice: "1d4", ability: "best", type: "slashing" } },
  { id: "major:serpentine", name: "Serpentine Body", summary: "Crawl at full speed. Constrict can grapple and restrain.", note: "Serpentine body: crawl at full speed.", naturalWeapon: { name: "Constrict", dice: "1d6", ability: "str", type: "bludgeoning" } },
  { id: "major:taur", name: "Taur Body", summary: "Walking speed becomes 35 feet, and you count as one size larger for carrying.", speedSet: 35, carryMultiplier: 2 },
];

const MINOR: TraitDef[] = [
  { id: "minor:adorable-tail", name: "Adorable Tail", summary: "Proficiency in Persuasion.", skill: "Persuasion" },
  { id: "minor:animal-tongue", name: "Animal Tongue", summary: "Proficiency in Animal Handling.", skill: "Animal Handling" },
  { id: "minor:bestial-senses", name: "Bestial Senses", summary: "Advantage on Perception checks for sound and smell.", note: "Advantage on Perception (sound and smell)." },
  { id: "minor:bloodhound", name: "Bloodhound", summary: "Proficiency in Survival.", skill: "Survival" },
  { id: "minor:digitigrade", name: "Digitigrade Legs", summary: "Walking speed increases by 5 feet.", speedBonus: 5 },
  { id: "minor:exotic-colors", name: "Exotic Colors", summary: "Proficiency in Performance.", skill: "Performance" },
  { id: "minor:airways", name: "Expanded Airways", summary: "Hold your breath for 15 minutes.", note: "Hold breath 15 minutes." },
  { id: "minor:frog-legs", name: "Frog Legs", summary: "Long jump 25 feet and high jump 15 feet.", note: "Long jump 25 ft., high jump 15 ft." },
  { id: "minor:udders", name: "Full Udders", summary: "Feed two creatures for temporary hit points equal to your proficiency bonus.", note: "Full Udders: temp HP equal to proficiency bonus." },
  { id: "minor:goat-hooves", name: "Goat Hooves", summary: "Ignore difficult terrain when you Dash.", note: "Ignore difficult terrain while dashing." },
  { id: "minor:heightened", name: "Heightened Senses", summary: "Proficiency in Perception.", skill: "Perception" },
  { id: "minor:long-tail", name: "Long Tail", summary: "Proficiency in Acrobatics.", skill: "Acrobatics" },
  { id: "minor:monkey-feet", name: "Monkey Feet", summary: "Climb speed equals your walking speed.", climb: "speed" },
  { id: "minor:camouflage", name: "Natural Camouflage", summary: "Proficiency in Stealth.", skill: "Stealth" },
  { id: "minor:oxen", name: "Oxen Muscles", summary: "Proficiency in Athletics.", skill: "Athletics" },
  { id: "minor:quills", name: "Pointed Quills", summary: "A creature grappling you takes 1d8 damage at the start of its turn.", note: "Quills: 1d8 to a grappler." },
  { id: "minor:sharp-teeth", name: "Sharp Teeth", summary: "Bite deals 1d6 piercing.", naturalWeapon: { name: "Bite", dice: "1d6", ability: "str", type: "piercing" } },
  { id: "minor:visage", name: "Terrifying Visage", summary: "Proficiency in Intimidation. Use Strength if it is higher than Charisma.", skill: "Intimidation" },
  { id: "minor:tough-hide", name: "Tough Hide", summary: "Resistance to non-technical bludgeoning, piercing, or slashing. The pick records the type.", resistance: "bludgeoning" },
];

const RESISTANCE_TYPES = ["fire", "cold", "lightning", "acid"];
const HIDE_TYPES = ["bludgeoning", "piercing", "slashing"];

function withType(trait: TraitDef, types: string[], prefix: string): TraitDef[] {
  return types.map((type) => ({ ...trait, id: `${prefix}:${type}`, name: `${trait.name} (${type})`, resistance: type }));
}

const MAJOR_PICKS = MAJOR.flatMap((trait) => trait.id === "major:kaiju-scales" ? withType(trait, RESISTANCE_TYPES, trait.id) : [trait]);
const MINOR_PICKS = MINOR.flatMap((trait) => trait.id === "minor:tough-hide" ? withType(trait, HIDE_TYPES, trait.id) : [trait]);

const SKILL = (id: string, name: string, skill: string): TraitDef => ({ id, name, summary: `Proficiency in ${skill}.`, skill });

export function traitById(id: string) {
  return [...MAJOR_PICKS, ...MINOR_PICKS, ...skillTraits(), ...toolTraits()].find((trait) => trait.id === id) ?? null;
}

function skillTraits(): TraitDef[] {
  return [
    SKILL("gobbo:deception", "Motormouth: Deception", "Deception"),
    SKILL("gobbo:intimidation", "Motormouth: Intimidation", "Intimidation"),
    SKILL("gobbo:persuasion", "Motormouth: Persuasion", "Persuasion"),
    SKILL("orcc:animal", "Community Gardens: Animal Handling", "Animal Handling"),
    SKILL("orcc:history", "Community Gardens: History", "History"),
    SKILL("orcc:insight", "Community Gardens: Insight", "Insight"),
    SKILL("orcc:medicine", "Community Gardens: Medicine", "Medicine"),
    SKILL("orcc:survival", "Community Gardens: Survival", "Survival"),
  ];
}

function toolTraits(): TraitDef[] {
  return [
    { id: "jerboan:mechanic", name: "Mechanic’s tools", summary: "Desert Mechanic tool.", tool: "mechanic’s tools" },
    { id: "jerboan:electrician", name: "Electrician’s tools", summary: "Desert Mechanic tool.", tool: "electrician’s tools" },
    { id: "jerboan:builder", name: "Builder’s tools", summary: "Desert Mechanic tool.", tool: "builder’s tools" },
  ];
}

export function traitGroups(character: Pick<Character, "lineageId" | "sublineage" | "lineageOption" | "asiPicks">): TraitGroup[] {
  const groups: TraitGroup[] = [];
  const sub = (character.sublineage ?? "").toLowerCase();
  if (character.lineageId === "race:splicer") {
    groups.push({ id: "major", title: "Major splice (choose 1)", max: 1, traits: MAJOR_PICKS });
    groups.push({ id: "minor", title: "Minor splices (choose 2)", max: 2, traits: MINOR_PICKS });
  }
  if (character.lineageId === "race:jerboan" && sub.includes("nu metal")) {
    groups.push({ id: "nu-major", title: "Down With the Sickness (one major splice)", max: 1, traits: MAJOR_PICKS });
  }
  if (character.lineageId === "race:new-human" && character.lineageOption === "Specialized Predisposition") {
    const featGrantsScore = character.asiPicks.some((pick) => pick.mode === "feat" && pick.abilities && Object.values(pick.abilities).some((amount) => (amount ?? 0) > 0));
    if (!featGrantsScore) groups.push({ id: "human-minor", title: "Minor splice (the feat did not raise a score)", max: 1, traits: MINOR_PICKS });
  }
  if (character.lineageId === "race:gobbo") {
    groups.push({ id: "gobbo", title: "Motormouth (choose 1)", max: 1, traits: skillTraits().filter((trait) => trait.id.startsWith("gobbo:")) });
  }
  if (character.lineageId === "race:orcc") {
    groups.push({ id: "orcc", title: "Community Gardens (choose 1)", max: 1, traits: skillTraits().filter((trait) => trait.id.startsWith("orcc:")) });
  }
  if (character.lineageId === "race:jerboan") {
    groups.push({ id: "jerboan-tool", title: "Desert Mechanic (choose 1 tool)", max: 1, traits: toolTraits() });
  }
  return groups;
}

export function activeTraits(character: Pick<Character, "lineagePicks">): TraitDef[] {
  return (character.lineagePicks ?? []).map((id) => traitById(id)).filter((trait): trait is TraitDef => Boolean(trait));
}

export function traitAbility(trait: TraitDef, mods: Record<Ability, number>): Ability {
  if (!trait.naturalWeapon || trait.naturalWeapon.ability !== "best") return trait.naturalWeapon?.ability === "dex" ? "dex" : "str";
  return mods.dex > mods.str ? "dex" : "str";
}
