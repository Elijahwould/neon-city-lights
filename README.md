# Neon City Lights

A free, phone-first companion for [Neon City Lights](https://neoncitylights.wikidot.com/) (Carbon Pink's cyberpunk D&D 5e hack), built by Ru1n. It is an unofficial static site: compendium, character builder, and printable sheet, saved in the browser. No accounts and no paid services.

## Run it locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43123

`npm run build` writes a static site to `out/`. You can open that folder with any static host.

## Rebuild the game data

The wiki mirror lives in `wiki/`, one Markdown file per page (`tech:meet-cute.md`). The app reads JSON generated from those files.

Refresh from the live wiki, then parse:

```bash
python3 scripts/crawl_wiki.py
python3 scripts/parse_wiki.py
```

`npm run crawl` and `npm run parse` do the same things. Parsing writes:

- `public/data/catalog.json` — searchable index
- `public/data/rules.json` — classes, techs, gear, and the numbers the builder uses
- `public/data/entries/` — full Markdown for every published page
- `public/data/parse-report.json` — fields that stayed as prose
- `wiki/INDEX.md` — category counts

If you have a markdown tarball instead of a network connection:

```bash
python3 scripts/import_mirror.py path/to/ncl-wiki.tar.gz
python3 scripts/parse_wiki.py
```

The crawl needs Python 3 and `beautifulsoup4` (`pip install beautifulsoup4 lxml`).

Placeholder foe pages are kept in the mirror and left out of the compendium: `foes:ai`, `foeinfo-ai`, `foe:020-amirani`, `foe:050-hermesian`, `foes:netsucker`, and `foeinfo-humanoid`. The setting article `netsuckers` stays.

## Deploy on Vercel

The site is a static export. `output: "export"` and `trailingSlash: true` are set in `next.config.ts`. `vercel.json` only contains `{ "trailingSlash": true }` and the build copies it into `out/`.

```bash
npm ci
npm run build
```

Deploy the `out/` folder (the zip root is the site, not a nested `out/` directory). On Vercel, the build command is `npm run build` and the output directory is `out`. No server, database, or environment variables are required. Do not commit a `.env` file.

Characters stay in the browser. From the sheet you can export JSON, copy a text summary, or download an Avrae GSheet v2.1 workbook (`.xlsx`, with a CSV fallback) and import that file into Google Sheets.

## Credits

Rules and item text come from the [Neon City Lights wiki](https://neoncitylights.wikidot.com/). This companion is unofficial fan work by Ru1n. It is not a product of the wiki, Carbon Pink, or Wizards of the Coast. The in-app Credits page names the wiki contributors and the D&D 5e SRD (CC-BY-4.0).

## What the builder follows

Creation is one step at a time: basics, class, lineage, ability scores, upbringing, equipment, tricks or techs when the class has them, then review. Earlier choices stay put when you go back. Class hit dice, proficiency, features, tech slots, and prepared-tech formulas come from the class pages. Upbringings grant the skills and tools written on their pages. Lineage ability increases follow the wiki patterns, including Splicer’s extra +2, and class improvements are +2 or two +1s, capped at 20 before cybernetics. Cybernetic slots equal proficiency bonus. BioMod and NeuroMod apply only after you pick an ability, and their caps follow the cybernetics page (20 / 22 / 24). Defense is +1 AC in armor and +2 in heavy armor. Milestone ranks follow the leveling chart, which starts at level 5.

Where the wiki is quiet, the sheet uses the usual 5e reading and says so in the app: standard array, 27-point buy, and a minimum of 1 hit point gained on a level. The Discord's `.threshold` rolls are entered as manual scores.
