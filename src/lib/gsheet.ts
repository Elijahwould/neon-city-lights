import * as XLSX from "xlsx";
import type { Ability, Character, Rules } from "./types";
import type { Derived } from "./character";
import { findClass, findSubclass } from "./character";
import { gearBalance, gearLedger, startingMoney } from "./creation";

const SCORE_INPUT: Record<Ability, string> = { str: "C16", dex: "C21", con: "C26", int: "C31", wis: "C36", cha: "C41" };
const BONUS_INPUT: Record<Ability, string> = { str: "D16", dex: "D21", con: "D26", int: "D31", wis: "D36", cha: "D41" };
const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

const SKILL_ROW: Record<string, number> = {
  acrobatics: 25,
  "animal handling": 26,
  technology: 27,
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
  "sleight of hand": 40,
  stealth: 41,
  survival: 42,
};

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

export const SHEET_UNMAPPED = [
  "Age, height, weight, eyes, hair, skin, and appearance URL have no fields on the runner",
  "Allies and organizations",
  "Rolled hit points per level (the sheet uses its average when those cells stay blank)",
  "Per-level advantage and disadvantage overrides",
  "Player name sits in a label cell, so it is left alone",
  "Cybernetics are not written; the wiki has no starting cybernetic package and that picker is later",
  "A second techcasting ability, when two classes cast with different scores",
];

function column(sheet: XLSX.WorkSheet, letter: string, start: number, end: number) {
  const values: string[] = [];
  for (let row = start; row <= end; row += 1) {
    const value = sheet[`${letter}${row}`]?.v;
    if (typeof value === "string" && value.trim()) values.push(value.trim());
  }
  return values;
}

function closest(wanted: string, options: string[]) {
  const needle = wanted.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const exact = options.find((option) => option.toLowerCase().replace(/[^a-z0-9]+/g, "") === needle);
  if (exact) return exact;
  const contained = options
    .filter((option) => {
      const key = option.toLowerCase().replace(/[^a-z0-9]+/g, "");
      return key.length > 3 && (needle.includes(key) || key.includes(needle));
    })
    .sort((a, b) => b.length - a.length);
  return contained[0] ?? null;
}

function put(sheet: XLSX.WorkSheet, addr: string, value: string | number) {
  const current = sheet[addr];
  if (current?.f) return false;
  sheet[addr] = { ...(current ?? {}), t: typeof value === "number" ? "n" : "s", v: value };
  delete sheet[addr].f;
  return true;
}

function levelOf(start: number) {
  if (start <= 20 || (start >= 96 && start <= 98)) return 0;
  if ((start >= 100 && start <= 104) || (start >= 21 && start <= 25)) return 1;
  if ((start >= 106 && start <= 110) || (start >= 27 && start <= 31)) return 2;
  if ((start >= 112 && start <= 116) || (start >= 33 && start <= 37)) return 3;
  if ((start >= 118 && start <= 121) || (start >= 39 && start <= 42)) return 4;
  if ((start >= 123 && start <= 126) || (start >= 44 && start <= 47)) return 5;
  if ((start >= 128 && start <= 131) || (start >= 49 && start <= 52)) return 6;
  if ((start >= 133 && start <= 135) || (start >= 54 && start <= 56)) return 7;
  if ((start >= 137 && start <= 139) || (start >= 58 && start <= 60)) return 8;
  return 9;
}

function writeSpells(main: XLSX.WorkSheet, extra: XLSX.WorkSheet, spells: { name: string; level: number; prepared: boolean }[], unmapped: string[]) {
  const buckets: { name: string; prepared: boolean }[][] = Array.from({ length: 10 }, () => []);
  for (const spell of spells) buckets[Math.min(9, spell.level)]?.push(spell);
  const write = (sheet: XLSX.WorkSheet, ranges: typeof SPELL_RANGES) => {
    for (const [nameCol, prepCol, start, end] of ranges) {
      const bucket = buckets[levelOf(start)];
      for (let row = start; row <= end && bucket?.length; row += 1) {
        const spell = bucket.shift();
        if (!spell) break;
        if (!put(sheet, `${nameCol}${row}`, spell.name)) unmapped.push(`Tech name cell ${nameCol}${row} is a formula`);
        if (prepCol) put(sheet, `${prepCol}${row}`, spell.prepared ? 1 : 0);
      }
    }
  };
  write(main, SPELL_RANGES);
  write(extra, EXTRA_RANGES);
  const leftover = buckets.reduce((sum, bucket) => sum + bucket.length, 0);
  if (leftover) unmapped.push(`${leftover} techs did not fit in the template's tech rows`);
}

/** Fill the NCL GSheet v2.1 template. Formulas are left in place. */
export function fillNclWorkbook(template: XLSX.WorkBook, character: Character, rules: Rules, derived: Derived) {
  const book = template;
  const main = book.Sheets["v2.1"];
  const extra = book.Sheets.Additional;
  const inventory = book.Sheets.Inventory;
  const unmapped = [...SHEET_UNMAPPED];
  if (!main || !extra || !inventory) {
    unmapped.push("The template is missing the v2.1, Additional, or Inventory tab");
    return { book, unmapped };
  }
  const classNames = column(book.Sheets["Class Info"], "B", 7, 180);
  const subclassNames = column(book.Sheets["Class Info"], "E", 7, 180);
  const lineageNames = column(book.Sheets["Lineage Info"], "B", 7, 220);
  const weaponNames = column(book.Sheets["Attack Info"], "B", 7, 200);
  const armorNames = column(book.Sheets["Gear Info"], "B", 7, 40);

  put(main, "C6", character.name || "Unnamed");
  const classes = character.classLevels.length ? character.classLevels : character.classId ? [{ id: character.classId, level: character.level, subclassId: character.subclassId }] : [];
  const classText = classes.map((entry) => {
    const cls = findClass(rules, entry.id);
    const sub = findSubclass(rules, entry.subclassId);
    const className = closest(cls?.name ?? entry.id, classNames);
    const subclassName = sub ? closest(sub.name, subclassNames) : null;
    if (!className) unmapped.push(`Class ${cls?.name ?? entry.id} is not on the Class Info tab`);
    if (sub && !subclassName) unmapped.push(`Subclass ${sub.name} is not on the Class Info tab`);
    return [subclassName, className ?? cls?.name ?? entry.id, entry.level].filter(Boolean).join(" ");
  }).join(" ");
  put(main, "T5", classText);

  const lineage = rules.lineages.find((item) => item.id === character.lineageId);
  const lineageWanted = [lineage?.name, character.sublineage && lineage ? `${lineage.name} (${character.sublineage})` : ""].filter((name): name is string => Boolean(name));
  const lineageName = lineageWanted.map((name) => closest(name, lineageNames)).find((name): name is string => Boolean(name)) ?? null;
  if (lineage && !lineageName) unmapped.push(`Lineage ${lineage.name}${character.sublineage ? ` (${character.sublineage})` : ""} is not on the Lineage Info tab`);
  if (lineageName) put(main, "T7", lineageName);

  const upbringing = rules.upbringings.find((item) => item.id === character.upbringingId);
  if (upbringing) put(main, "AJ11", upbringing.name);
  put(main, "AE7", character.level >= 5 ? character.mpEarned : 0);

  for (const ability of ABILITIES) {
    put(main, SCORE_INPUT[ability], character.baseScores[ability] ?? 10);
    const lineageBonus = (character.lineageAsi[ability] ?? 0) + (character.subAsi[ability] ?? 0);
    const classBonus = character.asiPicks.reduce((sum, pick) => sum + (pick.abilities?.[ability] ?? 0), 0);
    if (lineageBonus + classBonus) put(main, BONUS_INPUT[ability], lineageBonus + classBonus);
  }

  for (const skill of derived.skills) {
    const row = SKILL_ROW[skill.name.toLowerCase()];
    if (!row) {
      unmapped.push(`Skill ${skill.name} has no row on the template`);
      continue;
    }
    put(main, `H${row}`, skill.expertise ? "e" : skill.proficient ? 1 : 0);
  }
  put(main, "H11", character.inspiration ? 1 : 0);

  const armor = rules.armor.find((item) => item.id === character.armorId);
  if (armor) {
    const name = closest(armor.name, armorNames);
    if (name) put(main, "AC45", name);
    else unmapped.push(`Armor ${armor.name} is not on the Gear Info tab`);
  }
  if (character.shield) put(main, "AC46", closest("Shield", armorNames) ?? "Shield");

  character.weapons.slice(0, 5).forEach((weapon, index) => {
    const item = rules.weapons.find((row) => row.id === weapon.id);
    const name = item ? closest(item.name, weaponNames) : null;
    if (item && !name) unmapped.push(`Weapon ${item.name} is not on the Attack Info tab`);
    put(main, `R${32 + index}`, name ?? item?.name ?? weapon.id);
  });
  if (character.weapons.length > 5) unmapped.push(`${character.weapons.length - 5} weapons past the five main attack rows were not copied there`);

  const caster = classes.map((entry) => findClass(rules, entry.id)).find((cls) => cls && (cls.caster !== "none" || cls.techAbility));
  if (caster) {
    const name = closest(caster.name, classNames);
    if (name) put(main, "C91", name);
  }

  const spells = [...character.techs, ...derived.grantedTechIds].filter((id, index, list) => list.indexOf(id) === index).map((id) => {
    const tech = rules.techs.find((item) => item.id === id);
    const inBook = character.prepared.includes(id) || Boolean(tech?.trick) || derived.grantedTechIds.includes(id);
    const prepared = derived.deckMax > 0 ? inBook : !character.prepared.length || inBook;
    return { name: tech?.name ?? id, level: tech?.trick || !tech?.level ? 0 : tech.level, prepared };
  });
  writeSpells(main, extra, spells, unmapped);

  const features = [
    ...character.fightingStyles.map((style) => `Fighting Style: ${style}`),
    ...derived.features,
    ...derived.featAsiNotes,
    `Speed: ${derived.speed} ft.`,
  ];
  features.slice(0, 26).forEach((feature, index) => put(main, `C${59 + index}`, feature));
  if (features.length > 26) unmapped.push(`${features.length - 26} features past row 84`);

  character.languages.forEach((language, index) => put(main, `R${45 + index}`, language));
  if (character.personality) put(main, "AE16", character.personality);
  if (character.ideals) put(main, "AE20", character.ideals);
  if (character.bonds) put(main, "AE24", character.bonds);
  if (character.flaws) put(main, "AE29", character.flaws);
  if (character.alignment) put(main, "AF28", character.alignment);
  const story = [character.concept, character.biography].filter(Boolean).join("\n");
  if (story) put(main, "R165", story);

  const balance = gearBalance(startingMoney(character.level).credits, gearLedger(character, rules));
  put(inventory, "D3", balance);
  const rows = [
    ...character.weapons.map((weapon) => ({ name: rules.weapons.find((item) => item.id === weapon.id)?.name ?? weapon.id, qty: 1, source: weapon.source || "" })),
    ...(armor ? [{ name: armor.name, qty: 1, source: character.armorSource || "" }] : []),
    ...character.inventory.map((item) => ({ name: item.name, qty: item.qty, source: item.notes })),
  ];
  rows.slice(0, 70).forEach((item, index) => {
    const row = 3 + index;
    put(inventory, `I${row}`, item.qty);
    put(inventory, `J${row}`, item.source ? `${item.name} (${item.source})` : item.name);
  });
  if (rows.length > 70) unmapped.push(`${rows.length - 70} inventory rows past the template`);

  return { book, unmapped };
}

export async function downloadFilledSheet(character: Character, rules: Rules, derived: Derived) {
  const response = await fetch("/data/ncl-gsheet-v2.1.xlsx");
  if (!response.ok) throw new Error("The sheet template did not load.");
  const template = XLSX.read(await response.arrayBuffer(), { type: "array", cellFormula: true });
  const { book, unmapped } = fillNclWorkbook(template, character, rules, derived);
  const filename = `${(character.name || "runner").replace(/[^\w\-]+/g, "-")}-ncl-sheet.xlsx`;
  XLSX.writeFile(book, filename);
  return unmapped;
}

/** Optional. Only runs when a public OAuth client id was baked in at build time. */
export async function createSheetInDrive(clientId: string, character: Character, rules: Rules, derived: Derived) {
  const response = await fetch("/data/ncl-gsheet-v2.1.xlsx");
  const template = XLSX.read(await response.arrayBuffer(), { type: "array", cellFormula: true });
  const { book } = fillNclWorkbook(template, character, rules, derived);
  const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const token = await new Promise<string>((resolve, reject) => {
    const client = (window as unknown as { google?: { accounts: { oauth2: { initTokenClient: (options: unknown) => { requestAccessToken: () => void } } } } }).google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (result: { access_token?: string; error?: string }) => result.access_token ? resolve(result.access_token) : reject(new Error(result.error || "Google did not return a token")),
    });
    client?.requestAccessToken();
  });
  const metadata = { name: `${character.name || "Runner"} NCL sheet`, mimeType: "application/vnd.google-apps.spreadsheet" };
  const body = new FormData();
  body.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  body.append("file", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const created = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!created.ok) throw new Error("Google Drive did not accept the sheet.");
  const file = await created.json() as { id: string };
  window.open(`https://docs.google.com/spreadsheets/d/${file.id}/edit`, "_blank", "noopener");
}
