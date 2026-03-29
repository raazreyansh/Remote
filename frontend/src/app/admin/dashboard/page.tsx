"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiRequest, ApiError } from "@/lib/api";
import { clearSession, readSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
import { connectRestaurantSocket } from "@/lib/socket";
import type { AuthSession, Order } from "@/lib/types";

type DashboardResponse = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    timezone: string;
    onboardingCompleted: boolean;
    contactPhone: string | null;
    whatsappNumber: string | null;
    referralCode?: string;
  } | null;
  subscription: {
    planCode: string;
    status: string;
  } | null;
  metrics: {
    orderCount: number;
    activeOrders: number;
    paidRevenueCents: number;
    openServiceRequests: number;
  };
  gameChangers: Array<{
    title: string;
    description: string;
  }>;
};

type CategoryAdmin = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  _count: { menuItems: number };
};

type MenuItemAdmin = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  prepTimeMins: number;
  ingredients: string[];
  dietaryTags: string[];
  isAvailable: boolean;
  featuredScore: number;
  category: {
    id: string;
    name: string;
  };
};

type TableAdmin = {
  id: string;
  tableNumber: number;
  label: string | null;
  zone: string | null;
  seats: number;
  qrToken: string;
  _count: { orders: number; serviceRequests: number };
};

type AnalyticsResponse = {
  days: number;
  orderCount: number;
  activeOrders: number;
  completedRevenueCents: number;
  averageOrderValueCents: number;
  repeatCustomers: number;
  openServiceRequests: number;
  upsellSuccessRate: number;
  ordersByStatus: Record<string, number>;
  topItems: Array<{
    name: string;
    quantity: number;
    salesCents: number;
  }>;
  peakHours: Array<{
    hour: string;
    count: number;
  }>;
  revenuePerTable: Array<{
    table: string;
    revenueCents: number;
  }>;
};

type CustomerAdmin = {
  id: string;
  fullName: string | null;
  phone: string | null;
  totalSpentCents: number;
  visitCount: number;
  loyaltyAccount?: {
    pointsBalance: number;
    tierName: string;
  } | null;
};

type PromotionAdmin = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  discountType: string;
  discountValue: number;
  active: boolean;
};

type CampaignAdmin = {
  id: string;
  name: string;
  channel: string;
  status: string;
  messageTemplate: string;
};

type IntegrationStatus = {
  stripe: { configured: boolean; publishableKeyPresent: boolean };
  whatsapp: { configured: boolean };
  storage: { configured: boolean; bucket: string | null };
  upi: { configured: boolean; vpa: string | null };
};

type QrResponse = {
  table: {
    id: string;
    tableNumber: number;
    label: string | null;
  };
  menuUrl: string;
  nfcUrl: string;
  qrCodeDataUrl: string;
  printableText: string;
};

const tabs = ["overview", "menu", "tables", "orders", "customers", "promotions", "analytics"] as const;
type Tab = (typeof tabs)[number];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [categories, setCategories] = useState<CategoryAdmin[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemAdmin[]>([]);
  const [tables, setTables] = useState<TableAdmin[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [customers, setCustomers] = useState<CustomerAdmin[]>([]);
  const [promotions, setPromotions] = useState<PromotionAdmin[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignAdmin[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [qrPreview, setQrPreview] = useState<QrResponse | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemPriceCents, setNewItemPriceCents] = useState(39000);
  const [newItemCategoryId, setNewItemCategoryId] = useState("");
  const [newItemImageUrl, setNewItemImageUrl] = useState("");
  const [newItemImageFile, setNewItemImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newItemTags, setNewItemTags] = useState("vegetarian, shareable");
  const [newTableNumber, setNewTableNumber] = useState(13);
  const [newTableZone, setNewTableZone] = useState("Indoor");
  const [promoName, setPromoName] = useState("Weekend 10%");
  const [promoCode, setPromoCode] = useState("WEEKEND10");
  const [campaignMessage, setCampaignMessage] = useState("Come back this weekend for a curated tasting menu.");

  const authToken = session?.token;
  const currency = dashboard?.restaurant?.currency ?? session?.restaurant.currency ?? "USD";

  const authedRequest = <T,>(path: string, options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {}) => {
    if (!authToken) {
      throw new ApiError("Not authenticated", 401);
    }
    return apiRequest<T>(path, {
      ...options,
      token: authToken,
    });
  };

  const loadAll = async (token: string) => {
    const [dash, fetchedCategories, fetchedItems, fetchedTables, fetchedOrders, fetchedAnalytics, fetchedCustomers, fetchedPromotions, fetchedCampaigns, fetchedIntegrations] =
      await Promise.all([
        apiRequest<DashboardResponse>("/api/admin/dashboard", { token }),
        apiRequest<CategoryAdmin[]>("/api/admin/categories", { token }),
        apiRequest<MenuItemAdmin[]>("/api/admin/menu-items", { token }),
        apiRequest<TableAdmin[]>("/api/admin/tables", { token }),
        apiRequest<Order[]>("/api/admin/orders", { token }),
        apiRequest<AnalyticsResponse>("/api/admin/analytics/summary", { token }),
        apiRequest<CustomerAdmin[]>("/api/admin/customers", { token }),
        apiRequest<PromotionAdmin[]>("/api/admin/promotions", { token }),
        apiRequest<CampaignAdmin[]>("/api/admin/campaigns", { token }),
        apiRequest<IntegrationStatus>("/api/admin/integrations/status", { token }),
      ]);

    setDashboard(dash);
    setCategories(fetchedCategories);
    setMenuItems(fetchedItems);
    setTables(fetchedTables);
    setOrders(fetchedOrders);
    setAnalytics(fetchedAnalytics);
    setCustomers(fetchedCustomers);
    setPromotions(fetchedPromotions);
    setCampaigns(fetchedCampaigns);
    setIntegrations(fetchedIntegrations);
    if (fetchedCategories.length > 0) {
      setNewItemCategoryId((existing) => existing || fetchedCategories[0].id);
    }
  };

  useEffect(() => {
    const saved = readSession();
    if (!saved) {
      router.push("/admin/login");
      return;
    }

    setSession(saved);
    void (async () => {
      try {
        setLoading(true);
        await loadAll(saved.token);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          router.push("/admin/login");
          return;
        }
        setError(caught instanceof Error ? caught.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const socket = connectRestaurantSocket(session.restaurant.id);
    const upsertOrder = (incoming: Order) => {
      setOrders((prev) => {
        const found = prev.find((order) => order.id === incoming.id);
        if (!found) {
          return [incoming, ...prev];
        }
        return prev.map((order) => (order.id === incoming.id ? incoming : order));
      });
    };

    socket.on("order:new", upsertOrder);
    socket.on("order:updated", upsertOrder);

    return () => {
      socket.off("order:new", upsertOrder);
      socket.off("order:updated", upsertOrder);
      socket.disconnect();
    };
  }, [session]);

  const signOut = () => {
    clearSession();
    router.push("/admin/login");
  };

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!newCategoryName.trim()) {
      return;
    }
    await authedRequest("/api/admin/categories", {
      method: "POST",
      body: {
        name: newCategoryName.trim(),
        sortOrder: categories.length + 1,
      },
    });
    setNewCategoryName("");
    setCategories(await authedRequest<CategoryAdmin[]>("/api/admin/categories"));
  };

  const createItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!newItemName.trim() || !newItemCategoryId) {
      return;
    }

    let imageUrl = newItemImageUrl || undefined;
    if (newItemImageFile) {
      setUploadingImage(true);
      try {
        const signed = await authedRequest<{ uploadUrl: string; publicUrl: string }>("/api/admin/uploads/presign", {
          method: "POST",
          body: {
            filename: newItemImageFile.name,
            contentType: newItemImageFile.type || "image/jpeg",
          },
        });

        const uploadResponse = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": newItemImageFile.type || "image/jpeg",
          },
          body: newItemImageFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Image upload failed");
        }

        imageUrl = signed.publicUrl;
      } finally {
        setUploadingImage(false);
      }
    }

    await authedRequest("/api/admin/menu-items", {
      method: "POST",
      body: {
        name: newItemName.trim(),
        categoryId: newItemCategoryId,
        priceCents: newItemPriceCents,
        imageUrl,
        prepTimeMins: 12,
        ingredients: ["chef special"],
        dietaryTags: newItemTags.split(",").map((item) => item.trim()).filter(Boolean),
        featuredScore: 80,
        upsellTargets: [],
      },
    });
    setNewItemName("");
    setNewItemImageUrl("");
    setNewItemImageFile(null);
    setMenuItems(await authedRequest<MenuItemAdmin[]>("/api/admin/menu-items"));
  };

  const createTable = async (event: FormEvent) => {
    event.preventDefault();
    await authedRequest("/api/admin/tables", {
      method: "POST",
      body: {
        tableNumber: newTableNumber,
        zone: newTableZone,
        label: `Table ${newTableNumber}`,
        seats: 4,
      },
    });
    setTables(await authedRequest<TableAdmin[]>("/api/admin/tables"));
    setNewTableNumber((current) => current + 1);
  };

  const createPromotion = async (event: FormEvent) => {
    event.preventDefault();
    await authedRequest("/api/admin/promotions", {
      method: "POST",
      body: {
        name: promoName,
        code: promoCode,
        description: "Automated campaign offer",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    setPromotions(await authedRequest<PromotionAdmin[]>("/api/admin/promotions"));
  };

  const createCampaign = async (event: FormEvent) => {
    event.preventDefault();
    await authedRequest("/api/admin/campaigns", {
      method: "POST",
      body: {
        name: "Win-back flow",
        channel: "WHATSAPP",
        messageTemplate: campaignMessage,
      },
    });
    setCampaigns(await authedRequest<CampaignAdmin[]>("/api/admin/campaigns"));
  };

  const startBillingCheckout = async () => {
    const session = await authedRequest<{ url: string }>("/api/admin/billing/checkout-session", {
      method: "POST",
    });
    window.location.href = session.url;
  };

  const downloadExport = async () => {
    if (!authToken) {
      return;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/admin/analytics/export`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "smarttable-report.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const previewQr = async (tableId: string) => {
    const qr = await authedRequest<QrResponse>(`/api/admin/tables/${tableId}/qr`);
    setQrPreview(qr);
  };

  const updateOrderStatus = async (orderId: string, status: Order["status"]) => {
    await authedRequest(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      body: { status },
    });
    setOrders(await authedRequest<Order[]>("/api/admin/orders"));
    setAnalytics(await authedRequest<AnalyticsResponse>("/api/admin/analytics/summary"));
  };

  const summaryCards = useMemo(() => {
    if (!dashboard || !analytics) {
      return [];
    }
    return [
      { label: "Orders", value: String(dashboard.metrics.orderCount) },
      { label: "Active", value: String(dashboard.metrics.activeOrders) },
      { label: "Revenue", value: formatCurrency(dashboard.metrics.paidRevenueCents, currency) },
      { label: "AOV", value: formatCurrency(analytics.averageOrderValueCents, currency) },
      { label: "Upsell", value: `${analytics.upsellSuccessRate}%` },
      { label: "Repeat guests", value: String(analytics.repeatCustomers) },
    ];
  }, [dashboard, analytics, currency]);

  if (loading) {
    return (
      <main className="shell min-h-screen py-8">
        <div className="panel">Loading dashboard...</div>
      </main>
    );
  }

  if (!session || !dashboard) {
    return null;
  }

  return (
    <main className="shell space-y-4 py-6">
      <section className="panel-strong">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="badge">Restaurant OS</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">{dashboard.restaurant?.name}</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Plan: {dashboard.subscription?.planCode ?? "GROWTH"} • Status: {dashboard.subscription?.status ?? "ACTIVE"} •
              Slug: {dashboard.restaurant?.slug}
            </p>
            <p className="mt-1 text-sm text-ink-soft">Referral code: {dashboard.restaurant?.referralCode ?? "N/A"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => void startBillingCheckout()}>
              Activate SmartTable Pro ₹999/mo
            </button>
            <Link className="btn-secondary" href="/kitchen">
              Kitchen display
            </Link>
            <button className="btn-secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? "btn-primary capitalize" : "btn-secondary capitalize"} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>

      {error ? <div className="panel text-danger">{error}</div> : null}

      {activeTab === "overview" ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {summaryCards.map((card) => (
              <article key={card.label} className="panel">
                <p className="text-sm text-ink-soft">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold">{card.value}</p>
              </article>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="panel">
              <h2 className="text-2xl font-semibold">Realtime orders</h2>
              <div className="mt-4 space-y-3">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="rounded-[24px] border border-line bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          #{order.orderNumber ?? order.id.slice(0, 8)} • {order.table ? `Table ${order.table.tableNumber}` : "Counter"}
                        </p>
                        <p className="text-sm text-ink-soft">
                          {order.status} • {formatCurrency(order.totalCents, currency)}
                        </p>
                      </div>
                      <select className="input max-w-44" value={order.status} onChange={(event) => void updateOrderStatus(order.id, event.target.value as Order["status"])}>
                        {["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel">
              <h2 className="text-2xl font-semibold">Game-changing opportunities</h2>
              <div className="mt-4 space-y-3">
                {dashboard.gameChangers.map((item) => (
                  <div key={item.title} className="rounded-[24px] border border-line bg-white/5 p-4">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-2 text-sm text-ink-soft">{item.description}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
          <article className="panel">
            <h2 className="text-2xl font-semibold">Integration status</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {integrations
                ? [
                    { label: "Stripe", value: integrations.stripe.configured ? "Connected" : "Missing credentials" },
                    { label: "WhatsApp", value: integrations.whatsapp.configured ? "Connected" : "Missing credentials" },
                    { label: "Storage", value: integrations.storage.configured ? integrations.storage.bucket ?? "Connected" : "Missing credentials" },
                    { label: "UPI", value: integrations.upi.configured ? integrations.upi.vpa ?? "Connected" : "Missing VPA" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-line bg-white/5 p-4">
                      <p className="text-sm text-ink-soft">{item.label}</p>
                      <p className="mt-2 font-semibold">{item.value}</p>
                    </div>
                  ))
                : null}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "menu" ? (
        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <form className="panel space-y-3" onSubmit={createCategory}>
              <h2 className="text-xl font-semibold">Add category</h2>
              <input className="input" placeholder="Category name" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} />
              <button className="btn-primary w-full" type="submit">
                Create category
              </button>
            </form>
            <form className="panel space-y-3" onSubmit={createItem}>
              <h2 className="text-xl font-semibold">Add menu item</h2>
              <input className="input" placeholder="Item name" value={newItemName} onChange={(event) => setNewItemName(event.target.value)} />
              <input className="input" placeholder="Image URL" value={newItemImageUrl} onChange={(event) => setNewItemImageUrl(event.target.value)} />
              <input className="input" type="file" accept="image/*" onChange={(event) => setNewItemImageFile(event.target.files?.[0] ?? null)} />
              <input className="input" placeholder="Dietary tags" value={newItemTags} onChange={(event) => setNewItemTags(event.target.value)} />
              <select className="input" value={newItemCategoryId} onChange={(event) => setNewItemCategoryId(event.target.value)}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input className="input" type="number" value={newItemPriceCents} onChange={(event) => setNewItemPriceCents(Number(event.target.value))} />
              <button className="btn-primary w-full" type="submit" disabled={uploadingImage}>
                {uploadingImage ? "Uploading..." : "Create item"}
              </button>
            </form>
          </div>
          <article className="panel">
            <h2 className="text-xl font-semibold">Live menu</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {menuItems.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-line bg-white/5 p-4">
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-ink-soft">{item.category.name}</p>
                  <p className="mt-2 text-sm">{formatCurrency(item.priceCents, currency)}</p>
                  <p className="mt-2 text-xs text-ink-soft">{item.dietaryTags.join(", ")}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "tables" ? (
        <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <form className="panel space-y-3" onSubmit={createTable}>
            <h2 className="text-xl font-semibold">Add table</h2>
            <input className="input" type="number" value={newTableNumber} onChange={(event) => setNewTableNumber(Number(event.target.value))} />
            <input className="input" value={newTableZone} onChange={(event) => setNewTableZone(event.target.value)} placeholder="Zone" />
            <button className="btn-primary w-full" type="submit">
              Generate QR + NFC
            </button>
          </form>
          <article className="panel">
            <h2 className="text-xl font-semibold">Tables</h2>
            <div className="mt-4 space-y-3">
              {tables.map((table) => (
                <div key={table.id} className="rounded-[24px] border border-line bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Table {table.tableNumber}</p>
                      <p className="text-sm text-ink-soft">
                        {table.zone ?? "General"} • {table._count.orders} orders • {table._count.serviceRequests} requests
                      </p>
                    </div>
                    <button className="btn-secondary" onClick={() => void previewQr(table.id)}>
                      View QR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "orders" ? (
        <section className="panel">
          <h2 className="text-xl font-semibold">All orders</h2>
          <div className="mt-4 space-y-3">
            {orders.map((order) => (
              <article key={order.id} className="rounded-[24px] border border-line bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      #{order.orderNumber ?? order.id.slice(0, 8)} • {order.customerName ?? "Guest"} • {order.table ? `Table ${order.table.tableNumber}` : "Counter"}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {formatCurrency(order.totalCents, currency)} • Payment {order.paymentStatus ?? "PENDING"}
                    </p>
                    <p className="mt-2 text-xs text-ink-soft">{order.items.map((item) => `${item.quantity}x ${item.itemName}`).join(" • ")}</p>
                  </div>
                  <select className="input max-w-44" value={order.status} onChange={(event) => void updateOrderStatus(order.id, event.target.value as Order["status"])}>
                    {["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "customers" ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {customers.map((customer) => (
            <article key={customer.id} className="panel">
              <p className="font-semibold">{customer.fullName ?? customer.phone ?? "Guest"}</p>
              <p className="mt-1 text-sm text-ink-soft">{customer.phone ?? "No phone captured"}</p>
              <p className="mt-3 text-sm">Visits: {customer.visitCount}</p>
              <p className="text-sm">Spent: {formatCurrency(customer.totalSpentCents, currency)}</p>
              <p className="text-sm text-ink-soft">
                Loyalty: {customer.loyaltyAccount ? `${customer.loyaltyAccount.pointsBalance} pts • ${customer.loyaltyAccount.tierName}` : "Not enrolled"}
              </p>
            </article>
          ))}
        </section>
      ) : null}

      {activeTab === "promotions" ? (
        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <form className="panel space-y-3" onSubmit={createPromotion}>
              <h2 className="text-xl font-semibold">Create promotion</h2>
              <input className="input" value={promoName} onChange={(event) => setPromoName(event.target.value)} placeholder="Promotion name" />
              <input className="input" value={promoCode} onChange={(event) => setPromoCode(event.target.value)} placeholder="Code" />
              <button className="btn-primary w-full" type="submit">
                Create promo
              </button>
            </form>
            <form className="panel space-y-3" onSubmit={createCampaign}>
              <h2 className="text-xl font-semibold">Launch campaign</h2>
              <textarea className="input min-h-32" value={campaignMessage} onChange={(event) => setCampaignMessage(event.target.value)} />
              <button className="btn-primary w-full" type="submit">
                Save campaign
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <article className="panel">
              <h2 className="text-xl font-semibold">Promotions</h2>
              <div className="mt-4 space-y-3">
                {promotions.map((promotion) => (
                  <div key={promotion.id} className="rounded-[24px] border border-line bg-white/5 p-4">
                    <p className="font-semibold">{promotion.name}</p>
                    <p className="mt-1 text-sm text-ink-soft">{promotion.code ?? "Auto apply"}</p>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel">
              <h2 className="text-xl font-semibold">Campaigns</h2>
              <div className="mt-4 space-y-3">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-[24px] border border-line bg-white/5 p-4">
                    <p className="font-semibold">{campaign.name}</p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {campaign.channel} • {campaign.status}
                    </p>
                    <p className="mt-2 text-sm text-ink-soft">{campaign.messageTemplate}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "analytics" && analytics ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="panel">
            <h2 className="text-xl font-semibold">Peak hours</h2>
            <div className="mt-4 space-y-2">
              {analytics.peakHours.map((hour) => (
                <div key={hour.hour} className="flex items-center justify-between rounded-[20px] border border-line bg-white/5 px-4 py-3">
                  <span>{hour.hour}:00</span>
                  <span>{hour.count} orders</span>
                </div>
              ))}
            </div>
          </article>
          <article className="panel">
            <h2 className="text-xl font-semibold">Revenue per table</h2>
            <div className="mt-4 space-y-2">
              {analytics.revenuePerTable.map((entry) => (
                <div key={entry.table} className="flex items-center justify-between rounded-[20px] border border-line bg-white/5 px-4 py-3">
                  <span>{entry.table}</span>
                  <span>{formatCurrency(entry.revenueCents, currency)}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="panel">
            <h2 className="text-xl font-semibold">Top items</h2>
            <div className="mt-4 space-y-2">
              {analytics.topItems.map((item) => (
                <div key={item.name} className="rounded-[20px] border border-line bg-white/5 px-4 py-3">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-ink-soft">
                    {item.quantity} sold • {formatCurrency(item.salesCents, currency)}
                  </p>
                </div>
              ))}
            </div>
          </article>
          <article className="panel">
            <h2 className="text-xl font-semibold">Status split</h2>
            <div className="mt-4 space-y-2">
              {Object.entries(analytics.ordersByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-[20px] border border-line bg-white/5 px-4 py-3">
                  <span>{status}</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
            <button className="btn-secondary mt-4 inline-flex" onClick={() => void downloadExport()}>
              Export CSV
            </button>
          </article>
        </section>
      ) : null}

      {qrPreview ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4">
          <div className="panel max-w-md bg-canvas">
            <h3 className="text-2xl font-semibold">Table {qrPreview.table.tableNumber} QR</h3>
            <Image alt="QR code" className="mx-auto mt-4 rounded-[24px] border border-line bg-white p-3" height={288} src={qrPreview.qrCodeDataUrl} unoptimized width={288} />
            <p className="mt-4 text-sm text-ink-soft">{qrPreview.printableText}</p>
            <a className="mt-3 block break-all text-sm text-accent underline" href={qrPreview.menuUrl} target="_blank" rel="noreferrer">
              {qrPreview.menuUrl}
            </a>
            <button className="btn-primary mt-4 w-full" onClick={() => setQrPreview(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
