"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { apiRequest, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { connectRestaurantSocket } from "@/lib/socket";
import type { Order } from "@/lib/types";

type OrderResponse = Order & {
  restaurant: {
    id: string;
    slug: string;
    name: string;
    currency: string;
    whatsappNumber: string | null;
  };
};

type RazorpayIntentResponse = {
  provider: "razorpay";
  paymentId: string;
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: {
    name: string;
    contact: string;
  };
  method: "CARD" | "UPI" | "APPLE_PAY";
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

const timeline: Array<Order["status"]> = ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED"];

const ensureRazorpayScript = async () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.Razorpay) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function TrackOrderPage() {
  const params = useParams<{ slug: string; orderId: string }>();
  const search = useSearchParams();
  const slug = params.slug;
  const orderId = params.orderId;
  const receiptMode = search.get("receipt") === "1";

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<OrderResponse>(`/api/public/restaurants/${slug}/orders/${orderId}`);
        setOrder(data);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "Unable to load order");
      } finally {
        setLoading(false);
      }
    };

    void load();
    const interval = setInterval(() => void load(), 15000);
    return () => clearInterval(interval);
  }, [slug, orderId]);

  useEffect(() => {
    if (!order?.restaurantId) {
      return;
    }

    const socket = connectRestaurantSocket(order.restaurantId);
    const handleUpdated = (incoming: Order) => {
      if (incoming.id !== orderId) {
        return;
      }
      setOrder((prev) => (prev ? { ...prev, ...incoming } : prev));
    };

    socket.on("order:new", handleUpdated);
    socket.on("order:updated", handleUpdated);
    return () => {
      socket.off("order:new", handleUpdated);
      socket.off("order:updated", handleUpdated);
      socket.disconnect();
    };
  }, [order?.restaurantId, orderId]);

  const progressIndex = useMemo(() => (order ? timeline.indexOf(order.status) : -1), [order]);

  const pay = async (method: "UPI" | "CARD" | "APPLE_PAY" | "CASH") => {
    try {
      setPaymentLoading(true);
      setPaymentMessage(null);

      if (method === "CASH") {
        const result = await apiRequest<{ receiptUrl: string; whatsapp: { delivered: boolean; reason: string } }>(
          `/api/public/restaurants/${slug}/orders/${orderId}/payment`,
          {
            method: "PATCH",
            body: { method },
          },
        );

        setPaymentMessage(`Payment complete. ${result.whatsapp.reason}`);
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                paymentStatus: "PAID",
                paymentMethod: method,
                whatsappReceiptUrl: result.receiptUrl,
              }
            : prev,
        );
        return;
      }

      const scriptReady = await ensureRazorpayScript();
      if (!scriptReady || typeof window === "undefined" || !window.Razorpay) {
        setPaymentMessage("Razorpay checkout script failed to load.");
        return;
      }

      const intent = await apiRequest<RazorpayIntentResponse>(
        `/api/public/restaurants/${slug}/orders/${orderId}/payment-intent`,
        {
          method: "PATCH",
          body: { method },
        },
      );

      const instance = new window.Razorpay({
        key: intent.keyId,
        amount: intent.amount,
        currency: intent.currency,
        name: intent.name,
        description: intent.description,
        order_id: intent.orderId,
        prefill: intent.prefill,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verification = await apiRequest<{ receiptUrl: string }>(
            `/api/public/restaurants/${slug}/orders/${orderId}/payment/verify`,
            {
              method: "POST",
              body: {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
            },
          );

          setPaymentMessage("Payment verified. Receipt queued for WhatsApp delivery.");
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  paymentStatus: "PAID",
                  paymentMethod: method === "UPI" ? "UPI" : "CARD",
                  whatsappReceiptUrl: verification.receiptUrl,
                }
              : prev,
          );
        },
        theme: {
          color: "#f97316",
        },
      });

      instance.open();
    } catch (caught) {
      setPaymentMessage(caught instanceof ApiError ? caught.message : "Payment failed");
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="shell min-h-screen py-8">
        <div className="panel">Loading order...</div>
      </main>
    );
  }

  if (!order || error) {
    return (
      <main className="shell min-h-screen py-8">
        <div className="panel text-danger">{error ?? "Order not found"}</div>
      </main>
    );
  }

  return (
    <main className="shell space-y-4 py-8">
      <section className="panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="badge">{receiptMode ? "Digital receipt" : "Live order tracking"}</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">
              Order #{order.orderNumber ?? order.id.slice(0, 8)}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              {order.table ? `Table ${order.table.tableNumber}` : "Walk-in"} | {order.restaurant.name}
            </p>
          </div>
          <div className="rounded-[24px] border border-line bg-white/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">ETA</p>
            <p className="mt-1 text-2xl font-semibold">{order.liveTracking?.etaMinutes ?? 0} min</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="text-xl font-semibold">Progress</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {timeline.map((status, index) => (
            <div
              key={status}
              className={`rounded-2xl border px-3 py-3 text-center text-sm font-semibold ${index <= progressIndex ? "border-accent bg-accent text-white" : "border-line bg-white/60 text-ink-soft"}`}
            >
              {status}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <article className="panel">
          <h2 className="text-xl font-semibold">Items</h2>
          <div className="mt-4 space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-line bg-white/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">
                    {item.quantity}x {item.itemName}
                  </p>
                  <span className="rounded-full border border-line px-3 py-1 text-xs">{item.status}</span>
                </div>
                {item.specialNotes ? <p className="mt-2 text-sm text-ink-soft">Note: {item.specialNotes}</p> : null}
              </div>
            ))}
          </div>
        </article>

        <aside className="space-y-4">
          <div className="panel">
            <h2 className="text-xl font-semibold">Bill</h2>
            <div className="mt-4 space-y-2 text-sm text-ink-soft">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotalCents ?? order.totalCents, order.restaurant.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrency(order.taxCents ?? 0, order.restaurant.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service charge</span>
                <span>{formatCurrency(order.serviceChargeCents ?? 0, order.restaurant.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>-{formatCurrency(order.discountCents ?? 0, order.restaurant.currency)}</span>
              </div>
            </div>
            <div className="mt-4 rounded-[24px] bg-accent-soft p-4 text-[#431407]">
              <p className="text-sm">Total</p>
              <p className="mt-1 text-3xl font-semibold">{formatCurrency(order.totalCents, order.restaurant.currency)}</p>
              <p className="text-xs">Payment status: {order.paymentStatus ?? "PENDING"}</p>
            </div>

            {order.paymentStatus !== "PAID" ? (
              <div className="mt-4 space-y-2">
                <button className="btn-primary w-full" disabled={paymentLoading} onClick={() => void pay("UPI")}>
                  {paymentLoading ? "Processing..." : "Pay with UPI"}
                </button>
                <button className="btn-secondary w-full" disabled={paymentLoading} onClick={() => void pay("CARD")}>
                  Pay by card
                </button>
                <button className="btn-secondary w-full" disabled={paymentLoading} onClick={() => void pay("APPLE_PAY")}>
                  Apple Pay / Wallets
                </button>
                <button className="btn-secondary w-full" disabled={paymentLoading} onClick={() => void pay("CASH")}>
                  Mark paid at counter
                </button>
              </div>
            ) : null}

            {order.whatsappReceiptUrl ? (
              <a className="btn-secondary mt-4 block w-full text-center" href={order.whatsappReceiptUrl} target="_blank" rel="noreferrer">
                Download receipt
              </a>
            ) : null}
            {paymentMessage ? <p className="mt-3 text-sm text-ink-soft">{paymentMessage}</p> : null}
          </div>

          <div className="panel">
            <h2 className="text-xl font-semibold">Loyalty</h2>
            <p className="mt-2 text-sm text-ink-soft">
              {order.loyalty ? `${order.loyalty.pointsBalance} points | ${order.loyalty.tierName}` : "Points appear after your first paid order."}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
