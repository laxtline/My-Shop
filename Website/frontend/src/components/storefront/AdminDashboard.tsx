"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Order, OrderStats, OrderStatus, Paginated } from "@shared/types";
import { apiFetch } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { AdminTabs } from "./AdminTabs";
import { formatINR } from "@/lib/format";
import { useAdminLive } from '@/hooks/useAdminLive';
import { useCursorPages } from '@/hooks/useCursorPages';
import { CursorPager } from '@/components/ui/CursorPager';
import { LiveStatus } from '@/components/ui/LiveStatus';

// mirrors server STATUS_FLOW — keep in sync
const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const FILTERS: (OrderStatus | "ALL")[] = ["ALL", "PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
// TODO: derive FILTERS from NEXT_STATUS keys to avoid duplication

export function AdminDashboard() {
  return (
    <ProtectedRoute adminOnly>
      <Dashboard />
    </ProtectedRoute>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const paging = useCursorPages(filter);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const query = `?${new URLSearchParams({ ...(filter !== 'ALL' ? { status: filter } : {}), limit: '15', cursor: paging.cursor })}`;
      const [s, list] = await Promise.all([
        apiFetch<OrderStats>("/api/orders/admin/stats"),
        apiFetch<Paginated<Order>>(`/api/orders/admin/all${query}`),
      ]);
      // console.log('[AdminDashboard] loaded:', list.items.length, 'orders');
      setStats(s);
      setOrders(list.items);
      setNextCursor(list.nextCursor ?? null);
      setTotal(list.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [filter, paging.cursor]);
  const connected = useAdminLive(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const advance = async (order: Order, next: OrderStatus) => {
    setBusyId(order.id);
    try {
      await apiFetch<Order>(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusyId(null);
    }
  };

  const collectCod = async (order: Order) => {
    if (!confirm(`Record cash of ${formatINR(order.total)} collected for order #${order.id.slice(-6).toUpperCase()}?`)) return;
    setBusyId(order.id);
    try {
      await apiFetch(`/api/orders/${order.id}/cod-collected`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record cash collection");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
      <AdminTabs />
      <h2 className="text-lg font-semibold text-slate-700">Orders</h2>
      <LiveStatus connected={connected} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total orders" value={stats ? String(stats.totalOrders) : "—"} />
        <StatCard label="Revenue" value={stats ? formatINR(stats.revenue) : "—"} accent />
        <StatCard label="Placed" value={stats ? String(stats.statusCounts.PLACED ?? 0) : "—"} />
        <StatCard label="Delivered" value={stats ? String(stats.statusCounts.DELIVERED ?? 0) : "—"} />
      </div>

      {/* Filter tabs */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="grid place-items-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon="📭" title="No orders in this view" />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const buyer = typeof order.user === "string" ? null : order.user;
            const count = order.items.reduce((n, i) => n + i.quantity, 0);
            const placed = order.createdAt
              ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
              : "";
            return (
              <div key={order.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/orders/${order.id}`} className="font-semibold text-slate-800 hover:text-brand">
                        #{order.id.slice(-6).toUpperCase()}
                      </Link>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {buyer?.name ?? "User"} · {placed} · {count} item{count === 1 ? "" : "s"} ·{" "}
                      <span className="font-semibold text-slate-700">{formatINR(order.total)}</span>
                      {" · "}
                      <span className={order.paymentStatus === "PAID" ? "text-emerald-600" : "text-amber-600"}>
                        {order.paymentMethod === "COD" ? "COD" : "Online"} · {order.paymentStatus.toLowerCase()}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {busyId === order.id ? (
                      <Spinner className="h-5 w-5" />
                    ) : (
                      <>
                        {!["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].includes(order.status) &&
                          (order.paymentMethod === "COD" || order.paymentStatus === "PAID") && (
                            <Link
                              href={`/admin/shipments?order=${order.id}`}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Ship
                            </Link>
                          )}
                        {order.paymentMethod === "COD" && order.paymentStatus !== "PAID" && order.status === "DELIVERED" && (
                          <Button size="sm" variant="outline" onClick={() => collectCod(order)}>
                            Record cash
                          </Button>
                        )}
                        {NEXT_STATUS[order.status].length === 0 ? (
                          <span className="text-xs text-slate-400">No further action</span>
                        ) : (
                          NEXT_STATUS[order.status].map((next) => (
                            <Button
                              key={next}
                              size="sm"
                              variant={next === "CANCELLED" ? "danger" : "primary"}
                              onClick={() => advance(order, next)}
                            >
                              Mark {next.charAt(0) + next.slice(1).toLowerCase()}
                            </Button>
                          ))
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <CursorPager page={paging.page} total={total} nextCursor={nextCursor} onNext={paging.next} onPrevious={paging.previous} disabled={loading} />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-emerald-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
