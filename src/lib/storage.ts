import type { Character } from "./types";

const KEY = "ncl.characters.v1";

export function loadCharacters(): Character[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Character[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCharacters(list: Character[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function upsertCharacter(character: Character): Character[] {
  const list = loadCharacters().filter((c) => c.id !== character.id);
  const next = [{ ...character, updatedAt: new Date().toISOString() }, ...list];
  saveCharacters(next);
  return next;
}

export function deleteCharacter(id: string): Character[] {
  const next = loadCharacters().filter((c) => c.id !== id);
  saveCharacters(next);
  return next;
}

export function getCharacter(id: string): Character | null {
  return loadCharacters().find((c) => c.id === id) ?? null;
}

export function downloadCharacter(character: Character) {
  const blob = new Blob([JSON.stringify(character, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(character.name || "runner").replace(/[^\w\-]+/g, "-").toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function readCharacterFile(file: File): Promise<Character> {
  return file.text().then((text) => {
    const data = JSON.parse(text) as Character;
    if (!data || data.version !== 1 || !data.baseScores) {
      throw new Error("That file is not a Neon City Lights character.");
    }
    return data;
  });
}

function bytesToB64(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64ToBytes(value: string) {
  const pad = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "===".slice((pad.length + 3) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function encodeShare(character: Character): Promise<string> {
  const stream = new Blob([JSON.stringify(character)]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  return bytesToB64(buf);
}

export async function decodeShare(payload: string): Promise<Character> {
  const stream = new Blob([b64ToBytes(payload)]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  const data = JSON.parse(text) as Character;
  if (!data || data.version !== 1) throw new Error("This link is not a character.");
  return data;
}
