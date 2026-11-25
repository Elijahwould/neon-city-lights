#!/usr/bin/env python3
"""Collect creator names that the wiki itself states. Does not invent any."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / "wiki"
OUT = ROOT / "public" / "data" / "credits.json"

CARBON_PINK = [
    {"name": "Rapscallion", "role": "Art, lore, races"},
    {"name": "Kai Mirah", "role": "Unique mechanics and techs, balancing"},
    {"name": "Blackwingedheaven", "role": "Original class and equipment write-ups"},
    {"name": "Hetty", "role": "Lore, creatures, formatting and original Wiki maintenance"},
    {"name": "PeenusPeepl", "role": "Techs, loot and balancing"},
    {"name": "Natalie Porter Bridges", "role": "Write-ups for the Auditor class"},
    {"name": "Acorn Gamer", "role": "Additional loot, techs, creatures, proofreading"},
    {"name": "Nyanbinary", "role": "Additional loot, techs, creatures, proofreading"},
    {"name": "Takan Twins", "role": "Additional loot, techs, creatures, proofreading"},
    {"name": "King Cas", "role": "Additional loot, techs, creatures, proofreading"},
    {"name": "Tylon the Ninja", "role": "Additional loot, techs, creatures, proofreading"},
    {"name": "Pets in Winter", "role": "Additional loot, techs, creatures, proofreading"},
    {"name": "Spotlight Stageright", "role": "Additional loot, techs, creatures, proofreading"},
    {"name": "vex_xed", "role": "Additional loot, techs, creatures, proofreading"},
]


def main() -> None:
    pages: dict[str, list[str]] = defaultdict(list)
    for path in sorted(WIKI.glob("*.md")):
        if path.name.startswith("npc:") or path.name.startswith("_"):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        slug = path.stem
        for match in re.finditer(r"Writing Credit\.\*?\*?\s*([^\n]+)", text):
            name = match.group(1).strip().strip("*")
            if name and "handler" not in name.lower():
                pages[name].append(slug)
        for match in re.finditer(r"Thanks to ([^!\n]+?) for", text):
            chunk = match.group(1)
            if "handler" in chunk.lower():
                continue
            for part in re.split(r"\s+and\s+|,\s*", chunk):
                name = part.strip(" .")
                if name and len(name) < 60 and "whose" not in name.lower() and "handler" not in name.lower():
                    pages[name].append(slug)
    contributors = [
        {"name": name, "pages": sorted(set(slugs))[:8], "pageCount": len(set(slugs))}
        for name, slugs in sorted(pages.items(), key=lambda item: (-len(set(item[1])), item[0].lower()))
    ]
    feats = []
    for path in sorted((WIKI).glob("feat:*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        pre = re.search(r"\*Prerequisites?:([^*]+)\*", text)
        feats.append({"id": path.stem, "prerequisite": pre.group(1).strip() if pre else None})
    (ROOT / "public" / "data" / "feat-meta.json").write_text(json.dumps(feats), encoding="utf-8")
    OUT.write_text(json.dumps({
        "carbonPink": CARBON_PINK,
        "source": "wiki/carbon-pink.md",
        "wikiContributors": contributors,
    }, indent=2), encoding="utf-8")
    print(f"carbon pink {len(CARBON_PINK)} wiki names {len(contributors)}")


if __name__ == "__main__":
    main()
