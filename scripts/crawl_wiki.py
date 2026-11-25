#!/usr/bin/env python3
"""Download the Neon City Lights wiki into a Markdown mirror.

Each public page becomes ``wiki/<slug>.md`` with YAML front matter.
Re-run to refresh. ``--only slug`` refreshes one page.

Wikidot system/css/forum pages are skipped. Game pages, including
placeholder foe writeups, are kept so the parser can decide what to publish.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / "wiki"
SITEMAP = "https://neoncitylights.wikidot.com/sitemap.xml"
UA = "Mozilla/5.0 (compatible; NCLCompanion/1.0; +https://neoncitylights.wikidot.com/)"
SKIP_PREFIXES = ("system:", "css:", "admincss:", "forum:", "nav:", "admin:")


def fetch(url: str, timeout: int = 40) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    last: Exception | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"failed {url}: {last}")


def sitemap_slugs() -> list[str]:
    xml = fetch(SITEMAP).decode("utf-8", "replace")
    locs = re.findall(r"<loc>(.*?)</loc>", xml)
    seen: set[str] = set()
    out: list[str] = []
    for loc in locs:
        slug = loc.rstrip("/").split("/")[-1]
        if not slug or slug.endswith("wikidot.com"):
            slug = "home"
        if slug not in seen:
            seen.add(slug)
            out.append(slug)
    return out


def yaml_quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ") + '"'


def inline(node) -> str:
    if isinstance(node, NavigableString):
        return str(node).replace("\xa0", " ")
    if not isinstance(node, Tag):
        return ""
    name = node.name
    if name in ("script", "style"):
        return ""
    if name in ("strong", "b"):
        inner = "".join(inline(c) for c in node.children).strip()
        return f"**{inner}**" if inner else ""
    if name in ("em", "i"):
        inner = "".join(inline(c) for c in node.children).strip()
        return f"*{inner}*" if inner else ""
    if name == "br":
        return "\n"
    if name == "a":
        href = node.get("href") or ""
        label = re.sub(r"\s+", " ", "".join(inline(c) for c in node.children)).strip() or href
        if href.startswith("javascript:"):
            return ""
        if href.startswith("/"):
            href = href.split("#")[0]
        return f"[{label}]({href})"
    if name == "img":
        src = node.get("src") or ""
        alt = node.get("alt") or ""
        return f"![{alt}]({src})" if src else ""
    if name == "code":
        return f"`{node.get_text()}`"
    return "".join(inline(c) for c in node.children)


def table_to_md(table: Tag) -> str:
    raw_rows: list[list[str]] = []
    header_idx = 0
    for i, tr in enumerate(table.find_all("tr")):
        cells = tr.find_all(["th", "td"], recursive=False)
        if not cells:
            continue
        rendered = []
        for cell in cells:
            text = inline(cell)
            text = re.sub(r"\s+", " ", text).strip().replace("|", "\\|")
            rendered.append(text)
        if cells and all(c.name == "th" for c in cells):
            header_idx = len(raw_rows)
            if any(c.lower() == "level" for c in rendered):
                raw_rows.append(rendered)
                # keep scanning only if this isn't the real header; break when Level is found
                break
        raw_rows.append(rendered)
    # The loop may have broken after appending the Level header, so collect the rest.
    # Simpler path: re-walk fully.
    raw_rows = []
    header_idx = 0
    found_level = False
    for tr in table.find_all("tr"):
        cells = tr.find_all(["th", "td"], recursive=False)
        if not cells:
            continue
        rendered = []
        for cell in cells:
            text = re.sub(r"\s+", " ", inline(cell)).strip().replace("|", "\\|")
            rendered.append(text)
        if (not found_level) and cells and all(c.name == "th" for c in cells):
            header_idx = len(raw_rows)
            if any(c.lower() == "level" for c in rendered):
                found_level = True
        raw_rows.append(rendered)
    if not raw_rows:
        return ""
    width = max(len(r) for r in raw_rows)
    norm = [r + [""] * (width - len(r)) for r in raw_rows]
    header = norm[header_idx]
    caption = []
    for row in norm[:header_idx]:
        bits = [c for c in row if c]
        if bits:
            caption.append(" — ".join(bits))
    lines: list[str] = []
    if caption:
        lines.append("*" + " · ".join(caption) + "*")
        lines.append("")
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| " + " | ".join("---" for _ in header) + " |")
    for row in norm[header_idx + 1 :]:
        if row == header:
            continue
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def blocks(node: Tag, out: list[str]) -> None:
    for child in list(node.children):
        if isinstance(child, NavigableString):
            text = str(child).replace("\xa0", " ").strip()
            if text:
                out.append(text)
            continue
        if not isinstance(child, Tag):
            continue
        name = child.name
        classes = child.get("class") or []
        if name in ("script", "style") or child.get("id") == "toc":
            continue
        if "collapsible-block" in classes:
            content = child.select_one(".collapsible-block-content")
            if content:
                blocks(content, out)
            continue
        if "collapsible-block-folded" in classes or "collapsible-block-unfolded-link" in classes:
            continue
        if name in ("div", "span", "section", "article"):
            blocks(child, out)
            continue
        if name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            text = re.sub(r"\s+", " ", inline(child)).strip()
            if text:
                out.append("\n" + ("#" * int(name[1])) + " " + text + "\n")
            continue
        if name == "p":
            text = inline(child).strip()
            text = re.sub(r"\n{3,}", "\n\n", text)
            if text:
                out.append(text + "\n")
            continue
        if name in ("ul", "ol"):
            for i, li in enumerate(child.find_all("li", recursive=False), start=1):
                prefix = f"{i}." if name == "ol" else "-"
                parts: list[str] = []
                nested: list[str] = []
                for c in li.children:
                    if isinstance(c, Tag) and c.name in ("ul", "ol"):
                        for j, sub in enumerate(c.find_all("li", recursive=False), start=1):
                            sp = f"{j}." if c.name == "ol" else "-"
                            st = re.sub(r"\s+", " ", inline(sub)).strip()
                            if st:
                                nested.append(f"  {sp} {st}")
                    else:
                        parts.append(inline(c) if isinstance(c, Tag) else str(c))
                item = re.sub(r"\s+", " ", "".join(parts)).strip()
                chunk = []
                if item:
                    chunk.append(f"{prefix} {item}")
                chunk.extend(nested)
                if chunk:
                    out.append("\n".join(chunk))
            out.append("")
            continue
        if name == "table":
            md = table_to_md(child)
            if md:
                out.append(md + "\n")
            continue
        if name == "blockquote":
            text = inline(child).strip()
            if text:
                out.append("\n".join("> " + line for line in text.splitlines()) + "\n")
            continue
        if name == "hr":
            out.append("\n---\n")
            continue
        if name == "pre":
            out.append("```\n" + child.get_text() + "\n```\n")
            continue
        text = inline(child).strip()
        if text:
            out.append(text + "\n")


def html_to_markdown(page_content: Tag) -> str:
    toc = page_content.select_one("#toc")
    if toc:
        toc.decompose()
    out: list[str] = []
    blocks(page_content, out)
    md = "\n".join(out).replace("\xa0", " ")
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip() + "\n"


def page_to_markdown(slug: str) -> str:
    url = "https://neoncitylights.wikidot.com/" if slug == "home" else f"https://neoncitylights.wikidot.com/{slug}"
    soup = BeautifulSoup(fetch(url), "lxml")
    title_el = soup.select_one("#page-title")
    title = title_el.get_text(" ", strip=True) if title_el else slug
    crumbs_el = soup.select_one("#breadcrumbs")
    crumbs = [a.get_text(" ", strip=True) for a in crumbs_el.find_all("a")] if crumbs_el else []
    if title and title not in crumbs:
        crumbs.append(title)
    tags = [a.get_text(strip=True) for a in soup.select(".page-tags a")]
    pc = soup.select_one("#page-content")
    body = html_to_markdown(pc) if pc else ""
    fm = [
        "---",
        f"title: {yaml_quote(title)}",
        f"slug: {yaml_quote(slug)}",
        f"url: {yaml_quote(url)}",
        "breadcrumbs: [" + ", ".join(yaml_quote(c) for c in crumbs) + "]",
        "tags: [" + ", ".join(yaml_quote(t) for t in tags) + "]",
        "---",
        "",
    ]
    return "\n".join(fm) + body


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", action="append", default=[])
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    WIKI.mkdir(parents=True, exist_ok=True)
    if args.only:
        slugs = args.only
    else:
        print("fetching sitemap...", flush=True)
        slugs = [s for s in sitemap_slugs() if not s.startswith(SKIP_PREFIXES)]
        if args.limit:
            slugs = slugs[: args.limit]
        (WIKI / "_slugs.json").write_text(json.dumps(slugs, indent=2))
    print(f"crawling {len(slugs)} pages", flush=True)
    ok = 0
    failed: list[dict] = []

    def work(slug: str) -> tuple[str, str | None]:
        try:
            md = page_to_markdown(slug)
            (WIKI / f"{slug.replace('/', '__')}.md").write_text(md, encoding="utf-8")
            return slug, None
        except Exception as exc:  # noqa: BLE001
            return slug, str(exc)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(work, s) for s in slugs]
        for i, fut in enumerate(as_completed(futures), start=1):
            slug, err = fut.result()
            if err:
                failed.append({"slug": slug, "error": err})
                print(f"FAIL {slug}: {err}", flush=True)
            else:
                ok += 1
            if i % 100 == 0 or i == len(slugs):
                print(f"  {i}/{len(slugs)} ok={ok} fail={len(failed)}", flush=True)
    (WIKI / "_crawl_report.json").write_text(json.dumps({"ok": ok, "failed": failed}, indent=2))
    print(json.dumps({"ok": ok, "failed": len(failed)}))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
