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

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="shell">
      <header className="no-print sticky top-0 z-20 border-b border-pink/30 bg-black/75 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="brand text-lg text-pink">
            Neon City Lights
          </Link>
          <nav className="hidden gap-4 text-sm text-muted md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={path === link.href ? "text-cyan" : "hover:text-ink"}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24">{children}</main>
      <footer className="no-print mx-auto max-w-6xl px-4 pb-24 text-xs text-muted md:pb-8">
        Companion by Ru1n · unofficial fan tool · <Link href="/credits/" className="text-cyan">Credits</Link>
      </footer>
      <nav className="no-print fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-cyan/30 bg-black/90 text-center text-[10px] md:hidden">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={`py-3 ${path === link.href ? "text-cyan" : "text-muted"}`}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
