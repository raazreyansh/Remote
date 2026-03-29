"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <div className="shell-inner">
        <div className="topbar">
          <div className="brand">
            <div className="eyebrow">Job Agent Dashboard</div>
            <h1 className="title">Operate The Search</h1>
            <p className="subtitle">
              See priority jobs, filter direct ATS targets, and launch safe apply flows from one place.
            </p>
          </div>
          <nav className="nav">
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
