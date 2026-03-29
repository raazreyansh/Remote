"use client";

import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { apiRequest, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import type { MenuCategory, MenuItem } from "@/lib/types";

type MenuResponse = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    primaryColor: string;
    logoUrl: string | null;
    heroImageUrl: string | null;
    whatsappNumber: string | null;
  };
  table: {
    id: string;
    tableNumber: number;
    label: string | null;
    zone: string | null;
    seats: number;
  } | null;
  categories: MenuCategory[];
  promotions: Array<{
    id: string;
    name: string;
    code: string | null;
    description: string | null;
  }>;
  trending: MenuItem[];
  recommendations: {
    reason: string;
    items: MenuItem[];
  };
  experience: {
    supportsSplitBill: boolean;
    supportsVoiceAssistant: boolean;
    supportsArPreview: boolean;
    supportsSocialSharing: boolean;
    supportsTablePayment: boolean;
    supportsCounterPayment: boolean;
  };
};

type CartItem = {
  menuItemId: string;
  name: string;
  quantity: number;
  itemPriceCents: number;
  specialNotes: string;
  customizations?: Record<string, unknown>;
};

type ServiceRequestType = "CALL_WAITER" | "WATER" | "BILL" | "CLEAN_TABLE" | "HELP";

const commonQuestions = [
  "Is this item spicy?",
  "Which dishes are vegetarian?",
  "What pairs best with my main course?",
];

export default function CustomerMenuPage() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const slug = params.slug;
  const tableToken = search.get("tableToken") ?? undefined;

  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [paymentOption, setPaymentOption] = useState<"PAY_AT_TABLE" | "PAY_AT_COUNTER" | "PAY_NOW">("PAY_AT_TABLE");
  const [submitting, setSubmitting] = useState(false);
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState(commonQuestions[2]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const query = tableToken ? `?tableToken=${encodeURIComponent(tableToken)}` : "";
        const data = await apiRequest<MenuResponse>(`/api/public/restaurants/${slug}/menu${query}`);
        setMenu(data);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "Failed to load menu");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [slug, tableToken]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((entry) => entry.menuItemId === item.id);
      if (existing) {
        return prev.map((entry) =>
          entry.menuItemId === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          itemPriceCents: item.priceCents,
          quantity: 1,
          specialNotes: "",
        },
      ];
    });
  };

  const setQuantity = (menuItemId: string, quantity: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.menuItemId === menuItemId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const setItemNote = (menuItemId: string, note: string) => {
    setCart((prev) => prev.map((item) => (item.menuItemId === menuItemId ? { ...item, specialNotes: note } : item)));
  };

  const totalCents = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.itemPriceCents, 0), [cart]);
  const aiAnswer = useMemo(() => {
    if (!menu) {
      return "";
    }
    if (aiPrompt.toLowerCase().includes("vegetarian")) {
      const items = menu.categories.flatMap((category) => category.menuItems).filter((item) => item.dietaryTags.includes("vegetarian"));
      return `Vegetarian picks: ${items.slice(0, 3).map((item) => item.name).join(", ")}.`;
    }
    if (aiPrompt.toLowerCase().includes("spicy")) {
      return "Spice guidance is shown per item. Most signatures are medium; drinks and desserts balance heat well.";
    }
    const suggestions = menu.recommendations.items.map((item) => item.name).join(", ");
    return `Best pairings right now: ${suggestions || "Citrus Cola and Saffron Tres Leches"}.`;
  }, [aiPrompt, menu]);

  const submitOrder = async () => {
    if (!menu || cart.length === 0 || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      const created = await apiRequest<{ id: string }>(`/api/public/restaurants/${slug}/orders`, {
        method: "POST",
        body: {
          tableToken,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          preferredLanguage: "en",
          specialNotes: specialNotes || undefined,
          promotionCode: promotionCode || undefined,
          paymentOption,
          items: cart.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            specialNotes: item.specialNotes || undefined,
            customizations: item.customizations,
          })),
        },
      });

      router.push(`/r/${slug}/order/${created.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Order creation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const raiseServiceRequest = async (type: ServiceRequestType) => {
    try {
      await apiRequest(`/api/public/restaurants/${slug}/service-requests`, {
        method: "POST",
        body: {
          tableToken,
          type,
        },
      });
      setServiceMessage(`${type.replaceAll("_", " ").toLowerCase()} request sent.`);
    } catch {
      setServiceMessage("Service request failed.");
    }
  };

  if (loading) {
    return (
      <main className="shell min-h-screen py-8">
        <div className="panel">Loading menu...</div>
      </main>
    );
  }

  if (!menu || error) {
    return (
      <main className="shell min-h-screen py-8">
        <div className="panel text-danger">{error ?? "Menu unavailable"}</div>
      </main>
    );
  }

  return (
    <main className="shell space-y-6 py-6">
      <section className="panel-strong overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="badge">Smart menu</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">{menu.restaurant.name}</h1>
            <p className="mt-3 max-w-2xl text-sm text-ink-soft">
              {menu.table ? `Table ${menu.table.tableNumber}${menu.table.zone ? ` • ${menu.table.zone}` : ""}` : "Walk-in mode"}.
              Browse, customize, order, pay, and track everything from your phone.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {menu.promotions.map((promo) => (
                <span key={promo.id} className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
                  {promo.code ? `${promo.code} · ` : ""}
                  {promo.name}
                </span>
              ))}
            </div>
          </div>
          {menu.restaurant.heroImageUrl ? (
            <div className="overflow-hidden rounded-[24px] border border-line">
              <Image alt={menu.restaurant.name} className="h-full w-full object-cover" height={640} src={menu.restaurant.heroImageUrl} unoptimized width={960} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <article className="panel">
            <div className="flex flex-wrap gap-2">
              {["CALL_WAITER", "WATER", "BILL", "HELP"].map((type) => (
                <button key={type} className="btn-secondary text-xs" onClick={() => void raiseServiceRequest(type as ServiceRequestType)}>
                  {type.replaceAll("_", " ")}
                </button>
              ))}
            </div>
            {serviceMessage ? <p className="mt-3 text-sm text-ink-soft">{serviceMessage}</p> : null}
          </article>

          <article className="panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="badge">AI upsells</span>
                <h2 className="mt-3 text-2xl font-semibold">Recommended for this table</h2>
                <p className="mt-1 text-sm text-ink-soft">{menu.recommendations.reason}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {menu.recommendations.items.map((item) => (
                <button key={item.id} className="rounded-[24px] border border-line bg-white/5 p-4 text-left transition hover:bg-white/10" onClick={() => addToCart(item)}>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-ink-soft">{item.description}</p>
                  <p className="mt-3 text-sm font-semibold text-accent">{formatCurrency(item.priceCents, menu.restaurant.currency)}</p>
                </button>
              ))}
            </div>
          </article>

          <article className="panel">
            <span className="badge">Voice AI</span>
            <div className="mt-4 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
              <div className="space-y-2">
                {commonQuestions.map((question) => (
                  <button key={question} className="btn-secondary w-full text-left text-sm" onClick={() => setAiPrompt(question)}>
                    {question}
                  </button>
                ))}
              </div>
              <div className="rounded-[24px] border border-line bg-white/5 p-4">
                <p className="text-sm text-ink-soft">{aiPrompt}</p>
                <p className="mt-3 text-sm">{aiAnswer}</p>
              </div>
            </div>
          </article>

          {menu.categories.map((category) => (
            <section key={category.id} className="panel">
              <h2 className="text-2xl font-semibold">{category.name}</h2>
              {category.description ? <p className="mt-1 text-sm text-ink-soft">{category.description}</p> : null}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {category.menuItems.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-[24px] border border-line bg-black/10">
                    {item.imageUrl ? (
                      <Image alt={item.name} className="h-52 w-full object-cover" height={420} src={item.imageUrl} unoptimized width={720} />
                    ) : null}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{item.name}</h3>
                          <p className="mt-1 text-sm text-ink-soft">{item.description}</p>
                        </div>
                        <span className="text-sm font-semibold text-accent">
                          {formatCurrency(item.priceCents, menu.restaurant.currency)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-soft">
                        <span>{item.prepTimeMins} min</span>
                        {item.dietaryTags.map((tag) => (
                          <span key={tag} className="rounded-full border border-line px-2 py-1">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-ink-soft">Ingredients: {item.ingredients.join(", ")}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button className="btn-primary" onClick={() => addToCart(item)}>
                          Add to cart
                        </button>
                        {menu.experience.supportsArPreview ? <button className="btn-secondary">AR preview</button> : null}
                        {menu.experience.supportsSocialSharing ? <button className="btn-secondary">Share</button> : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="panel sticky top-4">
            <h2 className="text-2xl font-semibold">Your order</h2>
            <div className="mt-4 space-y-3">
              {cart.length === 0 ? <p className="text-sm text-ink-soft">Add items to start an order.</p> : null}
              {cart.map((item) => (
                <div key={item.menuItemId} className="rounded-[22px] border border-line bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-ink-soft">{formatCurrency(item.itemPriceCents, menu.restaurant.currency)} each</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-line px-2 py-1">
                      <button className="px-1" onClick={() => setQuantity(item.menuItemId, item.quantity - 1)}>
                        -
                      </button>
                      <span className="min-w-6 text-center text-sm">{item.quantity}</span>
                      <button className="px-1" onClick={() => setQuantity(item.menuItemId, item.quantity + 1)}>
                        +
                      </button>
                    </div>
                  </div>
                  <textarea className="input mt-3 min-h-20 text-sm" placeholder="Special instructions" value={item.specialNotes} onChange={(event) => setItemNote(item.menuItemId, event.target.value)} />
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <input className="input" placeholder="Guest name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              <input className="input" placeholder="WhatsApp phone for receipt" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
              <input className="input" placeholder="Promo code" value={promotionCode} onChange={(event) => setPromotionCode(event.target.value)} />
              <textarea className="input min-h-20" placeholder="Table notes" value={specialNotes} onChange={(event) => setSpecialNotes(event.target.value)} />
              <select className="input" value={paymentOption} onChange={(event) => setPaymentOption(event.target.value as typeof paymentOption)}>
                <option value="PAY_AT_TABLE">Pay at table</option>
                <option value="PAY_AT_COUNTER">Pay at counter</option>
                <option value="PAY_NOW">Pay now</option>
              </select>
            </div>

            <div className="mt-4 rounded-[24px] border border-line bg-accent-soft p-4 text-[#431407]">
              <p className="text-sm">Estimated total</p>
              <p className="mt-1 text-3xl font-semibold">{formatCurrency(totalCents, menu.restaurant.currency)}</p>
              <p className="mt-1 text-xs">Split bill, loyalty earning, and live tracking are enabled after checkout.</p>
            </div>

            <button className="btn-primary mt-4 w-full" onClick={submitOrder} disabled={cart.length === 0 || submitting}>
              {submitting ? "Placing order..." : "Place order"}
            </button>
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
