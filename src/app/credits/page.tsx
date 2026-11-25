"use client";

import { useEffect, useState } from "react";

type Credits = {
  carbonPink: { name: string; role: string }[];
  wikiContributors: { name: string; pageCount: number }[];
};

export default function CreditsPage() {
  const [data, setData] = useState<Credits | null>(null);
  useEffect(() => {
    fetch("/data/credits.json").then((res) => res.json()).then(setData);
  }, []);

  return (
    <article className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-cyan">Unofficial companion</p>
        <h1 className="brand text-4xl text-pink">Credits</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Neon City Lights is free fan and community material. This companion was built by Ru1n as a free tool. It is not an official product of the wiki, of Carbon Pink, or of Wizards of the Coast.
        </p>
      </header>
      <section className="neon-card space-y-2 p-4">
        <h2 className="brand text-cyan">Neon City Lights</h2>
        <p>
          Rules, setting, and item text come from the community wiki at{" "}
          <a className="text-cyan underline" href="https://neoncitylights.wikidot.com/">neoncitylights.wikidot.com</a>.
          The wiki describes itself as an extension of Carbon Pink, a cyberpunk presentation of Dungeons & Dragons 5th Edition.
        </p>
      </section>
      <section className="neon-card space-y-2 p-4">
        <h2 className="brand text-cyan">Carbon Pink</h2>
        <p>The wiki page What is Carbon Pink? names these designers. Roles are quoted from that page.</p>
        <ul className="space-y-1 text-sm">
          {(data?.carbonPink ?? []).map((person) => (
            <li key={person.name}><strong>{person.name}.</strong> {person.role}</li>
          ))}
        </ul>
      </section>
      <section className="neon-card space-y-2 p-4">
        <h2 className="brand text-cyan">Wiki contributors</h2>
        <p className="text-sm text-muted">Names are taken from “Writing Credit” and “Thanks to” lines on wiki pages other than NPC entries. No names were added by hand.</p>
        <ul className="columns-1 text-sm sm:columns-2">
          {(data?.wikiContributors ?? []).map((person) => (
            <li key={person.name}>{person.name} <span className="text-muted">· {person.pageCount}</span></li>
          ))}
        </ul>
      </section>
      <section className="neon-card space-y-2 p-4">
        <h2 className="brand text-cyan">D&D 5th Edition</h2>
        <p>
          Where the Neon City wiki is silent, this app uses the Dungeons & Dragons 5th Edition System Reference Document, © Wizards of the Coast, licensed under{" "}
          <a className="text-cyan underline" href="https://creativecommons.org/licenses/by/4.0/">CC-BY-4.0</a>.
          That includes the shape of ability checks, point buy, the standard array, experience thresholds for levels 1–4, and carry capacity (Strength × 15 lb).
        </p>
      </section>
      <section className="neon-card p-4">
        <h2 className="brand text-cyan">This app</h2>
        <p>Built and maintained by Ru1n. Free, static, and stored only in your browser.</p>
      </section>
    </article>
  );
}
