#!/usr/bin/env python3
"""Build public/data/flavor.json from the wiki mirror.

Origins come only from a page's Source line: a parenthetical name that is
not the page title, or an "adapted from" credit. Nothing is inferred.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / "wiki"
OUT = ROOT / "public" / "data" / "flavor.json"
ART = ROOT / "public" / "art"


def front(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    raw, body = text[3:end], text[end + 4 :]
    meta: dict[str, str] = {}
    for line in raw.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip().strip('"')
    return meta, body


def sentences(text: str, count: int = 2) -> str:
    clean = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r"(?<=[.!?])\s+", clean)
    return " ".join(parts[:count])[:360].strip()


def parse_source(line: str, title: str) -> tuple[str | None, str | None]:
    raw = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line)
    raw = re.sub(r"^#+\s*Source:\s*", "", raw).strip()
    origin = None
    adapted = re.search(r"adapted from\s+([^,\n]+)", raw, re.I)
    if adapted:
        phrase = re.sub(r"\s+", " ", adapted.group(1)).strip(" .")
        for token in ("Blood Hunter", "Pugilist", "Warlord"):
            if token.lower() in phrase.lower():
                origin = token
                break
        origin = origin or phrase
    else:
        for name in re.findall(r"\(([^)]+)\)", raw):
            name = re.sub(r"\s+", " ", name).strip()
            if not name or name.lower() == title.lower():
                continue
            if len(name) > 80 or len(name) < 3 or name.lower() in {"revised", "homebrew"}:
                continue
            if re.search(r"http|thanks|patreon|homebrew by|neon city", name, re.I):
                continue
            origin = origin or name
    head = re.split(r"[\(\[]", raw, maxsplit=1)[0]
    books = [part.strip(" ,") for part in head.split(",") if part.strip(" ,") and "neon city" not in part.lower() and "adapted from" not in part.lower()]
    book = books[0] if books else None
    if book and (re.search(r"#|thanks|providing|adjustments", book, re.I) or len(book) > 80):
        book = None
    return book, origin


def examples(body: str) -> list[str]:
    found: list[str] = []
    for block in re.findall(r"(?:^|\n)\*([^*\n][^*\n]{40,})\*", body):
        text = re.sub(r"\s+", " ", block).strip()
        if text.lower().startswith("the "):
            continue
        found.append(text)
        if len(found) == 3:
            break
    return found


def blurb(body: str) -> str | None:
    chunks = re.split(r"\n\s*\n", body)
    for chunk in chunks:
        line = chunk.strip()
        if not line or line.startswith("#") or line.startswith("![") or line.startswith("#####"):
            continue
        if line.startswith("*") or line.startswith(">"):
            continue
        if line.lower().startswith("source:"):
            continue
        return sentences(re.sub(r"[*_`]", "", line))
    return None


def first_image(body: str) -> tuple[str | None, str | None]:
    match = re.search(r"!\[([^\]]*)\]\((https?://[^)]+)\)", body)
    if not match:
        return None, None
    return match.group(2), match.group(1).strip() or None


def slug_file(slug: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")


def save_image(url: str, slug: str) -> str | None:
    ART.mkdir(parents=True, exist_ok=True)
    dest = ART / f"{slug_file(slug)}.jpg"
    raw = ART / f"{slug_file(slug)}.src"
    try:
        subprocess.run(["curl", "-fsL", url, "-o", str(raw)], check=True, timeout=40)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(raw), "-vf", "scale=480:-2", "-q:v", "5", str(dest)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=40,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None
    finally:
        raw.unlink(missing_ok=True)
    return f"/art/{dest.name}"


def main() -> None:
    classes: dict[str, dict] = {}
    lineages: dict[str, dict] = {}
    credits: list[dict[str, str]] = []
    for path in sorted(WIKI.glob("*.md")):
        meta, body = front(path.read_text(encoding="utf-8", errors="replace"))
        crumbs = meta.get("breadcrumbs", "")
        kind = "class" if "Class" in crumbs else "lineage" if "Lineage" in crumbs else ""
        if not kind:
            continue
        slug = meta.get("slug") or path.stem
        title = meta.get("title") or slug
        source = next((line for line in body.splitlines() if line.startswith("##### Source:")), "")
        book, origin = parse_source(source, title) if source else (None, None)
        image_url, credit = first_image(body)
        image = save_image(image_url, slug) if image_url else None
        if image and credit:
            credits.append({"subject": title, "credit": credit, "page": slug})
        record = {
            "book": book,
            "origin": origin,
            "examples": examples(body) if kind == "class" and ":" not in slug else [],
            "blurb": blurb(body) if kind == "lineage" else None,
            "image": image,
            "credit": credit,
        }
        (classes if kind == "class" else lineages)[slug] = record
    OUT.write_text(json.dumps({"classes": classes, "lineages": lineages, "credits": credits}, indent=2) + "\n", encoding="utf-8")
    print(f"classes {len(classes)} lineages {len(lineages)} images {len(credits)}")


if __name__ == "__main__":
    main()
