import * as XLSX from "xlsx";
import type { Character, Rules } from "./types";
import type { Derived } from "./character";
import { findClass, findSubclass } from "./character";

/** Cells Avrae reads from GSheet v2.1. Confirmed against cogs5e/sheets/gsheet.py. */
export const AVRAE_CELL_MAP = [
  "AQ4 version text containing 2.1, so Avrae opens the Additional and Inventory sheets",
  "C6 character name",
  "AL6 total level",
  "T7 lineage",
  "T5 class and subclass text",
  "AJ11 upbringing",
  "H14 proficiency bonus",
  "C15/C20/C25/C30/C35/C40 Strength through Charisma scores",
  "C13/C18/C23/C28/C33/C38 ability modifiers",
  "R12 armor class",
  "U16 maximum hit points",
  "V12 initiative",
  "H17:H22 and I17:I22 save proficiency marker and total",
  "H25:I42 skill proficiency marker and total (Technology is written on Arcana, Culture on Religion)",
  "R32:R36, Y32:Y36, AC32:AC36 first five attacks",
  "Additional!B3:M13 and W3:AH13 further attacks",
  "Additional!C69:N78 class name and level",
  "AK101, E107, AK113, E119, AK124, E129, AK134, E138, AK142 tech slots 1st through 9th",
  "D96:AH143 and Additional!D17:AH64 tech names, with the prep column beside each leveled tech",
  "U91 tech ability, AB91 tech DC, AI91 tech attack",
  "C59:C84 feature names",
  "AR58 all-check bonus set to 0 so the importer does not crash on a blank cell",
  "Inventory!D3/D6/D9/D12/D15 copper through platinum; Neon City dollars are stored as gold",
] as const;

const SKILL_ROW: Record<string, number> = {
  acrobatics: 25,
  "animal handling": 26,
  technology: 27,
  arcana: 27,
  athletics: 28,
  deception: 29,
  history: 30,
  insight: 31,
  intimidation: 32,
  investigation: 33,
  medicine: 34,
  nature: 35,
  perception: 36,
  performance: 37,
  persuasion: 38,
  culture: 39,
  religion: 39,
  "sleight of hand": 40,
  stealth: 41,
  survival: 42,
};

const SAVE_ROW: Record<string, number> = { str: 17, dex: 18, con: 19, int: 20, wis: 21, cha: 22 };
const SCORE_CELL = ["C15", "C20", "C25", "C30", "C35", "C40"];
const MOD_CELL = ["C13", "C18", "C23", "C28", "C33", "C38"];
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

const SPELL_RANGES: [string, string | null, number, number][] = [
  ["N", null, 96, 98], ["X", null, 96, 98], ["AH", null, 96, 98],
  ["D", "C", 100, 104], ["N", "M", 100, 104], ["X", "W", 100, 104],
  ["N", "M", 106, 110], ["X", "W", 106, 110], ["AH", "AG", 106, 110],
  ["D", "C", 112, 116], ["N", "M", 112, 116], ["X", "W", 112, 116],
  ["N", "M", 118, 121], ["X", "W", 118, 121], ["AH", "AG", 118, 121],
  ["D", "C", 123, 126], ["N", "M", 123, 126], ["X", "W", 123, 126],
  ["N", "M", 128, 131], ["X", "W", 128, 131], ["AH", "AG", 128, 131],
  ["D", "C", 133, 135], ["N", "M", 133, 135], ["X", "W", 133, 135],
  ["N", "M", 137, 139], ["X", "W", 137, 139], ["AH", "AG", 137, 139],
  ["D", "C", 141, 143], ["N", "M", 141, 143], ["X", "W", 141, 143],
];

const EXTRA_RANGES: [string, string | null, number, number][] = [
  ["N", null, 17, 19], ["X", null, 17, 19], ["AH", null, 17, 19],
  ["D", "C", 21, 25], ["N", "M", 21, 25], ["X", "W", 21, 25],
  ["N", "M", 27, 31], ["X", "W", 27, 31], ["AH", "AG", 27, 31],
  ["D", "C", 33, 37], ["N", "M", 33, 37], ["X", "W", 33, 37],
  ["N", "M", 39, 42], ["X", "W", 39, 42], ["AH", "AG", 39, 42],
  ["D", "C", 44, 47], ["N", "M", 44, 47], ["X", "W", 44, 47],
  ["N", "M", 49, 52], ["X", "W", 49, 52], ["AH", "AG", 49, 52],
  ["D", "C", 54, 56], ["N", "M", 54, 56], ["X", "W", 54, 56],
  ["N", "M", 58, 60], ["X", "W", 58, 60], ["AH", "AG", 58, 60],
  ["D", "C", 62, 64], ["N", "M", 62, 64], ["X", "W", 62, 64],
];

const SLOT_CELLS = ["AK101", "E107", "AK113", "E119", "AK124", "E129", "AK134", "E138", "AK142"];

function grid(rows = 180, cols = 50): (string | number)[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

function put(sheet: (string | number)[][], cell: string, value: string | number) {
  const match = cell.match(/^([A-Z]+)(\d+)$/);
  if (!match) return;
  let col = 0;
  for (const char of match[1]) col = col * 26 + char.charCodeAt(0) - 64;
  sheet[Number(match[2]) - 1][col - 1] = value;
}

function fillSpells(main: (string | number)[][], extra: (string | number)[][], spells: { name: string; level: number; prepared: boolean }[]) {
  const buckets: { name: string; prepared: boolean }[][] = Array.from({ length: 10 }, () => []);
  for (const spell of spells) buckets[spell.level]?.push(spell);
  const write = (sheet: (string | number)[][], ranges: typeof SPELL_RANGES) => {
    for (const [nameCol, prepCol, start, end] of ranges) {
      const bucket = buckets[levelFor(start)];
      for (let row = start; row <= end && bucket?.length; row += 1) {
        const spell = bucket.shift();
        if (!spell) break;
        put(sheet, `${nameCol}${row}`, spell.name);
        if (prepCol) put(sheet, `${prepCol}${row}`, spell.prepared ? 1 : 0);
      }
    }
  };
  write(main, SPELL_RANGES);
  write(extra, EXTRA_RANGES);
}

function levelFor(start: number): number {
  if (start <= 20 || (start >= 96 && start <= 98)) return 0;
  if (start >= 100 && start <= 104 || start >= 21 && start <= 25) return 1;
  if (start >= 106 && start <= 110 || start >= 27 && start <= 31) return 2;
  if (start >= 112 && start <= 116 || start >= 33 && start <= 37) return 3;
  if (start >= 118 && start <= 121 || start >= 39 && start <= 42) return 4;
  if (start >= 123 && start <= 126 || start >= 44 && start <= 47) return 5;
  if (start >= 128 && start <= 131 || start >= 49 && start <= 52) return 6;
  if (start >= 133 && start <= 135 || start >= 54 && start <= 56) return 7;
  if (start >= 137 && start <= 139 || start >= 58 && start <= 60) return 8;
  return 9;
}

export function buildAvraeWorkbook(character: Character, rules: Rules, derived: Derived) {
  const main = grid();
  const extra = grid(90, 50);
  const inventory = grid(80, 8);
  put(main, "AQ4", "Avrae GSheet v2.1");
  put(main, "AR58", 0);
  put(main, "C6", character.name || "Unnamed");
  put(main, "AL6", character.level);
  put(main, "T7", [rules.lineages.find((item) => item.id === character.lineageId)?.name, character.sublineage].filter(Boolean).join(" ") || "Humanoid");
  put(main, "T5", derived.classLabels || "Adventurer");
  put(main, "AJ11", rules.upbringings.find((item) => item.id === character.upbringingId)?.name || "");
  put(main, "H14", derived.pb);
  put(main, "R12", derived.ac);
  put(main, "U16", derived.hp);
  put(main, "V12", derived.initiative);
  ABILITY_KEYS.forEach((ability, index) => {
    put(main, SCORE_CELL[index], derived.scores[ability]);
    put(main, MOD_CELL[index], derived.mods[ability]);
  });
  for (const save of derived.saves) {
    const row = SAVE_ROW[save.ability];
    put(main, `I${row}`, save.mod);
    put(main, `H${row}`, save.proficient ? 1 : 0);
  }
  for (const skill of derived.skills) {
    const row = SKILL_ROW[skill.name.toLowerCase()];
    if (!row) continue;
    put(main, `I${row}`, skill.mod);
    put(main, `H${row}`, skill.expertise ? "e" : skill.proficient ? 1 : 0);
  }
  derived.attacks.slice(0, 5).forEach((attack, index) => {
    const row = 32 + index;
    put(main, `R${row}`, attack.name);
    put(main, `Y${row}`, attack.toHit);
    put(main, `AC${row}`, attack.damage);
  });
  derived.attacks.slice(5, 16).forEach((attack, index) => {
    const row = 3 + index;
    put(extra, `B${row}`, attack.name);
    put(extra, `I${row}`, attack.toHit);
    put(extra, `M${row}`, attack.damage);
  });
  const classes = character.classLevels.length ? character.classLevels : character.classId ? [{ id: character.classId, level: character.level, subclassId: character.subclassId }] : [];
  classes.slice(0, 10).forEach((entry, index) => {
    const cls = findClass(rules, entry.id);
    const sub = findSubclass(rules, entry.subclassId);
    put(extra, `C${69 + index}`, [sub?.name, cls?.name].filter(Boolean).join(" ") || entry.id);
    put(extra, `N${69 + index}`, entry.level);
  });
  derived.slots.forEach((count, index) => put(main, SLOT_CELLS[index], count));
  const abilityName = derived.techAbility === "str" ? "strength" : derived.techAbility === "dex" ? "dexterity" : derived.techAbility === "con" ? "constitution" : derived.techAbility === "int" ? "intelligence" : derived.techAbility === "wis" ? "wisdom" : derived.techAbility === "cha" ? "charisma" : "";
  put(main, "U91", abilityName);
  if (derived.techDc != null) put(main, "AB91", derived.techDc);
  if (derived.techAttack != null) put(main, "AI91", derived.techAttack);
  const spells = [...character.techs, ...derived.grantedTechIds].filter((id, index, list) => list.indexOf(id) === index).map((id) => {
    const tech = rules.techs.find((item) => item.id === id);
    const inBook = character.prepared.includes(id) || Boolean(tech?.trick) || derived.grantedTechIds.includes(id);
    const prepared = derived.deckMax > 0 ? inBook : !character.prepared.length || inBook;
    return { name: tech?.name ?? id, level: tech?.trick || !tech?.level ? 0 : Math.min(9, tech.level), prepared };
  });
  fillSpells(main, extra, spells);
  const features = [`Speed: ${derived.speed} ft.`, ...derived.features, ...derived.featAsiNotes];
  features.slice(0, 26).forEach((feature, index) => put(main, `C${59 + index}`, feature));
  put(inventory, "D12", character.credits);
  put(inventory, "A17", "Name");
  put(inventory, "B17", "Qty");
  put(inventory, "C17", "Notes");
  character.inventory.forEach((item, index) => {
    put(inventory, `A${18 + index}`, item.name);
    put(inventory, `B${18 + index}`, item.qty);
    put(inventory, `C${18 + index}`, item.notes);
  });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(main), "Sheet1");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(extra), "Additional");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(inventory), "Inventory");
  return book;
}

export function downloadAvrae(character: Character, rules: Rules, derived: Derived) {
  const book = buildAvraeWorkbook(character, rules, derived);
  XLSX.writeFile(book, `${(character.name || "runner").replace(/[^\w\-]+/g, "-")}-avrae.xlsx`);
}

export function downloadAvraeCsv(character: Character, rules: Rules, derived: Derived) {
  const book = buildAvraeWorkbook(character, rules, derived);
  const parts = book.SheetNames.map((name) => `# ${name}\n${XLSX.utils.sheet_to_csv(book.Sheets[name])}`);
  const blob = new Blob([parts.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${(character.name || "runner").replace(/[^\w\-]+/g, "-")}-avrae.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function characterAsText(character: Character, derived: Derived) {
  const lines = [
    `${character.name || "Unnamed"} · level ${character.level} · ${derived.classLabels}`,
    `AC ${derived.ac} · HP ${derived.hp} · speed ${derived.speed} · proficiency +${derived.pb}`,
    `Scores ${ABILITY_KEYS.map((ability) => `${ability.toUpperCase()} ${derived.scores[ability]}`).join(" ")}`,
    `Money $${character.credits.toLocaleString("en-US")}`,
    "Features:",
    ...derived.features.map((feature) => `- ${feature}`),
    "Inventory:",
    ...character.inventory.map((item) => `- ${item.qty}× ${item.name}`),
    "",
    JSON.stringify(character, null, 2),
  ];
  return lines.join("\n");
}
