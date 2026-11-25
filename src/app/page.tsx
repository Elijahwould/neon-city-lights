import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="neon-card px-5 py-8 sm:px-8">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan">Runner&apos;s companion · Carbon Pink rules, Neon City setting</p>
        <h1 className="brand mt-3 text-4xl text-pink sm:text-6xl">The city is open. Your sheet should be too.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          A phone-first handbook for the Neon City Lights table. Browse every lineage, class, tech, and piece of gear from the wiki,
          then build a runner and keep the sheet in your browser. No account. No server. Nothing to pay for.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/builder/?new=1" className="rounded-sm bg-pink px-4 py-2 font-semibold text-black">Build a runner</Link>
          <Link href="/compendium/" className="rounded-sm border border-cyan/60 px-4 py-2 text-cyan">Open the compendium</Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Compendium", "Search classes, techs, weapons, cybernetics, foes, rules, and the city itself. Every wiki page is still there when a number could not be lifted out of the prose.", "/compendium/"],
          ["Builder", "Lineage, upbringing, class, scores, skills, techs, and gear. Level a character from 1 through the class table, including the server's level-5 start.", "/builder/?new=1"],
          ["Sheet", "Modifiers, saves, AC, attacks, tech slots, and inventory. Print to PDF, or export the runner as a JSON file you can pass around the Discord.", "/characters/"],
        ].map(([title, copy, href]) => (
          <Link key={title} href={href} className="neon-card block p-4 hover:border-cyan">
            <h2 className="brand text-xl text-cyan">{title}</h2>
            <p className="mt-2 text-sm text-muted">{copy}</p>
          </Link>
        ))}
      </section>
      <section className="text-sm text-muted">
        <p>
          Server characters usually begin at level 5 with $40,000. The builder can do that, or start at level 1 and level up on the sheet.
          Milestone points and street ranks follow the wiki chart, which begins at Runt (level 5).
        </p>
      </section>
    </div>
  );
}
