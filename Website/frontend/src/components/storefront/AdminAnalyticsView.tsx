"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderAnalytics, OrderStats } from "@shared/types";
import { apiFetch } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminTabs } from "./AdminTabs";
import { formatINR } from "@/lib/format";
import { useAdminLive } from '@/hooks/useAdminLive';
import { LiveStatus } from '@/components/ui/LiveStatus';

export function AdminAnalyticsView() {
  return (
    <ProtectedRoute adminOnly>
      <Analytics />
    </ProtectedRoute>
  );
}

function Analytics() {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [data, setData] = useState<OrderAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [s, a] = await Promise.all([
        apiFetch<OrderStats>("/api/orders/admin/stats"),
        apiFetch<OrderAnalytics>("/api/orders/admin/analytics"),
      ]);
      setStats(s);
      setData(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);
  const connected = useAdminLive(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const maxRevenue = Math.max(1, ...(data?.revenueByDay ?? []).map((d) => d.revenue));
  const maxQty = Math.max(1, ...(data?.topProducts ?? []).map((p) => p.qty));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
      <AdminTabs />
      <h2 className="text-lg font-semibold text-slate-700">Analytics</h2>
      <LiveStatus connected={connected} />

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="grid place-items-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total orders" value={stats ? String(stats.totalOrders) : "—"} />
            <StatCard label="Revenue" value={stats ? formatINR(stats.revenue) : "—"} accent />
            <StatCard label="Delivered" value={stats ? String(stats.statusCounts.DELIVERED ?? 0) : "—"} />
            <StatCard label="Placed" value={stats ? String(stats.statusCounts.PLACED ?? 0) : "—"} />
            <StatCard label="Units sold" value={stats ? String(stats.sales) : '—'} />
            <StatCard label="Coupon uses" value={stats ? String(stats.couponUses) : '—'} />
            <StatCard label="Discount given" value={stats ? formatINR(stats.discountGiven) : '—'} />
          </div>

          {/* Revenue — last 14 days */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h3 className="text-sm font-semibold text-slate-800">Revenue · last 30 days (IST)</h3>
            {!data || data.revenueByDay.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No sales in this period yet.</p>
            ) : (
              <div className="mt-6 flex h-44 items-end gap-1.5">
                {data.revenueByDay.map((d) => (
                  <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-brand transition-all group-hover:bg-brand-700"
                      style={{ height: `${Math.max(2, (d.revenue / maxRevenue) * 100)}%` }}
                      title={`${d.date}: ${formatINR(d.revenue)} · ${d.orders} order(s)`}
                    />
                    <span className="text-[10px] text-slate-400">{d.date.slice(8, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Top products */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h3 className="text-sm font-semibold text-slate-800">Top-selling products · last 30 days</h3>
            {!data || data.topProducts.length === 0 ? (
              <EmptyState icon="📊" title="No sales yet" message="Top products will appear here after orders." />
            ) : (
              <ul className="mt-4 space-y-3">
                {data.topProducts.map((p) => (
                  <li key={p.title}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="line-clamp-1 font-medium text-slate-700">{p.title}</span>
                      <span className="shrink-0 text-slate-500">
                        {p.qty} sold · {formatINR(p.revenue)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${(p.qty / maxQty) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h3 className="font-semibold">Coupon performance · last 30 days</h3>
            <p className="mt-1 text-xs text-slate-500">Sales and revenue exclude cancelled orders. Revenue includes delivery and subtracts coupon discounts; product revenue is before order-level discounts. Coupon usage logs retain all redemptions, including later cancellations.</p>
            {!data?.couponUsage.length ? <p className="mt-3 text-sm text-slate-500">No coupon redemptions in this period.</p> :
              <ul className="mt-3 space-y-2 text-sm">{data.couponUsage.map((c) => <li key={c.code} className="flex justify-between gap-3"><span>{c.code} · {c.uses} uses</span><span>{formatINR(c.discount)} discount</span></li>)}</ul>}
          </section>
        </>
      )}
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
