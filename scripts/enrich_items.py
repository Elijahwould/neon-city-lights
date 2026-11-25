#!/usr/bin/env python3
"""Read loot and feat pages in the wiki mirror and write the stats the builder shows."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / "wiki"
DATA = ROOT / "public" / "data"

LOOT_PREFIXES = (
    "weapon:", "armor:", "highend-weapons:", "highend-armor:", "cybernetic:", "gear:",
    "gizmo:", "peripheral:", "keyring:", "consumable:", "vehicle:", "vmod:", "burners:",
    "wmod:", "amod:",
)
ABILITIES = {
    "strength": "str", "dexterity": "dex", "constitution": "con",
    "intelligence": "int", "wisdom": "wis", "charisma": "cha",
}


def clean(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("$$", "$")
    text = re.sub(r"\*+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def front(path: Path) -> tuple[str, str, str]:
    raw = path.read_text(encoding="utf-8")
    if raw.startswith("---"):
        meta, _, body = raw.partition("\n---\n")
    else:
        meta, body = "", raw
    title = path.stem
    match = re.search(r'^title:\s*"(.*)"', meta, re.M)
    if match:
        title = match.group(1)
    return title, body, raw


def money(text: str) -> int | None:
    match = re.search(r"\$\$([0-9,]+)", text)
    return int(match.group(1).replace(",", "")) if match else None


def rarity_of(text: str) -> str | None:
    head = text[:700].lower()
    for name in ("artifact", "legendary", "very rare", "uncommon", "rare", "common"):
        if name in head:
            return name
    return None


def italic_specs(body: str) -> str:
    match = re.search(r"^\*([^*\n]+)\*", body, re.M)
    return clean(match.group(1)) if match else ""


def prose(body: str) -> str:
    chunks: list[str] = []
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", "#####", "|", ">", "*")):
            if chunks:
                break
            continue
        if stripped.lower().startswith("**specs"):
            continue
        chunks.append(stripped)
        if len(" ".join(chunks)) > 500:
            break
    return clean(" ".join(chunks))


def parse_weapon(spec: str) -> dict:
    damage = ""
    damage_type = ""
    match = re.match(r"(\d+d\d+(?:\s*\+\s*\d+)?)\s+([a-z]+)", spec, re.I)
    if match:
        damage, damage_type = match.group(1).replace(" ", ""), match.group(2).lower()
    properties = spec
    if match:
        properties = spec[match.end():].lstrip(" ,")
    return {"damage": damage, "damageType": damage_type, "properties": properties}


def parse_armor(spec: str) -> dict:
    ac = ""
    ac_match = re.search(r"AC\s*=\s*([^,]+)", spec, re.I)
    if ac_match:
        ac = ac_match.group(1).strip()
    strength = ""
    str_match = re.search(r"strength\s+(\d+)", spec, re.I)
    if str_match:
        strength = str_match.group(1)
    stealth = "disadvantage" if "disadvantage" in spec.lower() and "stealth" in spec.lower() else ""
    return {"ac": ac, "strengthReq": strength, "stealth": stealth}


def pack_lines(text: str) -> list[str]:
    match = re.search(r"this pack contains\s+(.+)", text, re.I)
    if not match:
        return []
    blob = match.group(1).strip().rstrip(".")
    parts = re.split(r",|\band\b", blob)
    return [clean(part) for part in parts if clean(part)]


def main() -> None:
    rules = json.loads((DATA / "rules.json").read_text(encoding="utf-8"))
    table: dict[str, dict] = {}
    for weapon in rules["weapons"]:
        table[weapon["id"]] = {
            "cost": weapon.get("cost"),
            "damage": weapon.get("damage") or "",
            "properties": weapon.get("properties") or "",
            "weight": weapon.get("weight") or "",
            "effect": weapon.get("features") or "",
        }
    for armor in rules["armor"]:
        table[armor["id"]] = {
            "cost": armor.get("cost"),
            "ac": armor.get("ac") or "",
            "strengthReq": re.sub(r"\D", "", armor.get("strength") or "") or "",
            "stealth": "disadvantage" if "disadvantage" in (armor.get("stealth") or "").lower() else "",
            "weight": armor.get("weight") or "",
        }
    for item in rules["gear"]:
        table[item["id"]] = {
            "cost": item.get("cost"),
            "weight": item.get("weight") or "",
            "description": item.get("description") or "",
        }
    for cyber in rules["cybernetics"]:
        table[cyber["id"]] = {
            "cost": cyber.get("cost"),
            "effect": cyber.get("effect") or "",
            "rarity": cyber.get("tier") or "",
        }

    items: dict[str, dict] = {}
    for path in sorted(WIKI.glob("*.md")):
        if not path.name.startswith(LOOT_PREFIXES):
            continue
        title, body, raw = front(path)
        slug = path.stem
        spec = italic_specs(body)
        specs_line = ""
        specs_match = re.search(r"\*\*Specs:\*\*\s*(.+)", body)
        if specs_match:
            specs_line = clean(specs_match.group(1))
        page_cost = money(raw)
        row = {
            "name": title,
            "cost": page_cost if page_cost is not None else table.get(slug, {}).get("cost"),
            "rarity": rarity_of(raw) or table.get(slug, {}).get("rarity") or "",
            "description": prose(body) or table.get(slug, {}).get("description") or "",
            "effect": "",
            "damage": "",
            "damageType": "",
            "properties": "",
            "ac": "",
            "strengthReq": "",
            "stealth": "",
            "weight": table.get(slug, {}).get("weight") or "",
            "contents": pack_lines(table.get(slug, {}).get("description") or "") or pack_lines(prose(body)),
        }
        if slug.startswith("weapon:") or slug.startswith("highend-weapons:"):
            parsed = parse_weapon(spec)
            row.update(parsed)
            if not row["damage"]:
                row["damage"] = table.get(slug, {}).get("damage") or ""
            if not row["properties"]:
                row["properties"] = table.get(slug, {}).get("properties") or spec
            row["effect"] = prose(body) or specs_line
        elif slug.startswith("armor:") or slug.startswith("highend-armor:"):
            row.update(parse_armor(spec))
            saved = table.get(slug, {})
            row["ac"] = row["ac"] or saved.get("ac") or ""
            row["strengthReq"] = row["strengthReq"] or saved.get("strengthReq") or ""
            row["stealth"] = row["stealth"] or saved.get("stealth") or ""
            row["effect"] = prose(body)
        elif slug.startswith(("wmod:", "amod:", "vmod:", "gizmo:", "peripheral:", "cybernetic:", "consumable:", "burner:", "keyring:")):
            row["effect"] = prose(body) or table.get(slug, {}).get("effect") or spec or specs_line
        else:
            row["effect"] = table.get(slug, {}).get("effect") or ""
        if specs_line and not row["description"]:
            row["description"] = specs_line
        items[slug] = row

    techs: dict[str, dict] = {}
    for path in sorted(WIKI.glob("tech:*.md")):
        title, body, raw = front(path)
        techs[path.stem] = {"name": title, "description": prose(body), "cost": money(raw)}

    feats: dict[str, dict] = {}
    for path in sorted(WIKI.glob("feat:*.md")):
        _, body, _ = front(path)
        match = re.search(
            r"Increase (?:your |the chosen |one )?(.+?) by (\d+), to a maximum of 20",
            body,
            re.I,
        )
        if not match:
            continue
        amount = int(match.group(2))
        phrase = match.group(1).lower()
        if "choice" in phrase or "chosen" in phrase:
            choices = list(ABILITIES.values())
        else:
            choices = [code for name, code in ABILITIES.items() if name in phrase]
        if not choices:
            continue
        feats[path.stem] = {"amount": amount, "choices": choices}

    (DATA / "item-details.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    (DATA / "tech-details.json").write_text(json.dumps(techs, ensure_ascii=False), encoding="utf-8")
    (DATA / "feat-asi.json").write_text(json.dumps(feats, ensure_ascii=False, indent=2), encoding="utf-8")

    def missing(rows: dict, field: str) -> int:
        return sum(1 for row in rows.values() if not row.get(field))

    print(json.dumps({
        "items": len(items),
        "noPrice": missing(items, "cost"),
        "noDescription": sum(1 for row in items.values() if not (row.get("description") or row.get("effect"))),
        "weapons": sum(1 for key in items if key.startswith("weapon:") or key.startswith("highend-weapon:")),
        "weaponsNoDamage": sum(1 for key, row in items.items() if key.startswith(("weapon:", "highend-weapons:")) and not row.get("damage")),
        "armorNoAc": sum(1 for key, row in items.items() if key.startswith(("armor:", "highend-armor:")) and not row.get("ac")),
        "modsNoEffect": sum(1 for key, row in items.items() if key.startswith(("wmod:", "amod:", "vmod:")) and not row.get("effect")),
        "techs": len(techs),
        "techsNoDescription": missing(techs, "description"),
        "featAsi": len(feats),
    }, indent=2))


if __name__ == "__main__":
    main()
