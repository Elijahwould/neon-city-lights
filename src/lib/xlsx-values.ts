import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export interface CellWrite {
  sheet: string;
  cell: string;
  value: string | number;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r\n|\n|\r/g, "&#10;");
}

/** Map a sheet tab name to its worksheet XML path inside the xlsx zip. */
export function worksheetPaths(files: Record<string, Uint8Array>) {
  const workbook = strFromU8(files["xl/workbook.xml"]);
  const rels = strFromU8(files["xl/_rels/workbook.xml.rels"]);
  const paths = new Map<string, string>();
  const sheets = workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g);
  for (const match of sheets) {
    const target = rels.match(new RegExp(`Id="${match[2]}"[^>]*Target="([^"]+)"`))?.[1];
    if (!target) continue;
    const file = target.replace(/^\//, "").replace(/^\.\.\//, "");
    paths.set(match[1], file.startsWith("xl/") ? file : `xl/${file}`);
  }
  return paths;
}

function cellXml(addr: string, attrs: string, value: string | number) {
  const style = attrs.replace(/\s+t="[^"]*"/, "");
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${addr}"${style}><v>${value}</v></c>`;
  return `<c r="${addr}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

/** Write values into a copy of an xlsx, leaving styles, merges, and formula cells alone. */
export function writeValuesIntoXlsx(bytes: Uint8Array, writes: CellWrite[]) {
  const files = unzipSync(bytes);
  const paths = worksheetPaths(files);
  const xml = new Map<string, string>();
  const skipped: string[] = [];
  for (const write of writes) {
    const path = paths.get(write.sheet);
    if (!path || !files[path]) {
      skipped.push(`${write.sheet}!${write.cell}`);
      continue;
    }
    if (!xml.has(path)) xml.set(path, strFromU8(files[path]));
    const source = xml.get(path)!;
    const pattern = new RegExp(`<c r="${write.cell}"([^>/]*)(?:/>|>([\\s\\S]*?)</c>)`);
    const found = source.match(pattern);
    if (!found) {
      skipped.push(`${write.sheet}!${write.cell}`);
      continue;
    }
    if (found[2]?.includes("<f")) {
      skipped.push(`${write.sheet}!${write.cell}`);
      continue;
    }
    xml.set(path, source.replace(found[0], cellXml(write.cell, found[1], write.value)));
  }
  for (const [path, text] of xml) files[path] = strToU8(text);
  return { bytes: zipSync(files), skipped };
}
