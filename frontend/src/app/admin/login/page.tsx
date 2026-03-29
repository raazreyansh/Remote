"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiRequest, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import type { AuthSession } from "@/lib/types";

export default function AdminLoginPage() {
  const router = useRouter();
  const [restaurantSlug, setRestaurantSlug] = useState("smart-bistro");
  const [email, setEmail] = useState("owner@smarttable.ai");
  const [password, setPassword] = useState("admin1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const session = await apiRequest<AuthSession>("/api/auth/admin/login", {
        method: "POST",
        body: {
          restaurantSlug,
          email,
          password,
        },
      });
      saveSession(session);
      router.push("/admin/dashboard");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shell flex min-h-screen items-center py-10">
      <section className="grid w-full gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="panel">
          <span className="badge">SmartTable OS</span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Restaurant command center</h1>
          <p className="mt-4 text-sm text-ink-soft">
            Sign in to manage menus, tables, live orders, kitchen operations, loyalty, marketing campaigns, payments,
            and analytics across your restaurant locations.
          </p>
          <div className="mt-6 rounded-[24px] border border-line bg-black/10 p-4 text-sm text-ink-soft">
            <p>Seeded demo:</p>
            <p>`smart-bistro`</p>
            <p>`owner@smarttable.ai`</p>
            <p>`admin1234`</p>
          </div>
        </article>

        <form className="panel space-y-4" onSubmit={handleSubmit}>
          <input className="input" value={restaurantSlug} onChange={(event) => setRestaurantSlug(event.target.value)} placeholder="Restaurant slug" />
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Link className="text-sm text-ink-soft underline" href="/admin/register">
            Register a restaurant
          </Link>
        </form>
      </section>
    </main>
  );
}
