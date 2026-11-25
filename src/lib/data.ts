import type { CatalogEntry, EntryDoc, Rules } from "./types";

let rulesPromise: Promise<Rules> | null = null;
let catalogPromise: Promise<CatalogEntry[]> | null = null;

/** Hidden from the builder and compendium. The records stay in the data so an older runner still resolves. */
export const HIDDEN_LINEAGES = new Set(["race:human", "race:core"]);

export function isHiddenLineage(id: string) {
  return HIDDEN_LINEAGES.has(id);
}

export function loadRules(): Promise<Rules> {
  if (!rulesPromise) {
    rulesPromise = fetch("/data/rules.json").then((res) => {
      if (!res.ok) throw new Error("Could not load game data.");
      return res.json();
    });
  }
  return rulesPromise;
}

export function loadCatalog(): Promise<CatalogEntry[]> {
  if (!catalogPromise) {
    catalogPromise = fetch("/data/catalog.json").then((res) => {
      if (!res.ok) throw new Error("Could not load the compendium.");
      return res.json();
    });
  }
  return catalogPromise;
}

export function entryUrl(id: string) {
  return `/data/entries/${id.replace(/:/g, "__")}.json`;
}

export interface FlavorCard {
  book?: string | null;
  origin?: string | null;
  examples?: string[];
  blurb?: string | null;
  image?: string | null;
  credit?: string | null;
}

export interface FlavorFile {
  classes: Record<string, FlavorCard>;
  lineages: Record<string, FlavorCard>;
  credits: { subject: string; credit: string; page: string }[];
}

let flavorPromise: Promise<FlavorFile> | null = null;

export function loadFlavor(): Promise<FlavorFile> {
  if (!flavorPromise) {
    flavorPromise = fetch("/data/flavor.json").then((res) => {
      if (!res.ok) throw new Error("Could not load the wiki flavor notes.");
      return res.json();
    });
  }
  return flavorPromise;
}

export function originLabel(card?: FlavorCard | null) {
  if (!card) return "";
  const from = card.origin ? `from ${card.origin}` : "";
  return [from, card.book].filter(Boolean).join(" · ");
}

export function loadEntry(id: string): Promise<EntryDoc> {
  return fetch(entryUrl(id)).then((res) => {
    if (!res.ok) throw new Error("That page is not in the mirror.");
    return res.json();
  });
}

export const CATEGORY_LABEL: Record<string, string> = {
  lineage: "Lineages",
  class: "Classes",
  subclass: "Subclasses",
  upbringing: "Upbringings",
  feat: "Feats",
  tech: "Techs",
  techlist: "Tech lists",
  armor: "Armor",
  "armor-mod": "Armor mods",
  weapon: "Weapons",
  "weapon-mod": "Weapon mods",
  cybernetic: "Cybernetics",
  gear: "Gear",
  vehicle: "Vehicles",
  "vehicle-mod": "Vehicle mods",
  "highend-weapon": "High-end weapons",
  "highend-armor": "High-end armor",
  gizmo: "Gizmos",
  peripheral: "Peripherals",
  consumable: "Consumables",
  keyring: "Keyrings",
  burner: "Burners",
  foe: "Foes",
  condition: "Conditions",
  rules: "Rules",
  lore: "Lore",
  location: "Places",
  corporation: "Corporations",
  organization: "Organizations",
  npc: "People",
  legend: "Street legends",
  other: "Other pages",
};

export const GROUPS: { id: string; label: string; cats: string[] }[] = [
  { id: "runner", label: "Runner", cats: ["lineage", "class", "subclass", "upbringing", "feat", "tech", "techlist"] },
  {
    id: "loot",
    label: "Loot",
    cats: [
      "armor", "armor-mod", "weapon", "weapon-mod", "cybernetic", "gear", "vehicle", "vehicle-mod",
      "highend-weapon", "highend-armor", "gizmo", "peripheral", "consumable", "keyring", "burner",
    ],
  },
  { id: "foes", label: "Foes", cats: ["foe", "condition"] },
  { id: "rules", label: "Rules", cats: ["rules"] },
  { id: "lore", label: "Lore", cats: ["lore", "location", "corporation", "organization", "npc", "legend"] },
  { id: "other", label: "Other", cats: ["other"] },
];
