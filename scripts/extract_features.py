#!/usr/bin/env python3
"""Pull short feature and feat descriptions out of the wiki mirror."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / "wiki"
OUT = ROOT / "public" / "data" / "feature-text.json"


def clean(text: str, limit: int = 900) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("$$", "$")
    text = re.sub(r"[*_`>]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > limit:
        return text[: limit - 1].rstrip() + "…"
    return text


def prose(block: str) -> str:
    chunks: list[str] = []
    for line in block.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith(("|", "#", "#####", ">")):
            if chunks:
                break
            continue
        chunks.append(stripped)
        if len(" ".join(chunks)) > 700:
            break
    return clean(" ".join(chunks))


def level_in(text: str) -> int | None:
    match = re.search(r"(\d+)(?:st|nd|rd|th)\s+level", text, re.I)
    return int(match.group(1)) if match else None


def sections(body: str) -> list[tuple[str, str, int | None]]:
    rows = []
    for part in re.split(r"\n### ", body)[1:]:
        name = part.splitlines()[0].strip()
        if not name or name.lower().startswith("source"):
            continue
        rest = "\n".join(part.splitlines()[1:])
        text = prose(rest)
        if not text:
            continue
        rows.append((name, text, level_in(name + " " + text[:240])))
    return rows


def main() -> None:
    book: dict[str, dict] = {}
    for path in sorted(WIKI.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        meta, _, body = raw.partition("\n---\n")
        if not body:
            body = raw
        slug = path.stem
        title = path.stem
        match = re.search(r'^title:\s*"(.*)"', meta, re.M)
        if match:
            title = match.group(1)
        if slug in {
            "auditor", "brawler", "enforcer", "influencer", "mechanist", "ordinator", "outlaw",
            "pretender", "renegade", "ronin", "shutin", "sourcecoder", "streamer", "streetfighter", "techwizard",
        }:
            for name, text, level in sections(body):
                book[f"{slug}::{name}"] = {"text": text, "level": level, "source": title, "kind": "class"}
        elif ":" in slug and slug.split(":", 1)[0] in {
            "auditor", "brawler", "enforcer", "influencer", "mechanist", "ordinator", "outlaw",
            "pretender", "renegade", "ronin", "shutin", "sourcecoder", "streamer", "streetfighter", "techwizard",
        }:
            for name, text, level in sections(body):
                book[f"{slug}::{name}"] = {"text": text, "level": level, "source": title, "kind": "subclass"}
        elif slug.startswith("feat:"):
            text = prose(body)
            if text:
                book[slug] = {"text": text, "level": 1, "source": "Feat", "kind": "feat"}
    OUT.write_text(json.dumps(book, ensure_ascii=False), encoding="utf-8")
    print(f"features {len(book)} -> {OUT}")


if __name__ == "__main__":
    main()
