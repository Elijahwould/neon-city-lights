export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

export const ABILITY_NAME: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export interface LevelRow {
  level: number;
  pb: number | null;
  features: string[];
  slots: number[];
  tricks: number | null;
  techsKnown: number | null;
  pactSlots: number | null;
  pactLevel: number | null;
  resources: Record<string, string>;
}

export interface Unarmored {
  base: number;
  abilities: Ability[];
  allowsShield: boolean;
  lightArmorUses: Ability | null;
}

export interface TraitLine {
  name: string;
  line: string;
}

export interface HeritageDef {
  name: string;
  asi: string;
  asiText: string | null;
  summary: string;
  traits: TraitLine[];
}

export interface ClassDef {
  id: string;
  name: string;
  hitDie: number | null;
  hpAverage: number | null;
  saves: Ability[];
  armor: string;
  weapons: string;
  tools: string;
  skillCount: number;
  skillOptions: string[];
  equipment: string;
  techAbility: Ability | null;
  prepared: { ability: Ability; halfLevel: boolean; minimum: number } | null;
  caster: "prepared" | "known" | "none" | string;
  unarmored: Unarmored | null;
  subclassLevel: number | null;
  levels: LevelRow[];
  defenseHeavy: boolean;
  primary: string;
  level1: TraitLine[];
}

export interface SubclassDef {
  id: string;
  name: string;
  classId: string;
  techProgression: { level: number; slots: number[]; tricks: number | null; techsKnown: number | null }[] | null;
  grantedTechs: { level: number; techIds: string[]; names: string[] }[];
  sectors: string[];
  listId: string;
  blurb: string;
}

export interface LineageDef {
  id: string;
  name: string;
  speed: number | null;
  speedText: string | null;
  size: string | null;
  asi: "flex" | "spread" | "plus1plus1" | "plus2" | "plus1" | "unknown" | string;
  asiText: string | null;
  languages: string | null;
  traits: TraitLine[];
  sublineages: HeritageDef[];
  bonusFeat: boolean;
}

export interface UpbringingDef {
  id: string;
  name: string;
  skills: string[];
  tools: string[];
  languages: string | null;
  weapons: string | null;
  equipment: string;
  feature: string | null;
  featureLine: string | null;
  credits: number;
}

export interface FeatDef {
  id: string;
  name: string;
  prerequisite: string | null;
}

export interface TechDef {
  id: string;
  name: string;
  level: number | null;
  trick: boolean;
  sector: string | null;
  classes: string[];
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
}

export interface WeaponDef {
  id: string;
  name: string;
  cost: number | null;
  damage?: string;
  weight?: string;
  properties?: string;
  features?: string;
  category: string;
}

export interface ArmorDef {
  id: string;
  name: string;
  cost: number | null;
  ac?: string;
  strength?: string;
  stealth?: string;
  weight?: string;
  category: string;
}

export interface CyberDef {
  id: string;
  name: string;
  cost: number | null;
  effect?: string;
  tier?: string;
}

export interface GearDef {
  id: string;
  name: string;
  cost: number | null;
  weight?: string;
  description?: string;
}

export interface SkillDef {
  id: string;
  name: string;
  ability: Ability;
}

export interface MpRow {
  level: number;
  rank: string;
  mpToNext: number | null;
  totalMp: number | null;
}

export interface Rules {
  classes: ClassDef[];
  subclasses: SubclassDef[];
  lineages: LineageDef[];
  upbringings: UpbringingDef[];
  feats: FeatDef[];
  techs: TechDef[];
  weapons: WeaponDef[];
  armor: ArmorDef[];
  cybernetics: CyberDef[];
  gear: GearDef[];
  skills: SkillDef[];
  mpTable: MpRow[];
  standardArray: number[];
  pointBuy: { budget: number; min: number; max: number; costs: Record<string, number> };
  serverStart: { level: number; credits: number };
  excluded: string[];
}

export interface ClassLevel {
  id: string;
  level: number;
  subclassId: string | null;
}

/** A trick or tech the runner chose for one class, feat, or fighting style. */
export interface TechPick {
  id: string;
  classId: string;
}

export interface AsiPick {
  level: number;
  classId?: string;
  mode: "asi" | "feat";
  abilities?: Partial<Record<Ability, number>>;
  featId?: string;
}

export interface CyberInstall {
  id: string;
  stat?: Ability;
  skill?: string;
}

export interface WeaponEquip {
  id: string;
  ability?: Ability;
  source?: string;
}

export interface InventoryItem {
  name: string;
  qty: number;
  notes: string;
}

export interface Character {
  id: string;
  version: 1;
  name: string;
  pronouns: string;
  concept: string;
  level: number;
  credits: number;
  mpEarned: number;
  xp: number;
  lineageId: string | null;
  sublineage: string | null;
  lineageAsi: Partial<Record<Ability, number>>;
  subAsi: Partial<Record<Ability, number>>;
  upbringingId: string | null;
  classId: string | null;
  subclassId: string | null;
  scoreMethod: "standard" | "pointbuy" | "roll" | "manual";
  rolledScores: number[];
  baseScores: Record<Ability, number>;
  classLevels: ClassLevel[];
  lineageOption: string | null;
  lineagePicks: string[];
  asiPicks: AsiPick[];
  playerName: string;
  alignment: string;
  personality: string;
  ideals: string;
  bonds: string;
  flaws: string;
  inspiration: boolean;
  hpCurrent: number | null;
  hpTemp: number;
  deathSuccess: number;
  deathFail: number;
  slotsExpended: number[];
  bonusSlots: number[];
  sourcePointsSpent: number;
  skillProfs: string[];
  skillExpertise: string[];
  toolProfs: string[];
  languages: string[];
  hpOverride: number | null;
  /** @deprecated Kept so older saves that toggled Defense still apply. Prefer fightingStyles. */
  defenseStyle: boolean;
  fightingStyles: string[];
  armorId: string | null;
  armorSource: string | null;
  shield: boolean;
  shieldSource: string | null;
  weapons: WeaponEquip[];
  techs: string[];
  /** Which class, feat, or style each chosen tech belongs to. Empty on older saves; the builder infers it from techs. */
  techPicks: TechPick[];
  prepared: string[];
  inventory: InventoryItem[];
  cybernetics: CyberInstall[];
  notes: string;
  biography: string;
  sheetNotes: Record<string, string>;
  choices: { label: string; value: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface CatalogEntry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  hub?: boolean;
  partial?: boolean;
  level?: number | null;
  sector?: string | null;
  classes?: string[];
  trick?: boolean;
  cost?: number;
  rarity?: string;
  gearCategory?: string;
  tier?: string;
  damage?: string;
  cr?: string;
}

export interface EntryDoc extends CatalogEntry {
  breadcrumbs: string[];
  url: string;
  markdown: string;
  links: string[];
}
