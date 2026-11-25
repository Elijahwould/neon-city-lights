"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Markdown } from "@/components/markdown";
import { CATEGORY_LABEL, loadEntry } from "@/lib/data";
import type { EntryDoc } from "@/lib/types";

function EntryInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [entry, setEntry] = useState<EntryDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setEntry(null);
    setError(null);
    loadEntry(id).then(setEntry).catch((err: Error) => setError(err.message));
  }, [id]);

  if (!id) return <p className="text-muted">Pick an entry from the compendium.</p>;
  if (error) return <p className="text-pink">{error}</p>;
  if (!entry) return <p className="text-muted">Opening {id}…</p>;

  return (
    <article className="space-y-4">
      <p className="text-xs uppercase tracking-[0.18em] text-cyan">
        <Link href="/compendium/">Compendium</Link> · {CATEGORY_LABEL[entry.category] ?? entry.category}
      </p>
      <h1 className="brand text-4xl text-pink">{entry.title}</h1>
      {entry.partial && (
        <p className="border border-pink/40 bg-pink/10 p-3 text-sm">
          Some numbers on this page stayed in the prose because the parser could not trust them. The text below is the wiki page.
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        {entry.tags?.map((tag) => (
          <span key={tag} className="border border-white/15 px-2 py-1">{tag}</span>
        ))}
      </div>
      <div className="neon-card p-4 sm:p-6">
        <Markdown source={entry.markdown || "_This page has no body._"} />
      </div>
      {entry.links?.length > 0 && (
        <div>
          <h2 className="brand text-cyan">Linked pages</h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {entry.links.slice(0, 24).map((link) => (
              <li key={link}>
                <Link className="text-cyan underline" href={`/entry/?id=${encodeURIComponent(link)}`}>{link}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {entry.url && (
        <p className="text-xs text-muted">
          Wiki source: <a className="text-cyan" href={entry.url}>{entry.url}</a>
        </p>
      )}
    </article>
  );
}

export default function EntryPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading entry…</p>}>
      <EntryInner />
    </Suspense>
  );
}
