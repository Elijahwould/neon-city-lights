#!/usr/bin/env python3
"""Unpack a local Neon City Lights markdown tarball into ``wiki/``.

Accepts either the flat mirror (``tech:meet-cute.md``) or a directory inside
the archive. Existing files are overwritten. Use this when you have
``uploads/ncl-wiki.tar.gz`` instead of re-crawling the live site.

    python3 scripts/import_mirror.py path/to/ncl-wiki.tar.gz
"""

from __future__ import annotations

import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / "wiki"


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: import_mirror.py <archive.tar.gz>", file=sys.stderr)
        return 2
    archive = Path(sys.argv[1])
    if not archive.exists():
        print(f"not found: {archive}", file=sys.stderr)
        return 1
    WIKI.mkdir(parents=True, exist_ok=True)
    count = 0
    with tarfile.open(archive, "r:*") as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            name = Path(member.name).name
            if not name.endswith(".md") and name not in {"INDEX.md"}:
                continue
            if name.startswith("."):
                continue
            src = tar.extractfile(member)
            if src is None:
                continue
            (WIKI / name).write_bytes(src.read())
            count += 1
    print(f"unpacked {count} markdown files into {WIKI}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
