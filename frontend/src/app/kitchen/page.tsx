"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { apiRequest, ApiError } from "@/lib/api";
import { clearSession, readSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
import { connectRestaurantSocket } from "@/lib/socket";
import type { AuthSession, Order, OrderItem } from "@/lib/types";

const orderStatusOptions: Array<Order["status"]> = ["ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED"];
const itemStatusOptions: Array<OrderItem["status"]> = ["PREPARING", "READY", "SERVED"];

export default function KitchenPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = session?.token;
  const currency = session?.restaurant.currency ?? "USD";

  const loadOrders = async (authToken: string) => {
    const data = await apiRequest<Order[]>("/api/kitchen/orders?active=true", {
      token: authToken,
    });
    setOrders(data);
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
        await loadOrders(saved.token);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          router.push("/admin/login");
          return;
        }
        setError(caught instanceof Error ? caught.message : "Failed to load kitchen feed");
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
        const index = prev.findIndex((order) => order.id === incoming.id);
        if (index === -1) {
          return [...prev, incoming];
        }
        const next = [...prev];
        next[index] = incoming;
        return next;
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

  const updateOrderStatus = async (orderId: string, status: Order["status"]) => {
    if (!token) {
      return;
    }
    await apiRequest<void>(`/api/kitchen/orders/${orderId}/status`, {
      method: "PATCH",
      token,
      body: { status },
    });
    await loadOrders(token);
  };

  const updateItemStatus = async (orderId: string, itemId: string, status: OrderItem["status"]) => {
    if (!token) {
      return;
    }
    await apiRequest<void>(`/api/kitchen/orders/${orderId}/items/${itemId}/status`, {
      method: "PATCH",
      token,
      body: { status },
    });
    await loadOrders(token);
  };

  const grouped = useMemo(
    () => ({
      incoming: orders.filter((order) => ["PENDING", "ACCEPTED"].includes(order.status)),
      preparing: orders.filter((order) => order.status === "PREPARING"),
      ready: orders.filter((order) => order.status === "READY"),
    }),
    [orders],
  );

  if (loading) {
    return (
      <main className="shell min-h-screen py-8">
        <div className="panel">Loading kitchen display...</div>
      </main>
    );
  }

  return (
    <main className="shell space-y-4 py-6">
      <section className="panel-strong">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="badge">Kitchen display</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">{session?.restaurant.name}</h1>
            <p className="mt-2 text-sm text-ink-soft">Realtime prep board with per-item readiness and guest-visible status sync.</p>
          </div>
          <a className="btn-secondary" href="/admin/dashboard">
            Back to admin
          </a>
        </div>
      </section>

      {error ? <div className="panel text-danger">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-3">
        {[
          { key: "incoming", title: "Incoming", orders: grouped.incoming },
          { key: "preparing", title: "Preparing", orders: grouped.preparing },
          { key: "ready", title: "Ready", orders: grouped.ready },
        ].map((column) => (
          <article key={column.key} className="panel">
            <h2 className="text-2xl font-semibold">{column.title}</h2>
            <div className="mt-4 space-y-3">
              {column.orders.map((order) => (
                <div key={order.id} className="rounded-[24px] border border-line bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {order.table ? `Table ${order.table.tableNumber}` : "Counter"} • #{order.orderNumber ?? order.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-ink-soft">
                        {formatCurrency(order.totalCents, currency)} • {new Date(order.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <select className="input max-w-44 text-sm" value={order.status} onChange={(event) => void updateOrderStatus(order.id, event.target.value as Order["status"])}>
                      {orderStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="rounded-[20px] border border-line bg-black/10 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">
                            {item.quantity}x {item.itemName}
                          </p>
                          <span className="text-xs text-ink-soft">{item.status}</span>
                        </div>
                        {item.specialNotes ? <p className="mt-2 text-xs text-ink-soft">Note: {item.specialNotes}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {itemStatusOptions.map((status) => (
                            <button key={status} className={item.status === status ? "btn-primary text-xs" : "btn-secondary text-xs"} onClick={() => void updateItemStatus(order.id, item.id, status)}>
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
