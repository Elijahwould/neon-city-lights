#!/usr/bin/env python3
"""Turn the wiki Markdown mirror into JSON the app can load.

Writes public/data/catalog.json, public/data/rules.json, one JSON file per
page under public/data/entries/, public/data/parse-report.json, and wiki/INDEX.md.

Placeholder foe pages stay in the mirror and are omitted from the compendium.
Anything that cannot be turned into fields is kept as the page's Markdown.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / "wiki"
OUT = ROOT / "public" / "data"
ENTRIES = OUT / "entries"

EXCLUDED = {
    "foes:ai",
    "foeinfo-ai",
    "foe:020-amirani",
    "foe:050-hermesian",
    "foes:netsucker",
    "foeinfo-humanoid",
}

CLASSES = {
    "auditor": "Auditor",
    "brawler": "Brawler",
    "enforcer": "Enforcer",
    "influencer": "Influencer",
    "mechanist": "Mechanist",
    "ordinator": "Ordinator",
    "outlaw": "Outlaw",
    "pretender": "Pretender",
    "renegade": "Renegade",
    "ronin": "Ronin",
    "shutin": "Shut-In",
    "sourcecoder": "Source Coder",
    "streamer": "Streamer",
    "streetfighter": "Street Fighter",
    "techwizard": "Techwizard",
}
EXTRA_LISTS = {"hacktivist", "techno-blade", "technoblade"}
SECTORS = {
    "altercation", "biochemistry", "conception", "deception",
    "manifestation", "manipulation", "observation", "protection",
}
LEVEL_TAGS = {
    "trick": 0, "cantrip": 0, "first": 1, "second": 2, "third": 3, "fourth": 4,
    "fifth": 5, "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9,
}
SLOT_HEADERS = {"1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"}
SKILL_ABILITY = {
    "acrobatics": "dex", "athletics": "str", "culture": "int", "deception": "cha",
    "history": "int", "insight": "wis", "intimidation": "cha", "investigation": "int",
    "medicine": "wis", "nature": "int", "perception": "wis", "performance": "cha",
    "persuasion": "cha", "sleight of hand": "dex", "stealth": "dex", "survival": "wis",
    "technology": "int", "animal handling": "wis",
}
NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9}
ABILITY = {
    "strength": "str", "dexterity": "dex", "constitution": "con",
    "intelligence": "int", "wisdom": "wis", "charisma": "cha",
}
SUBCLASS_WORDS = (
    "archetype", "specialty", "speciality", "clause", "clan", "mask", "discipline",
    "sponsor", "partnership", "channel", "path", "complex", "origin", "synergy", "specialization",
)
HUBS = {
    "class", "lineage", "upbringing", "feats", "techs", "class-tech-lists", "sector-tech-lists",
    "armor", "weapons", "cybernetics", "gear", "vehicles", "armor-modifications",
    "weapon-modifications", "vehicle-modifications", "highend-armor", "highend-weapons",
    "gizmos", "peripherals", "consumables", "keyrings", "burners", "foeinfo", "conditions",
    "home", "runnerinfo", "lootinfo", "worldinfo", "startinfo", "fixerinfo",
}
PREFIX = {
    "race": "lineage", "upbringing": "upbringing", "feat": "feat", "tech": "tech",
    "techs": "techlist", "techsector": "techlist", "armor": "armor", "amod": "armor-mod",
    "weapon": "weapon", "wmod": "weapon-mod", "cybernetic": "cybernetic", "gear": "gear",
    "vehicle": "vehicle", "vmod": "vehicle-mod", "highend-weapons": "highend-weapon",
    "highend-armor": "highend-armor", "gizmo": "gizmo", "peripheral": "peripheral",
    "consumable": "consumable", "keyring": "keyring", "burners": "burner", "foe": "foe",
    "foes": "foe", "npc": "npc", "con": "condition", "legend": "legend", "loc": "location",
    "district": "location", "region": "location", "sector": "location", "corp": "corporation",
    "org": "organization",
}
ROOT_CAT = {
    "rules": "rules", "leveling-and-rewards": "rules", "leveling-dual-system": "rules",
    "proposed-leveling": "rules", "multiclassing": "rules", "techcasting": "rules",
    "conditions": "rules", "notoriety": "rules", "downtime": "rules", "faq": "rules",
    "driving": "rules", "vehicle-mishaps": "rules", "defects": "rules", "education": "rules",
    "speed-kills": "rules", "splicing-regulations": "rules", "carbon-pink": "lore",
    "humanity": "lore", "neon-city": "lore", "undercity": "lore", "outskirts": "lore",
    "netscape": "lore", "netsuckers": "lore", "the-relic-wars": "lore", "notable-figures": "lore",
    "street-legends": "lore", "corporations": "lore", "organizations": "lore", "locations": "lore",
    "map": "lore", "weather": "lore", "glossary-of-terms": "lore", "bergs": "lore",
    "nepheline": "lore", "transmission": "lore", "hidden-terminal": "lore", "server-banks": "lore",
    "and-lo-the-tower-has-fallen": "lore", "becoming-a-fixer": "rules", "fixer-resources": "rules",
    "prestige": "rules", "resources": "rules",
}
LOOT_CATS = {"highend-weapon", "highend-armor", "gizmo", "peripheral", "consumable", "keyring", "burner", "armor-mod", "weapon-mod", "vehicle-mod"}
RARITIES = ("artifact", "legendary", "very rare", "rare", "uncommon", "common")


def parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end < 0:
        return {}, text
    meta: dict = {}
    for line in text[3:end].strip().splitlines():
        if ":" not in line:
            continue
        key, val = line.split(":", 1)
        val = val.strip()
        if val.startswith("[") and val.endswith("]"):
            meta[key.strip()] = [bytes(p, "utf-8").decode("unicode_escape") for p in re.findall(r'"((?:\\.|[^"\\])*)"', val)]
        elif val.startswith('"') and val.endswith('"'):
            meta[key.strip()] = bytes(val[1:-1], "utf-8").decode("unicode_escape")
        else:
            meta[key.strip()] = val
    return meta, text[end + 4 :].lstrip("\n")


def entry_filename(slug: str) -> str:
    return slug.replace(":", "__") + ".json"


def parse_tables(body: str) -> list[dict]:
    tables = []
    lines = body.splitlines()
    i = 0
    while i < len(lines):
        if lines[i].startswith("|") and i + 1 < len(lines) and re.match(r"^\|\s*-+", lines[i + 1]):
            def cells(line: str) -> list[str]:
                return [c.strip() for c in line.strip().strip("|").split("|")]
            header = cells(lines[i])
            i += 2
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(cells(lines[i]))
                i += 1
            tables.append({"header": header, "rows": rows})
            continue
        i += 1
    return tables


def ordinal(cell: str) -> int | None:
    m = re.match(r"(\d+)", cell.strip())
    return int(m.group(1)) if m else None


def num_token(text: str) -> int | None:
    text = text.strip().lower()
    if text in NUM_WORDS:
        return NUM_WORDS[text]
    return int(text) if text.isdigit() else None


def slot_value(cell: str) -> int:
    cell = cell.strip().replace("–", "-").replace("—", "-")
    if cell in {"", "-", "—", "–"}:
        return 0
    m = re.match(r"(\d+)", cell)
    return int(m.group(1)) if m else 0


def trick_count(cell: str) -> int:
    """'hovering helping hand +2' means that named trick plus two others."""
    text = cell.strip()
    if re.fullmatch(r"\d+", text):
        return int(text)
    plus = re.search(r"\+(\d+)", text)
    if plus:
        named = text.split("+", 1)[0].strip(" *-")
        return int(plus.group(1)) + (1 if named else 0)
    return slot_value(text)


def split_list(text: str) -> list[str]:
    text = re.sub(r"\s+and\s+", ", ", text, flags=re.I)
    parts = []
    for raw in text.split(","):
        p = raw.strip(" .")
        if not p or p.lower() in {"and", "or"}:
            continue
        if p.lower() == "tech":
            p = "Technology"
        parts.append(p)
    return parts


def category_for(slug: str, tags: list[str], crumbs: list[str]) -> str:
    if ":" not in slug and slug in CLASSES and "subclass" not in tags:
        return "class"
    if ":" in slug:
        prefix = slug.split(":", 1)[0]
        if prefix in CLASSES or "subclass" in tags:
            return "subclass"
        if prefix in PREFIX:
            return PREFIX[prefix]
    if slug in ROOT_CAT:
        return ROOT_CAT[slug]
    blob = " ".join(crumbs).lower()
    if "foe.info" in blob:
        return "foe"
    if "loot.info" in blob:
        return "gear"
    if "world.info" in blob:
        return "lore"
    if "start.info" in blob or "fixer.info" in blob or "runner.info" in blob:
        return "rules"
    return "other"


def summary_of(body: str) -> str:
    text = re.sub(r"```.*?```", " ", body, flags=re.S)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[#>*_`|]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > 220:
        text = text[:217].rsplit(" ", 1)[0] + "…"
    return text


def links_of(body: str) -> list[str]:
    found = []
    for href in re.findall(r"\]\((/[^)#\s]+)\)", body):
        slug = href.lstrip("/")
        if slug and slug not in found:
            found.append(slug)
    return found


def link_slug(cell: str) -> tuple[str, str]:
    m = re.search(r"\[([^\]]+)\]\(/([^)]+)\)", cell)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    plain = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", cell)
    plain = plain.strip("* ").strip()
    return plain, ""


def money(text: str) -> int | None:
    m = re.search(r"\$\$([0-9,]+)", text)
    return int(m.group(1).replace(",", "")) if m else None


def clip(text: str, limit: int = 360) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rsplit(" ", 1)[0] + "…"


def progression_tables(tables: list[dict]) -> list[dict]:
    out = []
    for table in tables:
        header = [h.lower() for h in table["header"]]
        if not any(h == "level" or h.endswith(" level") for h in header):
            continue
        level_idx = next(i for i, h in enumerate(header) if h == "level" or h.endswith(" level"))
        rows = []
        for raw in table["rows"]:
            if level_idx >= len(raw):
                continue
            level = ordinal(raw[level_idx])
            if not level:
                continue
            cells = {}
            for i, h in enumerate(table["header"]):
                if i != level_idx and i < len(raw):
                    cells[h.strip()] = raw[i].strip()
            rows.append({"level": level, "cells": cells})
        if rows:
            out.append({"header": table["header"], "rows": rows})
    return out


def class_table(tables: list[dict]) -> dict | None:
    progs = progression_tables(tables)
    for prog in progs:
        names = [h.lower() for h in prog["header"]]
        if any("feature" in h for h in names) and any("proficiency" in h for h in names):
            return prog
    return progs[0] if progs else None


def parse_level_row(row: dict) -> dict:
    features, slots, resources = [], [0] * 9, {}
    tricks = techs_known = pact_slots = pact_level = pb = None
    for key, val in row["cells"].items():
        lk = key.lower()
        if "proficiency" in lk:
            m = re.search(r"\d+", val)
            pb = int(m.group(0)) if m else None
        elif lk == "features":
            features = [f.strip() for f in val.split(",") if f.strip() and f.strip() not in {"—", "-", "–"}]
        elif key in SLOT_HEADERS:
            slots[int(key[0]) - 1] = slot_value(val)
        elif lk in {"tricks known", "trick known"}:
            tricks = trick_count(val)
        elif lk in {"techs known", "tech known"}:
            techs_known = slot_value(val)
        elif lk == "tech slots":
            pact_slots = slot_value(val)
        elif lk == "slot level":
            pact_level = ordinal(val)
        elif val and val not in {"-", "—", "–"}:
            resources[key] = val
    if pact_slots and pact_level:
        slots = [0] * 9
        slots[pact_level - 1] = pact_slots
    return {
        "level": row["level"], "pb": pb, "features": features, "slots": slots,
        "tricks": tricks, "techsKnown": techs_known, "pactSlots": pact_slots,
        "pactLevel": pact_level, "resources": resources,
    }


def one_line(text: str, limit: int = 180) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("$$", "$")
    text = re.sub(r"[*_`]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""
    match = re.match(r"^(.+?[.!?])(?:\s+|$)", text)
    line = match.group(1) if match and len(match.group(1)) >= 12 else text
    if len(line) > limit:
        return line[: limit - 1].rstrip() + "…"
    return line


def clean_line(text: str, limit: int = 280) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("$$", "$")
    text = re.sub(r"[*_`]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > limit:
        return text[: limit - 1].rstrip() + "…"
    return text


def trait_bullets(block: str) -> list[dict]:
    rows = []
    for match in re.finditer(r"^- \*\*([^*]+)\.\*\*\s*(.+)$", block, re.M):
        raw = match.group(2)
        rows.append({"name": match.group(1).strip(), "line": one_line(raw), "full": clean_line(raw)})
    return rows


def asi_mode(text: str) -> str:
    low = text.lower()
    # Splicer is +2 and then either another +2 or two +1s, which also mentions "two".
    if "different one by 2" in low:
        return "splicer"
    if "three different" in low:
        return "spread"
    if "by 2" in low and "two" in low:
        return "flex"
    if "two different" in low and ("by 1" in low or "increase by 1" in low):
        return "plus1plus1"
    if re.search(r"\bby 2\b", low):
        return "plus2"
    if re.search(r"\bby 1\b", low):
        return "plus1"
    return "unknown"


def short_primary(sentence: str) -> str:
    groups = re.split(r"\band\b", sentence)
    rendered = []
    for group in groups:
        names = re.findall(r"Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma", group)
        if not names:
            continue
        if re.search(r"\bor\b", group) and len(names) > 1:
            rendered.append(" or ".join(names))
        else:
            rendered.append(" and ".join(names))
    return " and ".join(rendered)


def parse_class(slug: str, title: str, body: str, tables: list[dict], warnings: list[str]) -> dict:
    hit = re.search(r"\*\*Hit Dice:\*\*\s*(\d*)d(\d+)", body)
    hit_die = int(hit.group(2)) if hit else None
    avg = re.search(r"\*\*Hit Points at Higher Levels:\*\*\s*\d*d\d+\s*\(or (\d+)\)", body)
    hp_avg = int(avg.group(1)) if avg else (hit_die // 2 + 1 if hit_die else None)
    if not hit_die:
        warnings.append(f"{slug}: hit die not found")

    def field(label: str) -> str | None:
        m = re.search(rf"\*\*{label}:\*\*\s*(.+)", body)
        return m.group(1).strip() if m else None

    saves = [ABILITY.get(s.lower(), s.lower()[:3]) for s in split_list(field("Saving Throws") or "") if s]
    skills_raw = field("Skills") or ""
    skill_count, skill_options = 0, []
    sm = re.search(r"Choose (?:any )?(\w+)(?:\s+skills)? from (.+)", skills_raw, re.I)
    any_skills = re.search(r"Choose any (\w+)\s*$", skills_raw, re.I)
    if sm:
        skill_count = num_token(sm.group(1)) or 0
        skill_options = split_list(sm.group(2))
    elif any_skills:
        skill_count = num_token(any_skills.group(1)) or 0
        skill_options = ["*"]
    elif skills_raw:
        warnings.append(f"{slug}: skill line not parsed: {skills_raw}")

    eq = ""
    em = re.search(r"##### Equipment\n+([\s\S]*?)(?:\n##### |\n### |\n# )", body)
    if not em:
        em = re.search(r"(You start with the following equipment[\s\S]*?)(?:\n##### |\n### |\n# )", body)
    if em:
        eq = em.group(1).strip()

    ability = None
    am = re.search(r"(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) is your techcasting ability", body, re.I)
    if am:
        ability = ABILITY[am.group(1).lower()]
    prepared = None
    pm = re.search(r"equal to your (\w+) modifier \+ (half )?your [\w' \-]+level(?:, rounded down)?", body, re.I)
    if pm:
        prepared = {"ability": ABILITY.get(pm.group(1).lower(), pm.group(1).lower()[:3]), "halfLevel": bool(pm.group(2)), "minimum": 1}

    unarmored = None
    um = re.search(r"(?:AC|Armor Class) equals (\d+) \+ your (\w+) modifier(?: \+ your (\w+) modifier)?", body)
    if um:
        abilities = [ABILITY[um.group(2).lower()]]
        if um.group(3):
            abilities.append(ABILITY[um.group(3).lower()])
        para = body[max(0, um.start() - 200) : um.end() + 240].lower()
        unarmored = {
            "base": int(um.group(1)),
            "abilities": abilities,
            "allowsShield": "can use a shield" in para,
            "lightArmorUses": "con" if re.search(r"light armor.{0,80}Constitution instead of Dexterity", body, re.I | re.S) else None,
        }

    table = class_table(tables)
    levels = [parse_level_row(row) for row in table["rows"]] if table else []
    if not levels:
        warnings.append(f"{slug}: class table not found")

    subclass_level = None
    for lv in levels:
        if any(any(k in feat.lower() for k in SUBCLASS_WORDS) for feat in lv["features"]):
            subclass_level = lv["level"]
            break

    has_slots = any(any(lv["slots"]) or (lv.get("techsKnown") or 0) or (lv.get("tricks") or 0) for lv in levels)
    caster = "prepared" if prepared else "known" if has_slots else "none"
    minimum = re.search(r"\*\*Ability Score Minimum\.\*\*\s*(.+)", body)
    primary = short_primary(minimum.group(1)) if minimum else ""
    level1 = []
    first = next((lv for lv in levels if lv["level"] == 1), None)
    for feat in (first["features"] if first else []):
        names = [feat, re.sub(r"\s*\([^)]*\)", "", feat).strip()]
        heading = None
        for name in names:
            heading = re.search(rf"### {re.escape(name)}\n+([\s\S]*?)(?=\n### |\n## |\Z)", body)
            if heading:
                break
        level1.append({"name": feat, "line": one_line(heading.group(1)) if heading else ""})
    return {
        "id": slug, "name": title, "hitDie": hit_die, "hpAverage": hp_avg, "saves": saves,
        "armor": field("Armor") or "", "weapons": field("Weapons") or "", "tools": field("Tools") or "",
        "skillCount": skill_count, "skillOptions": skill_options, "equipment": eq,
        "techAbility": ability, "prepared": prepared, "caster": caster, "unarmored": unarmored,
        "subclassLevel": subclass_level, "levels": levels,
        "defenseHeavy": "when wearing heavy armor, this bonus increases to +2" in body.lower(),
        "primary": primary, "level1": level1,
    }


def parse_subclass(slug: str, title: str, body: str, tables: list[dict], class_id: str) -> dict:
    tech_prog = None
    granted = []
    for prog in progression_tables(tables):
        if any(h in SLOT_HEADERS for h in prog["header"]):
            tech_prog = []
            for row in prog["rows"]:
                parsed = parse_level_row(row)
                tech_prog.append({"level": parsed["level"], "slots": parsed["slots"], "tricks": parsed["tricks"], "techsKnown": parsed["techsKnown"]})
        else:
            for row in prog["rows"]:
                ids, names = [], []
                for key, val in row["cells"].items():
                    if "tech" not in key.lower():
                        continue
                    ids += re.findall(r"\]\(/([^)]+)\)", val)
                    names += re.findall(r"\[([^\]]+)\]", val)
                ids = [i for i in ids if i.startswith("tech:")]
                if ids or names:
                    granted.append({"level": row["level"], "techIds": ids, "names": names})
    sectors = []
    sm = re.search(r"must be (?:a |an )?([A-Za-z]+)(?: or ([A-Za-z]+))? tech", body, re.I)
    if sm:
        sectors = [g.lower() for g in sm.groups() if g and g.lower() in SECTORS]
    list_id = class_id
    if "/techs:techwizard" in body or "techwizard tech list" in body.lower():
        list_id = "techwizard"
    elif "/techs:" in body:
        lm = re.search(r"/techs:([a-z0-9\-]+)", body)
        if lm:
            list_id = lm.group(1)
    blurb = ""
    for para in re.split(r"\n\s*\n", body):
        para = para.strip()
        if not para or para.startswith(("#", ">", "!", "|", "-", "*")):
            continue
        if para.startswith("#####"):
            continue
        blurb = one_line(para, 200)
        break
    return {
        "id": slug, "name": title, "classId": class_id, "techProgression": tech_prog,
        "grantedTechs": granted, "sectors": sectors, "listId": list_id, "blurb": blurb,
    }


SKIP_HERITAGE = re.compile(r"naming|roleplaying|\bnames\b|major splice|minor splice", re.I)


def parse_lineage(slug: str, title: str, body: str) -> dict:
    features = re.search(r"\n# [^\n]*Features\n([\s\S]*?)(?=\n## |\Z)", body)
    base = re.split(r"\n### ", features.group(1) if features else body)[0]
    base_traits = trait_bullets(base)
    ability = next((row for row in base_traits if row["name"].lower().startswith("ability")), None)
    size_row = next((row for row in base_traits if row["name"].lower() == "size"), None)
    speed_row = next((row for row in base_traits if row["name"].lower() == "speed"), None)
    speed = None
    if speed_row:
        found = re.search(r"(\d+) feet", speed_row["line"])
        if found:
            speed = int(found.group(1))
    if speed is None:
        walking = re.search(r"(?:base )?walking speed is (\d+) feet", base, re.I)
        if walking:
            speed = int(walking.group(1))
    size = None
    if size_row:
        kind = re.search(r"(Small or Medium|Medium or Small|Small|Medium)", size_row["line"])
        size = kind.group(1) if kind else size_row["line"]
    languages = next((row["line"] for row in base_traits if "language" in row["line"].lower()), None)
    shown = {"ability score increase", "age", "size", "speed", "creature type"}
    traits = [{"name": row["name"], "line": row["line"]} for row in base_traits if row["name"].lower() not in shown]
    heritages = []
    for part in re.split(r"\n### ", body)[1:]:
        name = part.splitlines()[0].strip()
        if SKIP_HERITAGE.search(name):
            continue
        rest = re.split(r"\n## ", "\n".join(part.splitlines()[1:]))[0]
        rows = trait_bullets(rest)
        prose = []
        for line in rest.splitlines():
            line = line.strip()
            if not line or line.startswith(("-", "#", "!", "|", ">", "*")) or line.startswith("#####"):
                continue
            prose.append(line)
            if len(" ".join(prose)) > 40:
                break
        summary = one_line(" ".join(prose), 200) if prose else ""
        if not rows and not summary:
            continue
        asi_row = next((row for row in rows if row["name"].lower().startswith("ability")), None)
        heritages.append({
            "name": name,
            "asi": asi_mode(asi_row["full"]) if asi_row else "none",
            "asiText": asi_row["full"] if asi_row else None,
            "summary": summary,
            "traits": [{"name": row["name"], "line": row["line"]} for row in rows if not row["name"].lower().startswith("ability")],
        })
    low = base.lower()
    return {
        "id": slug, "name": title, "speed": speed, "speedText": speed_row["line"] if speed_row else None,
        "size": size, "asi": asi_mode(ability["full"]) if ability else "unknown",
        "asiText": ability["full"] if ability else None, "languages": languages,
        "traits": traits, "sublineages": heritages,
        "bonusFeat": "you gain one feat of your choice" in low or any(row["name"].lower() == "feat" for row in traits),
    }


def parse_upbringing(slug: str, title: str, body: str) -> dict:
    def grab(label: str) -> str | None:
        m = re.search(rf"\*\*{label}[.:]\*\*\s*(.+)", body)
        return m.group(1).strip() if m else None
    feat = None
    feature_line = None
    fm = re.search(r"### Feature:\s*(.+)\n+([\s\S]*?)(?=\n### |\Z)", body)
    if fm:
        feat = fm.group(1).strip()
        feature_line = clean_line(fm.group(2), 180)
    amounts = [int(a.replace(",", "")) for a in re.findall(r"\$\$([0-9,]+)", body)]
    equipment_block = re.search(r"\*\*Equipment\.\*\*\s*([\s\S]*?)(?=\n### |\Z)", body)
    equipment = ""
    if equipment_block:
        items = [one_line(item, 90) for item in re.findall(r"^\s*[-*]\s+(.+)$", equipment_block.group(1), re.M)]
        equipment = "; ".join(items) if items else one_line(equipment_block.group(1), 180)
    return {
        "id": slug, "name": title, "skills": split_list(grab("Skill Proficiencies") or ""),
        "tools": split_list(grab("Tool Proficiencies") or ""),
        "languages": grab("Languages") or grab("Language Proficiencies"),
        "weapons": grab("Weapon Proficiencies"),
        "equipment": equipment, "feature": feat, "featureLine": feature_line,
        "credits": max(amounts) if amounts else 0,
    }


def parse_tech(slug: str, title: str, tags: list[str], body: str) -> dict:
    level = next((n for tag, n in LEVEL_TAGS.items() if tag in tags), None)
    trick = "trick" in tags or "cantrip" in tags
    if level is None:
        m = re.search(r"\*(\d)(?:st|nd|rd|th)-level", body)
        if m:
            level = int(m.group(1))
        elif re.search(r"trick", body[:500], re.I):
            level, trick = 0, True
    sector = next((t for t in tags if t in SECTORS), None)
    if not sector:
        m = re.search(r"\*([A-Za-z]+) trick\*|\*(?:\d(?:st|nd|rd|th)-level )?([A-Za-z]+)\*", body)
        if m:
            word = (m.group(1) or m.group(2) or "").lower()
            if word in SECTORS:
                sector = word
    casting = {}
    for label, key in (("Casting Time", "castingTime"), ("Range", "range"), ("Components", "components"), ("Duration", "duration")):
        m = re.search(rf"\*\*{label}:\*\*\s*(.+)", body)
        if m:
            casting[key] = m.group(1).strip()
    return {
        "id": slug, "name": title, "level": level, "trick": trick or level == 0, "sector": sector,
        "classes": [t for t in tags if t in CLASSES or t in EXTRA_LISTS], **casting,
    }


def parse_stat_rows(tables: list[dict], kind: str) -> list[dict]:
    items = []
    for table in tables:
        header = [h.lower() for h in table["header"]]
        if "cost" not in header and kind != "gear":
            continue
        if "cost" not in header:
            continue
        for row in table["rows"]:
            padded = row + [""] * (len(table["header"]) - len(row))
            data = {table["header"][i].strip().lower(): padded[i].strip() for i in range(len(table["header"]))}
            name, slug = link_slug(padded[0])
            if not name or name.lower() in {"armor", "weapon", "gear", "cybernetic name"}:
                continue
            item = {"name": name, "id": slug, "cost": money(data.get("cost", "")), "kind": kind}
            for key in ("ac", "strength", "stealth", "weight", "damage", "properties", "features", "effect", "description"):
                if key in data and data[key]:
                    item[key] = clip(data[key].strip("* "), 500 if key in {"features", "description", "effect"} else 200)
            items.append(item)
    return items


def rarity_of(body: str) -> str | None:
    head = body[:900].lower()
    for rarity in RARITIES:
        if rarity in head:
            return rarity
    return None


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ENTRIES.mkdir(parents=True, exist_ok=True)
    for old in ENTRIES.glob("*.json"):
        old.unlink()

    pages = []
    for path in sorted(WIKI.glob("*.md")):
        if path.name.startswith("_") or path.name == "INDEX.md":
            continue
        meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        pages.append({
            "slug": meta.get("slug") or path.stem,
            "title": meta.get("title") or path.stem,
            "tags": meta.get("tags") or [],
            "breadcrumbs": meta.get("breadcrumbs") or [],
            "url": meta.get("url") or "",
            "body": body,
        })

    warnings: list[str] = []
    catalog, classes, subclasses, lineages, upbringings, techs, feats, foes = [], [], [], [], [], [], [], []
    by_cat = defaultdict(list)

    def page_body(slug: str) -> str:
        return next((p["body"] for p in pages if p["slug"] == slug), "")

    for page in pages:
        slug, body, tags = page["slug"], page["body"], page["tags"]
        if slug in EXCLUDED:
            warnings.append(f"excluded placeholder: {slug}")
            continue
        cat = category_for(slug, tags, page["breadcrumbs"])
        tables = parse_tables(body)
        structured: dict = {}
        partial = False
        if cat == "class" and slug in CLASSES:
            structured = parse_class(slug, page["title"], body, tables, warnings)
            classes.append(structured)
        elif cat == "subclass":
            class_id = slug.split(":", 1)[0]
            if class_id not in CLASSES:
                class_id = next((t for t in tags if t in CLASSES), class_id)
            structured = parse_subclass(slug, page["title"], body, tables, class_id)
            subclasses.append(structured)
        elif cat == "lineage":
            structured = parse_lineage(slug, page["title"], body)
            if structured["asi"] == "unknown" or structured["speed"] is None:
                partial = True
                warnings.append(f"{slug}: lineage traits kept as Markdown (asi={structured['asi']}, speed={structured['speed']})")
            lineages.append(structured)
        elif cat == "upbringing" and slug != "upbringing":
            structured = parse_upbringing(slug, page["title"], body)
            if not structured["skills"]:
                partial = True
                warnings.append(f"{slug}: upbringing skills not parsed")
            upbringings.append(structured)
        elif cat == "tech":
            structured = parse_tech(slug, page["title"], tags, body)
            if structured["level"] is None or not structured["classes"]:
                partial = True
                warnings.append(f"{slug}: tech level or class list incomplete")
            techs.append(structured)
        elif cat == "feat" and slug != "feats":
            prereq = None
            pm = re.search(r"\*\*Prerequisite(?:s)?:\*\*\s*(.+)", body)
            if pm:
                prereq = pm.group(1).strip()
            structured = {"id": slug, "name": page["title"], "prerequisite": prereq}
            feats.append(structured)
        elif cat == "foe":
            cm = re.search(r"Challenge(?:\*\*)?\s*:?\s*([0-9]+(?:/[0-9]+)?)", body)
            cr = cm.group(1) if cm else None
            if not cr and slug.startswith("foe:"):
                partial = True
                warnings.append(f"{slug}: no challenge rating in the stat block")
            structured = {"cr": cr}
            foes.append({"id": slug, "name": page["title"], "cr": cr})

        entry = {
            "id": slug, "title": page["title"], "category": cat, "tags": tags,
            "breadcrumbs": page["breadcrumbs"], "url": page["url"], "hub": slug in HUBS,
            "summary": summary_of(body), "markdown": body, "links": links_of(body),
            "structured": structured, "partial": partial,
        }
        (ENTRIES / entry_filename(slug)).write_text(json.dumps(entry, ensure_ascii=False), encoding="utf-8")
        light = {"id": slug, "title": page["title"], "category": cat, "tags": tags, "summary": entry["summary"], "hub": slug in HUBS, "partial": partial}
        if cat == "tech":
            light.update({"level": structured.get("level"), "sector": structured.get("sector"), "classes": structured.get("classes"), "trick": structured.get("trick")})
        if cat == "foe" and structured.get("cr"):
            light["cr"] = structured["cr"]
        if cat in LOOT_CATS or cat in {"gear", "weapon", "armor", "cybernetic"}:
            cost = money(body[:1200])
            if cost:
                light["cost"] = cost
            rarity = rarity_of(body)
            if rarity:
                light["rarity"] = rarity
        catalog.append(light)
        by_cat[cat].append(slug)

    weapon_cats = ["civilian-melee", "civilian-ranged", "military-melee", "military-ranged", "explosive"]
    weapons = []
    for ti, table in enumerate(t for t in parse_tables(page_body("weapons")) if any(h.lower() == "cost" for h in t["header"])):
        for item in parse_stat_rows([table], "weapon"):
            item["category"] = weapon_cats[ti] if ti < len(weapon_cats) else "weapon"
            weapons.append(item)
    armors = []
    for ti, table in enumerate(t for t in parse_tables(page_body("armor")) if any(h.lower() == "cost" for h in t["header"])):
        cat_name = ["light", "medium", "heavy", "shield"][ti] if ti < 4 else "armor"
        for item in parse_stat_rows([table], "armor"):
            item["category"] = cat_name
            armors.append(item)
    cybers = []
    for ti, table in enumerate(t for t in parse_tables(page_body("cybernetics")) if any(h.lower() == "cost" for h in t["header"])):
        tier = ["commercial", "mercenary", "executive"][ti] if ti < 3 else "cybernetic"
        for item in parse_stat_rows([table], "cybernetic"):
            item["tier"] = tier
            cybers.append(item)
    gear = parse_stat_rows(parse_tables(page_body("gear")), "gear")

    for group, prefix in ((weapons, "weapon:"), (armors, "armor:"), (cybers, "cybernetic:"), (gear, "gear:")):
        missing = [i["name"] for i in group if not i.get("id") or not str(i["id"]).startswith(prefix)]
        for name in missing:
            warnings.append(f"{prefix} row '{name}' has no page link")

    stat_by_id = {i["id"]: i for i in weapons + armors + cybers + gear if i.get("id")}
    for entry in catalog:
        stat = stat_by_id.get(entry["id"])
        if not stat:
            continue
        if stat.get("cost") is not None:
            entry["cost"] = stat["cost"]
        if stat.get("category"):
            entry["gearCategory"] = stat["category"]
        if stat.get("tier"):
            entry["tier"] = stat["tier"]
        if stat.get("damage"):
            entry["damage"] = stat["damage"]

    # MP chart
    mp = []
    for table in parse_tables(page_body("leveling-and-rewards")):
        header = [h.lower() for h in table["header"]]
        if "rank" in header and "level" in header:
            for row in table["rows"]:
                level = ordinal(row[0] if row else "")
                if not level:
                    continue
                cost_raw = row[2].strip().replace("—", "-").replace("–", "-") if len(row) > 2 else "-"
                mp.append({
                    "level": level,
                    "rank": row[1].strip() if len(row) > 1 else "",
                    "mpToNext": int(cost_raw) if cost_raw.isdigit() else None,
                    "totalMp": int(row[3]) if len(row) > 3 and row[3].strip().isdigit() else None,
                })

    rules = {
        "classes": sorted(classes, key=lambda c: c["name"]),
        "subclasses": sorted(subclasses, key=lambda s: (s["classId"], s["name"])),
        "lineages": sorted(lineages, key=lambda x: x["name"]),
        "upbringings": sorted(upbringings, key=lambda x: x["name"]),
        "feats": sorted(feats, key=lambda x: x["name"]),
        "techs": sorted(techs, key=lambda t: (t["level"] if t["level"] is not None else 99, t["name"])),
        "weapons": weapons, "armor": armors, "cybernetics": cybers, "gear": gear,
        "skills": [{"id": k, "name": k.title(), "ability": v} for k, v in SKILL_ABILITY.items()],
        "mpTable": mp,
        "standardArray": [15, 14, 13, 12, 10, 8],
        "pointBuy": {"budget": 27, "min": 8, "max": 15, "costs": {str(n): c for n, c in {8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9}.items()}},
        "serverStart": {"level": 5, "credits": 40000},
        "excluded": sorted(EXCLUDED),
    }
    catalog.sort(key=lambda e: (e["category"], e["title"].lower()))
    (OUT / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
    (OUT / "rules.json").write_text(json.dumps(rules, ensure_ascii=False), encoding="utf-8")

    lines = ["# Neon City Lights wiki mirror", "", "Generated by `scripts/crawl_wiki.py` and `scripts/parse_wiki.py`.", "", f"{len(pages)} pages mirrored. {len(catalog)} published. {len(EXCLUDED)} placeholder foe pages excluded from the compendium.", "", "## Categories", ""]
    for cat in sorted(by_cat):
        lines.append(f"### {cat} ({len(by_cat[cat])})")
        lines.append("")
        for slug in sorted(by_cat[cat], key=str.lower)[:8]:
            lines.append(f"- `{slug}`")
        if len(by_cat[cat]) > 8:
            lines.append(f"- … {len(by_cat[cat]) - 8} more")
        lines.append("")
    (WIKI / "INDEX.md").write_text("\n".join(lines), encoding="utf-8")

    class_report = []
    for c in classes:
        lv1 = next((lv for lv in c["levels"] if lv["level"] == 1), None)
        lv5 = next((lv for lv in c["levels"] if lv["level"] == 5), None)
        class_report.append({
            "id": c["id"], "hitDie": c["hitDie"], "saves": c["saves"], "skills": c["skillCount"],
            "caster": c["caster"], "ability": c["techAbility"], "subclass": c["subclassLevel"],
            "levels": len(c["levels"]), "pb5": lv5["pb"] if lv5 else None,
            "slots5": lv5["slots"] if lv5 else None, "tricks5": lv5["tricks"] if lv5 else None,
            "known5": lv5["techsKnown"] if lv5 else None,
        })
    report = {
        "pages": len(pages), "catalog": len(catalog), "excluded": sorted(EXCLUDED),
        "counts": {k: len(v) for k, v in sorted(by_cat.items())},
        "classes": class_report,
        "weapons": len(weapons), "armor": len(armors), "cybernetics": len(cybers), "gear": len(gear),
        "techsMissingLevel": [t["id"] for t in techs if t["level"] is None],
        "techsMissingList": [t["id"] for t in techs if not t["classes"]],
        "partial": [e["id"] for e in catalog if e.get("partial")],
        "warnings": warnings,
    }
    (OUT / "parse-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "catalog": len(catalog), "classes": len(classes), "subclasses": len(subclasses),
        "techs": len(techs), "lineages": len(lineages), "upbringings": len(upbringings),
        "feats": len(feats), "weapons": len(weapons), "armor": len(armors),
        "warnings": len(warnings), "partial": len(report["partial"]),
    }, indent=2))


if __name__ == "__main__":
    main()
