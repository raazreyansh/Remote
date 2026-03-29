"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiRequest, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import type { AuthSession } from "@/lib/types";

export default function AdminRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    restaurantName: "Smart Bistro",
    restaurantSlug: "smart-bistro",
    currency: "INR",
    timezone: "Asia/Kolkata",
    countryCode: "IN",
    contactPhone: "+919999999999",
    whatsappNumber: "+919999999999",
    couponCode: "LAUNCH500",
    referralCode: "",
    adminName: "Aarav Kapoor",
    email: "owner@smarttable.ai",
    password: "admin1234",
    planCode: "GROWTH",
  });
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
      const session = await apiRequest<AuthSession>("/api/auth/admin/register", {
        method: "POST",
        body: form,
      });
      saveSession(session);
      router.push("/admin/dashboard");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shell flex min-h-screen items-center py-10">
      <section className="grid w-full gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="panel">
          <span className="badge">Restaurant onboarding</span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Launch SmartTable OS for a new restaurant.</h1>
          <p className="mt-4 text-sm text-ink-soft">
            This onboarding flow provisions a tenant, owner account, subscription trial, dashboard access, and the base
            operating setup for tables, menus, QR codes, payments, and growth tools.
          </p>
          <div className="mt-6 space-y-3 text-sm text-ink-soft">
            <p>Included: digital menu, KDS, loyalty engine, WhatsApp receipt hooks, analytics, and campaign tools.</p>
            <p>Distribution path: PWA install today, Play Store packaging via TWA or Capacitor once domains are final.</p>
          </div>
        </article>

        <form className="panel space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="input" value={form.restaurantName} onChange={(event) => setForm({ ...form, restaurantName: event.target.value })} placeholder="Restaurant name" />
            <input className="input" value={form.restaurantSlug} onChange={(event) => setForm({ ...form, restaurantSlug: event.target.value })} placeholder="Slug" />
            <input className="input" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} placeholder="Currency" />
            <input className="input" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} placeholder="Timezone" />
            <input className="input" value={form.countryCode} onChange={(event) => setForm({ ...form, countryCode: event.target.value })} placeholder="Country code" />
            <input className="input" value={form.planCode} onChange={(event) => setForm({ ...form, planCode: event.target.value })} placeholder="Plan" />
            <input className="input" value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} placeholder="Contact phone" />
            <input className="input" value={form.whatsappNumber} onChange={(event) => setForm({ ...form, whatsappNumber: event.target.value })} placeholder="WhatsApp number" />
            <input className="input" value={form.couponCode} onChange={(event) => setForm({ ...form, couponCode: event.target.value })} placeholder="Coupon code" />
            <input className="input" value={form.referralCode} onChange={(event) => setForm({ ...form, referralCode: event.target.value })} placeholder="Referral code" />
            <input className="input" value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} placeholder="Owner name" />
            <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" />
          </div>
          <input className="input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" />
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? "Provisioning restaurant..." : "Create restaurant workspace"}
          </button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Link className="text-sm text-ink-soft underline" href="/admin/login">
            Already onboarded? Sign in
          </Link>
        </form>
      </section>
    </main>
  );
}
