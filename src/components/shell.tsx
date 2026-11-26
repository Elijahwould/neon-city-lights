"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/", label: "Night" },
  { href: "/compendium/", label: "Compendium" },
  { href: "/builder/", label: "Builder" },
  { href: "/characters/", label: "Runners" },
  { href: "/credits/", label: "Credits" },
];

function current(path: string, href: string) {
  const normalized = path.endsWith("/") ? path : `${path}/`;
  return normalized === href;
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  return (
    <div className="shell">
      <header className="no-print sticky top-0 z-20 border-b border-pink/30 bg-black/75 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="brand min-w-0 truncate text-lg text-pink">
            Neon City Lights
          </Link>
          <nav className="hidden gap-4 text-sm text-muted md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={current(path, link.href) ? "text-cyan" : "hover:text-ink"}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 md:pb-10">{children}</main>
      <footer className="no-print mx-auto max-w-6xl px-4 pb-28 text-xs text-muted md:pb-8">
        Companion by Ru1n · unofficial fan tool · <Link href="/credits/" className="text-cyan">Credits</Link>
        {" · "}
        <Link href="/privacy/" className="text-cyan">Privacy</Link>
        {" · "}
        <Link href="/terms/" className="text-cyan">Terms</Link>
      </footer>
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 border-t border-cyan/30 bg-black/95 text-center text-[10px] md:hidden">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={`flex items-center justify-center ${current(path, link.href) ? "text-cyan" : "text-muted"}`}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
