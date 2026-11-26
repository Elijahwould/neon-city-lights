import * as XLSX from "xlsx";
import type { Ability, Character, Rules } from "./types";
import type { Derived } from "./character";
import { findClass, findSubclass } from "./character";
import { sheetAttackName } from "./grants";
import { gearBalance, gearLedger, startingMoney } from "./creation";
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPE } from "./config";
import { writeValuesIntoXlsx, type CellWrite } from "./xlsx-values";

export type { CellWrite };

export interface SheetValueWrite {
  range: string;
  value: string | number;
}

interface WriteSink {
  writes: CellWrite[];
  unmapped: string[];
  formula: Set<string>;
}

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

function formulaKey(sheetName: string, addr: string) {
  return `${sheetName}!${addr}`;
}

function put(sink: WriteSink, sheetName: string, addr: string, value: string | number) {
  if (sink.formula.has(formulaKey(sheetName, addr))) {
    sink.unmapped.push(`Cell ${addr} on ${sheetName} is a formula, so it was left alone`);
    return false;
  }
  sink.writes.push({ sheet: sheetName, cell: addr, value });
  return true;
}

function applyWrite(sheet: XLSX.WorkSheet, addr: string, value: string | number) {
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

function writeSpells(sink: WriteSink, spells: { name: string; level: number; prepared: boolean }[]) {
  const buckets: { name: string; prepared: boolean }[][] = Array.from({ length: 10 }, () => []);
  for (const spell of spells) buckets[Math.min(9, spell.level)]?.push(spell);
  const write = (sheetName: string, ranges: typeof SPELL_RANGES) => {
    for (const [nameCol, prepCol, start, end] of ranges) {
      const bucket = buckets[levelOf(start)];
      for (let row = start; row <= end && bucket?.length; row += 1) {
        const spell = bucket.shift();
        if (!spell) break;
        put(sink, sheetName, `${nameCol}${row}`, spell.name);
        if (prepCol) put(sink, sheetName, `${prepCol}${row}`, spell.prepared ? 1 : 0);
      }
    }
  };
  write("v2.1", SPELL_RANGES);
  write("Additional", EXTRA_RANGES);
  const leftover = buckets.reduce((sum, bucket) => sum + bucket.length, 0);
  if (leftover) sink.unmapped.push(`${leftover} techs did not fit in the template's tech rows`);
}

function rangeFor(write: CellWrite) {
  return `'${write.sheet.replace(/'/g, "''")}'!${write.cell}`;
}

function collectFormulas(book: XLSX.WorkBook) {
  const formula = new Set<string>();
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    if (!sheet) continue;
    for (const addr of Object.keys(sheet)) {
      if (sheet[addr]?.f) formula.add(formulaKey(name, addr));
    }
  }
  return formula;
}

/** The cells a runner fills. Formula cells are omitted. */
export function sheetValueWrites(template: XLSX.WorkBook, character: Character, rules: Rules, derived: Derived) {
  const book = template;
  const main = book.Sheets["v2.1"];
  const extra = book.Sheets.Additional;
  const inventory = book.Sheets.Inventory;
  const sink: WriteSink = { writes: [], unmapped: [...SHEET_UNMAPPED], formula: collectFormulas(book) };
  if (!main || !extra || !inventory) {
    sink.unmapped.push("The template is missing the v2.1, Additional, or Inventory tab");
    return { writes: [] as SheetValueWrite[], cells: [] as CellWrite[], unmapped: sink.unmapped };
  }
  const classNames = column(book.Sheets["Class Info"], "B", 7, 180);
  const subclassNames = column(book.Sheets["Class Info"], "E", 7, 180);
  const lineageNames = column(book.Sheets["Lineage Info"], "B", 7, 220);
  const weaponNames = column(book.Sheets["Attack Info"], "B", 7, 200);
  const armorNames = column(book.Sheets["Gear Info"], "B", 7, 40);

  put(sink, "v2.1", "C6", character.name || "Unnamed");
  const classes = character.classLevels.length ? character.classLevels : character.classId ? [{ id: character.classId, level: character.level, subclassId: character.subclassId }] : [];
  const classText = classes.map((entry) => {
    const cls = findClass(rules, entry.id);
    const sub = findSubclass(rules, entry.subclassId);
    const className = closest(cls?.name ?? entry.id, classNames);
    const subclassName = sub ? closest(sub.name, subclassNames) : null;
    if (!className) sink.unmapped.push(`Class ${cls?.name ?? entry.id} is not on the Class Info tab`);
    if (sub && !subclassName) sink.unmapped.push(`Subclass ${sub.name} is not on the Class Info tab`);
    return [subclassName, className ?? cls?.name ?? entry.id, entry.level].filter(Boolean).join(" ");
  }).join(" ");
  put(sink, "v2.1", "T5", classText);

  const lineage = rules.lineages.find((item) => item.id === character.lineageId);
  const lineageWanted = [lineage?.name, character.sublineage && lineage ? `${lineage.name} (${character.sublineage})` : ""].filter((name): name is string => Boolean(name));
  const lineageName = lineageWanted.map((name) => closest(name, lineageNames)).find((name): name is string => Boolean(name)) ?? null;
  if (lineage && !lineageName) sink.unmapped.push(`Lineage ${lineage.name}${character.sublineage ? ` (${character.sublineage})` : ""} is not on the Lineage Info tab`);
  if (lineageName) put(sink, "v2.1", "T7", lineageName);

  const upbringing = rules.upbringings.find((item) => item.id === character.upbringingId);
  if (upbringing) put(sink, "v2.1", "AJ11", upbringing.name);
  put(sink, "v2.1", "AE7", character.level >= 5 ? character.mpEarned : 0);

  for (const ability of ABILITIES) {
    put(sink, "v2.1", SCORE_INPUT[ability], character.baseScores[ability] ?? 10);
    const lineageBonus = (character.lineageAsi[ability] ?? 0) + (character.subAsi[ability] ?? 0);
    const classBonus = character.asiPicks.reduce((sum, pick) => sum + (pick.abilities?.[ability] ?? 0), 0);
    if (lineageBonus + classBonus) put(sink, "v2.1", BONUS_INPUT[ability], lineageBonus + classBonus);
  }

  for (const skill of derived.skills) {
    const row = SKILL_ROW[skill.name.toLowerCase()];
    if (!row) {
      sink.unmapped.push(`Skill ${skill.name} has no row on the template`);
      continue;
    }
    put(sink, "v2.1", `H${row}`, skill.expertise ? "e" : skill.proficient ? 1 : 0);
  }
  put(sink, "v2.1", "H11", character.inspiration ? 1 : 0);

  const armor = rules.armor.find((item) => item.id === character.armorId);
  if (armor) {
    const name = closest(armor.name, armorNames);
    if (name) put(sink, "v2.1", "AC45", name);
    else sink.unmapped.push(`Armor ${armor.name} is not on the Gear Info tab`);
  }
  if (character.shield) put(sink, "v2.1", "AC46", closest("Shield", armorNames) ?? "Shield");

  character.weapons.slice(0, 5).forEach((weapon, index) => {
    const item = rules.weapons.find((row) => row.id === weapon.id);
    const wanted = item ? sheetAttackName(item, weapon) : weapon.id;
    const name = closest(wanted, weaponNames);
    if (item && !name) sink.unmapped.push(`Weapon ${wanted} is not on the Attack Info tab`);
    put(sink, "v2.1", `R${32 + index}`, name ?? wanted);
  });
  if (character.weapons.length > 5) sink.unmapped.push(`${character.weapons.length - 5} weapons past the five main attack rows were not copied there`);

  const caster = classes.map((entry) => findClass(rules, entry.id)).find((cls) => cls && (cls.caster !== "none" || cls.techAbility));
  if (caster) {
    const name = closest(caster.name, classNames);
    if (name) put(sink, "v2.1", "C91", name);
  }

  const spells = [...character.techs, ...derived.grantedTechIds].filter((id, index, list) => list.indexOf(id) === index).map((id) => {
    const tech = rules.techs.find((item) => item.id === id);
    const inBook = character.prepared.includes(id) || Boolean(tech?.trick) || derived.grantedTechIds.includes(id);
    const prepared = derived.deckMax > 0 ? inBook : !character.prepared.length || inBook;
    return { name: tech?.name ?? id, level: tech?.trick || !tech?.level ? 0 : tech.level, prepared };
  });
  writeSpells(sink, spells);

  const features = [
    ...character.fightingStyles.map((style) => `Fighting Style: ${style}`),
    ...derived.features,
    ...derived.featAsiNotes,
    `Speed: ${derived.speed} ft.`,
    derived.movement,
    ...derived.initiativeNotes.map((note) => `Initiative: ${note}`),
  ];
  features.slice(0, 26).forEach((feature, index) => put(sink, "v2.1", `C${59 + index}`, feature));
  if (features.length > 26) sink.unmapped.push(`${features.length - 26} features past row 84`);

  character.languages.forEach((language, index) => put(sink, "v2.1", `R${45 + index}`, language));
  if (character.personality) put(sink, "v2.1", "AE16", character.personality);
  if (character.ideals) put(sink, "v2.1", "AE20", character.ideals);
  if (character.bonds) put(sink, "v2.1", "AE24", character.bonds);
  if (character.flaws) put(sink, "v2.1", "AE29", character.flaws);
  if (character.alignment) put(sink, "v2.1", "AF28", character.alignment);
  const story = [character.concept, character.biography].filter(Boolean).join("\n");
  if (story) put(sink, "v2.1", "R165", story);

  const balance = gearBalance(startingMoney(character.level).credits, gearLedger(character, rules));
  put(sink, "Inventory", "D3", balance);
  const rows = [
    ...character.weapons.map((weapon) => ({ name: rules.weapons.find((item) => item.id === weapon.id)?.name ?? weapon.id, qty: 1, source: weapon.source || "" })),
    ...(armor ? [{ name: armor.name, qty: 1, source: character.armorSource || "" }] : []),
    ...character.inventory.map((item) => ({ name: item.name, qty: item.qty, source: item.notes })),
  ];
  rows.slice(0, 70).forEach((item, index) => {
    const row = 3 + index;
    put(sink, "Inventory", `I${row}`, item.qty);
    put(sink, "Inventory", `J${row}`, item.source ? `${item.name} (${item.source})` : item.name);
  });
  if (rows.length > 70) sink.unmapped.push(`${rows.length - 70} inventory rows past the template`);

  const writes = sink.writes.map((write) => ({ range: rangeFor(write), value: safeValue(write.value) }));
  return { writes, cells: sink.writes, unmapped: sink.unmapped };
}

function safeValue(value: string | number) {
  if (typeof value === "string" && /^[=+]/.test(value)) return `'${value}`;
  return value;
}

/** Fill a workbook in memory. Formulas are left in place. */
export function fillNclWorkbook(template: XLSX.WorkBook, character: Character, rules: Rules, derived: Derived) {
  const { cells, unmapped } = sheetValueWrites(template, character, rules, derived);
  for (const write of cells) {
    const sheet = template.Sheets[write.sheet];
    if (sheet) applyWrite(sheet, write.cell, write.value);
  }
  return { book: template, unmapped, writes: cells.map((write) => ({ range: rangeFor(write), value: safeValue(write.value) })) };
}

function bytesToArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function loadOriginalTemplate() {
  const response = await fetch("/data/ncl-gsheet-v2.1-original.xlsx");
  if (!response.ok) throw new Error("The original sheet template did not load.");
  return new Uint8Array(await response.arrayBuffer());
}

/** Download an .xlsx built from the original template bytes, so styles stay put. */
export async function downloadFilledSheet(character: Character, rules: Rules, derived: Derived) {
  const bytes = await loadOriginalTemplate();
  const template = XLSX.read(bytes, { type: "array", cellFormula: true });
  const { cells, unmapped } = sheetValueWrites(template, character, rules, derived);
  const patched = writeValuesIntoXlsx(bytes, cells);
  const blob = new Blob([bytesToArrayBuffer(patched.bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${(character.name || "runner").replace(/[^\w\-]+/g, "-")}-ncl.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
  return unmapped;
}

interface GoogleTokenClient {
  requestAccessToken: () => void;
}

function loadGoogleIdentity(): Promise<void> {
  const google = (window as unknown as { google?: { accounts?: { oauth2?: unknown } } }).google;
  if (google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-gsi]");
    const script = existing ?? document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.gsi = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in did not load. Check the connection and try again."));
    if (!existing) document.head.appendChild(script);
  });
}

const GOOGLE_EMAIL_KEY = "ncl.google.email";
const GOOGLE_CONSENT_KEY = "ncl.google.consented";

function rememberedGoogleAccount() {
  try {
    return {
      email: localStorage.getItem(GOOGLE_EMAIL_KEY) || "",
      consented: localStorage.getItem(GOOGLE_CONSENT_KEY) === "1",
    };
  } catch {
    return { email: "", consented: false };
  }
}

function rememberGoogleConsent() {
  try { localStorage.setItem(GOOGLE_CONSENT_KEY, "1"); } catch { /* private mode */ }
}

function rememberGoogleEmail(email: string) {
  try { localStorage.setItem(GOOGLE_EMAIL_KEY, email); } catch { /* private mode */ }
  rememberGoogleConsent();
}

/** Open the sheet as the account that owns it, not the browser's default Google user. */
export function sheetEditUrl(fileId: string, email: string) {
  return `https://docs.google.com/spreadsheets/d/${fileId}/edit?authuser=${encodeURIComponent(email)}`;
}

function requestDriveToken(clientId: string, forceConsent = false) {
  return new Promise<string>((resolve, reject) => {
    const oauth = (window as unknown as {
      google?: {
        accounts: {
          oauth2: {
            initTokenClient: (options: unknown) => GoogleTokenClient;
          };
        };
      };
    }).google?.accounts.oauth2;
    if (!oauth) {
      reject(new Error("Google sign-in did not load. Check the connection and try again."));
      return;
    }
    const remembered = rememberedGoogleAccount();
    const options: Record<string, unknown> = {
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (result: { access_token?: string; error?: string; error_description?: string }) => {
        if (result.access_token) {
          rememberGoogleConsent();
          resolve(result.access_token);
          return;
        }
        if (!forceConsent && (result.error === "interaction_required" || result.error === "consent_required")) {
          requestDriveToken(clientId, true).then(resolve, reject);
          return;
        }
        if (result.error === "access_denied" || result.error === "popup_closed") reject(new Error("Google sign-in was cancelled."));
        else reject(new Error(result.error_description || result.error || "Google did not return a token."));
      },
      error_callback: (error: { type?: string }) => {
        if (error.type === "popup_failed_to_open") reject(new Error("The Google sign-in window was blocked. Allow popups for this site, then try again."));
        else reject(new Error("Google sign-in was cancelled."));
      },
    };
    if (remembered.email) {
      options.hint = remembered.email;
      options.login_hint = remembered.email;
    }
    if (remembered.consented && !forceConsent) options.prompt = "";
    const client = oauth.initTokenClient(options);
    client.requestAccessToken();
  });
}

async function uploadOriginalTemplate(token: string, name: string, bytes: Uint8Array) {
  const boundary = `ncl-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name, mimeType: "application/vnd.google-apps.spreadsheet" });
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = new Blob([head, bytesToArrayBuffer(bytes), tail]);
  const created = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!created.ok) throw new Error("Google Drive did not accept the sheet.");
  return created.json() as Promise<{ id: string; webViewLink?: string }>;
}

async function driveAccountEmail(token: string, fileId: string) {
  const file = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent("owners(emailAddress)")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (file.ok) {
    const body = await file.json() as { owners?: { emailAddress?: string }[] };
    const email = body.owners?.find((owner) => owner.emailAddress)?.emailAddress;
    if (email) return email;
  }
  const about = await fetch(`https://www.googleapis.com/drive/v3/about?fields=${encodeURIComponent("user(emailAddress)")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!about.ok) throw new Error("Google created the sheet, but did not say which account owns it.");
  const body = await about.json() as { user?: { emailAddress?: string } };
  if (!body.user?.emailAddress) throw new Error("Google created the sheet, but did not say which account owns it.");
  return body.user.emailAddress;
}

/** Create a native Google Sheet from the unmodified template, then fill value cells. */
export async function createGoogleSheet(character: Character, rules: Rules, derived: Derived, clientId = GOOGLE_CLIENT_ID) {
  await loadGoogleIdentity();
  const token = await requestDriveToken(clientId);
  const bytes = await loadOriginalTemplate();
  const template = XLSX.read(bytes, { type: "array", cellFormula: true });
  const { writes, unmapped } = sheetValueWrites(template, character, rules, derived);
  const file = await uploadOriginalTemplate(token, `${character.name || "Runner"} NCL sheet`, bytes);
  const email = await driveAccountEmail(token, file.id);
  rememberGoogleEmail(email);
  const url = sheetEditUrl(file.id, email);
  const filled = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: writes.map((write) => ({ range: write.range, values: [[write.value]] })),
    }),
  });
  if (!filled.ok) {
    const detail = await filled.text().catch(() => "");
    throw new Error(`The sheet was created in ${email}, but the character cells were not written. ${url} ${detail}`.trim());
  }
  return { url, unmapped, email, fileId: file.id };
}

/** Grant writer access on a sheet this app created. drive.file covers that file. */
export async function shareGoogleSheet(fileId: string, email: string, clientId = GOOGLE_CLIENT_ID) {
  const address = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("Enter an email address.");
  await loadGoogleIdentity();
  const token = await requestDriveToken(clientId);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "writer", type: "user", emailAddress: address }),
  });
  if (!response.ok) throw new Error("Google did not share the sheet. Check the email and try again.");
}
