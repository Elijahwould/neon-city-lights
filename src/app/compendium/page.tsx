"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Chip, TextInput } from "@/components/ui";
import { CATEGORY_LABEL, GROUPS, loadCatalog } from "@/lib/data";
import type { CatalogEntry } from "@/lib/types";
import { creditsLabel } from "@/lib/character";

const SECTORS = ["altercation", "biochemistry", "conception", "deception", "manifestation", "manipulation", "observation", "protection"];
const CLASSES = ["auditor", "brawler", "enforcer", "influencer", "mechanist", "ordinator", "outlaw", "pretender", "renegade", "ronin", "shutin", "sourcecoder", "streamer", "streetfighter", "techwizard"];

export default function CompendiumPage() {
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [sector, setSector] = useState("");
  const [level, setLevel] = useState("");
  const [klass, setKlass] = useState("");
  const [rarity, setRarity] = useState("");
  const [shown, setShown] = useState(48);
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    loadCatalog().then(setEntries).catch((err: Error) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const query = q.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entry.hub) return false;
      if (cat !== "all" && entry.category !== cat) return false;
      if (sector && entry.sector !== sector) return false;
      if (level !== "" && String(entry.level ?? "") !== level) return false;
      if (klass && !(entry.classes ?? []).includes(klass)) return false;
      if (rarity && entry.rarity !== rarity) return false;
      if (!query) return true;
      const hay = `${entry.title} ${entry.summary} ${(entry.tags ?? []).join(" ")} ${entry.damage ?? ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [entries, q, cat, sector, level, klass, rarity]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    (entries ?? []).forEach((entry) => {
      if (!entry.hub) map[entry.category] = (map[entry.category] ?? 0) + 1;
    });
    return map;
  }, [entries]);

  if (error) return <p className="text-pink">{error}</p>;
  if (!entries) return <p className="text-muted">Loading the city index…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="brand text-3xl text-pink">Compendium</h1>
        <p className="text-sm text-muted">{entries.filter((e) => !e.hub).length} entries from the wiki. Placeholder AI, Amirani, Hermesian, Netsucker, and Humanoid foe pages are left out.</p>
      </div>
      <TextInput value={q} onChange={(e) => { setQ(e.target.value); setShown(48); setFiltersOpen(false); }} placeholder="Search names, tags, damage…" />
      <button type="button" className="text-sm text-cyan" onClick={() => setFiltersOpen((open) => !open)}>
        {filtersOpen ? "Hide filters" : "Show filters"}
      </button>
      {filtersOpen && <div className="space-y-2">
        {GROUPS.map((group) => (
          <div key={group.id} className="flex flex-wrap gap-2">
            {group.cats.map((id) => (
              <Chip key={id} active={cat === id} onClick={() => { setCat(cat === id ? "all" : id); setShown(48); }}>
                {CATEGORY_LABEL[id] ?? id} {counts[id] ? `· ${counts[id]}` : ""}
              </Chip>
            ))}
          </div>
        ))}
      </div>}
      {filtersOpen && (cat === "tech" || cat === "all") && (
        <div className="flex flex-wrap gap-2">
          <Chip active={level === "0"} onClick={() => setLevel(level === "0" ? "" : "0")}>Tricks</Chip>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <Chip key={n} active={level === String(n)} onClick={() => setLevel(level === String(n) ? "" : String(n))}>{n}</Chip>
          ))}
          {SECTORS.map((name) => (
            <Chip key={name} active={sector === name} onClick={() => setSector(sector === name ? "" : name)}>{name}</Chip>
          ))}
          {CLASSES.map((name) => (
            <Chip key={name} active={klass === name} onClick={() => setKlass(klass === name ? "" : name)}>{name}</Chip>
          ))}
        </div>
      )}
      {filtersOpen && ["highend-weapon", "highend-armor", "gizmo", "peripheral", "consumable", "keyring", "burner"].includes(cat) && (
        <div className="flex flex-wrap gap-2">
          {["common", "uncommon", "rare", "very rare", "legendary", "artifact"].map((name) => (
            <Chip key={name} active={rarity === name} onClick={() => setRarity(rarity === name ? "" : name)}>{name}</Chip>
          ))}
        </div>
      )}
      <p className="text-xs uppercase tracking-widest text-muted">{filtered.length} shown</p>
      {filtered.length === 0 && <p className="neon-card p-4 text-muted">Nothing matches. Clear a filter or try another name.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {filtered.slice(0, shown).map((entry) => (
          <li key={entry.id}>
            <Link href={`/entry/?id=${encodeURIComponent(entry.id)}`} className="neon-card block h-full p-3 hover:border-cyan">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{entry.title}</h2>
                <span className="text-[10px] uppercase tracking-widest text-cyan">{CATEGORY_LABEL[entry.category] ?? entry.category}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-sm text-muted">{entry.summary}</p>
              <p className="mt-2 text-xs text-pink">
                {[
                  entry.level === 0 || entry.trick ? "trick" : entry.level ? `level ${entry.level}` : "",
                  entry.sector,
                  entry.gearCategory,
                  entry.tier,
                  entry.rarity,
                  entry.damage,
                  entry.cr ? `CR ${entry.cr}` : "",
                  entry.cost != null ? creditsLabel(entry.cost) : "",
                ].filter(Boolean).join(" · ")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {shown < filtered.length && (
        <button className="text-cyan" onClick={() => setShown((n) => n + 48)}>Show more</button>
      )}
    </div>
  );
}
