"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="shell">
      <div className="shell-orb shell-orb-a" />
      <div className="shell-orb shell-orb-b" />
      <div className="shell-inner">
        <div className="topbar">
          <div className="brand">
            <div className="eyebrow">Remote Job Agent</div>
            <h1 className="title">{isHome ? "Search Less. Target Better." : "Operate The Search"}</h1>
            <p className="subtitle">
              {isHome
                ? "A calmer command center for ranking jobs, tracking applications, and moving from discovery to action."
                : "See priority jobs, filter direct ATS targets, and launch safe apply flows from one place."}
            </p>
          </div>
          <nav className="nav" aria-label="Primary">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href ? "active" : ""}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        {children}
      </div>
    </div>
  );
}
