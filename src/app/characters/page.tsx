"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type { Character } from "@/lib/types";
import { deleteCharacter, loadCharacters, readCharacterFile, upsertCharacter } from "@/lib/storage";

export default function CharactersPage() {
  const [list, setList] = useState<Character[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setList(loadCharacters()), []);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="brand text-3xl text-pink">Runners</h1>
          <p className="text-sm text-muted">Saved in this browser only. Export a JSON file if you want a backup or another phone.</p>
        </div>
        <Link href="/builder/?new=1" className="rounded-sm bg-pink px-3 py-2 text-sm font-semibold text-black">New</Link>
      </div>
      <label className="block text-sm text-cyan">
        Import JSON
        <input
          className="mt-1 block text-ink"
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            readCharacterFile(file).then((character) => {
              setList(upsertCharacter({ ...character, id: character.id || `import-${Date.now()}` }));
              setError(null);
            }).catch((err: Error) => setError(err.message));
          }}
        />
      </label>
      {error && <p className="text-pink">{error}</p>}
      {list.length === 0 && <p className="neon-card p-4 text-muted">No runners yet. The city is still hiring.</p>}
      <ul className="space-y-2">
        {list.map((character) => (
          <li key={character.id} className="neon-card flex items-center justify-between gap-3 p-3">
            <div>
              <Link href={`/sheet/?id=${character.id}`} className="text-lg text-cyan">{character.name || "Unnamed runner"}</Link>
              <p className="text-xs text-muted">Level {character.level} · updated {new Date(character.updatedAt).toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/builder/?id=${character.id}`} className="rounded-sm border border-cyan/50 px-3 py-2 text-sm text-cyan">Edit</Link>
              <Button variant="danger" onClick={() => setList(deleteCharacter(character.id))}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
