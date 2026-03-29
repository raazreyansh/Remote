"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const pillars = [
  "Customer digital menu with AI upsells, split bill, and table service actions",
  "Restaurant admin suite for menus, tables, promotions, onboarding, and growth",
  "Live kitchen display, analytics engine, loyalty, and WhatsApp receipt workflows",
];

const opportunities = [
  {
    title: "Guest identity graph",
    description: "Build repeat-visit intelligence from QR sessions, loyalty, and campaign redemptions.",
  },
  {
    title: "Intent-based menu AI",
    description: "Turn voice questions and order patterns into real-time dynamic bundles that raise ticket size.",
  },
  {
    title: "Operational autopilot",
    description: "Predict kitchen delays and trigger table apologies, freebies, and staff escalation automatically.",
  },
];

export default function Home() {
  return (
    <main className="shell space-y-8 py-8 sm:py-10">
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="panel-strong overflow-hidden"
        initial={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.45 }}
      >
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <span className="badge">SmartTable OS</span>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Production SaaS for QR menus, live orders, kitchen ops, analytics, and restaurant growth.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-ink-soft sm:text-lg">
              Built for multi-restaurant scale. Guests scan a QR code, order from their phone, pay at table or counter,
              receive live tracking, and get receipts on WhatsApp. Restaurants manage menus, tables, campaigns, and AI
              revenue flows from one operating system.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" href="/admin/register">
                Launch restaurant
              </Link>
              <Link className="btn-secondary" href="/admin/login">
                Admin login
              </Link>
              <Link className="btn-secondary" href="/r/smart-bistro/menu?tableToken=smart-bistro-table-1">
                Open live menu
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            {pillars.map((pillar) => (
              <article key={pillar} className="rounded-[24px] border border-line bg-black/15 p-4">
                <p className="text-sm text-ink-soft">{pillar}</p>
              </article>
            ))}
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 lg:grid-cols-3">
        <motion.div whileHover={{ y: -6 }}>
        <Link className="panel block transition" href="/r/smart-bistro/menu?tableToken=smart-bistro-table-1">
          <span className="badge">Customer app</span>
          <h2 className="mt-4 text-2xl font-semibold">Menu, cart, payment, tracking</h2>
          <p className="mt-2 text-sm text-ink-soft">Customer flow with images, AI recommendations, service requests, and digital receipts.</p>
        </Link>
        </motion.div>
        <motion.div whileHover={{ y: -6 }}>
        <Link className="panel block transition" href="/admin/dashboard">
          <span className="badge">Admin suite</span>
          <h2 className="mt-4 text-2xl font-semibold">Manage menus, tables, loyalty, analytics</h2>
          <p className="mt-2 text-sm text-ink-soft">Multi-tenant dashboard for onboarding, QR generation, promotions, and SaaS operations.</p>
        </Link>
        </motion.div>
        <motion.div whileHover={{ y: -6 }}>
        <Link className="panel block transition" href="/kitchen">
          <span className="badge">Kitchen display</span>
          <h2 className="mt-4 text-2xl font-semibold">Realtime prep board</h2>
          <p className="mt-2 text-sm text-ink-soft">Instant order sync, item state changes, and customer-facing readiness updates.</p>
        </Link>
        </motion.div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="panel">
          <span className="badge">Play Store path</span>
          <h2 className="mt-4 section-title">Restaurant app distribution</h2>
          <p className="mt-3 text-sm text-ink-soft">
            The frontend is structured as an installable PWA and can be wrapped for Play Store delivery using Trusted Web
            Activity or Capacitor. Restaurants can self-register, manage menus, take orders, and operate the KDS from the
            same codebase.
          </p>
        </article>

        <article className="panel">
          <span className="badge">Demo access</span>
          <h2 className="mt-4 section-title">Seeded restaurant</h2>
          <p className="mt-3 text-sm text-ink-soft">Slug: `smart-bistro`</p>
          <p className="text-sm text-ink-soft">Email: `owner@smarttable.ai`</p>
          <p className="text-sm text-ink-soft">Password: `admin1234`</p>
        </article>
      </section>

      <section className="panel">
        <span className="badge">Game changers</span>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {opportunities.map((item) => (
            <article key={item.title} className="rounded-[24px] border border-line bg-white/5 p-4">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
