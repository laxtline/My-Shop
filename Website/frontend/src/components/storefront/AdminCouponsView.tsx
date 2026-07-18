"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Coupon, CouponType } from "@shared/types";
import { apiFetch } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { AdminTabs } from "./AdminTabs";
import { formatINR } from "@/lib/format";

interface CouponForm {
  code: string;
  type: CouponType;
  value: string;
  minOrder: string;
  maxDiscount: string;
  isActive: boolean;
  expiresAt: string;
}

const EMPTY: CouponForm = {
  code: "",
  type: "PERCENT",
  value: "",
  minOrder: "0",
  maxDiscount: "0",
  isActive: true,
  expiresAt: "",
};

export function AdminCouponsView() {
  return (
    <ProtectedRoute adminOnly>
      <CouponsManager />
    </ProtectedRoute>
  );
}

function CouponsManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCoupons(await apiFetch<Coupon[]>("/api/coupons"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY);
    setFormError(null);
    setOpen(true);
  };

  const save = async () => {
    setFormError(null);
    if (!form.code.trim()) return setFormError("Coupon code is required.");
    if (!form.value || Number(form.value) <= 0) return setFormError("Value must be greater than 0.");
    if (form.type === "PERCENT" && Number(form.value) > 100)
      return setFormError("Percent value cannot exceed 100.");

    setSaving(true);
    try {
      await apiFetch<Coupon>("/api/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          type: form.type,
          value: Number(form.value),
          minOrder: Number(form.minOrder) || 0,
          maxDiscount: Number(form.maxDiscount) || 0,
          isActive: form.isActive,
          expiresAt: form.expiresAt || null,
        }),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create coupon");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/coupons/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete coupon");
    }
  };

  const set = <K extends keyof CouponForm>(k: K, v: CouponForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const describe = (c: Coupon) =>
    c.type === "PERCENT"
      ? `${c.value}% off${c.maxDiscount ? ` (max ${formatINR(c.maxDiscount)})` : ""}`
      : `${formatINR(c.value)} off`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
      <AdminTabs />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Coupons</h2>
        <Button size="sm" onClick={openCreate}>
          + Add coupon
        </Button>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="grid place-items-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      ) : coupons.length === 0 ? (
        <EmptyState icon="🏷️" title="No coupons yet" message="Create a discount code for your customers." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Min order</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">{c.code}</td>
                  <td className="px-4 py-3 text-slate-700">{describe(c)}</td>
                  <td className="px-4 py-3 text-slate-600">{c.minOrder ? formatINR(c.minOrder) : "—"}</td>
                  <td className="px-4 py-3">
                    {c.isActive ? <Badge tone="emerald">Active</Badge> : <Badge tone="slate">Inactive</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(c)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Add coupon"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Create
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Code" className="col-span-2">
            <input
              className={INPUT}
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="DIWALI10"
            />
          </Field>
          <Field label="Type">
            <select className={INPUT} value={form.type} onChange={(e) => set("type", e.target.value as CouponType)}>
              <option value="PERCENT">Percent (%)</option>
              <option value="FLAT">Flat (₹)</option>
            </select>
          </Field>
          <Field label={form.type === "PERCENT" ? "Percent value" : "Flat amount (₹)"}>
            <input type="number" className={INPUT} value={form.value} onChange={(e) => set("value", e.target.value)} />
          </Field>
          <Field label="Min order (₹)">
            <input
              type="number"
              className={INPUT}
              value={form.minOrder}
              onChange={(e) => set("minOrder", e.target.value)}
            />
          </Field>
          <Field label="Max discount (₹, 0 = none)">
            <input
              type="number"
              className={INPUT}
              value={form.maxDiscount}
              onChange={(e) => set("maxDiscount", e.target.value)}
            />
          </Field>
          <Field label="Expiry (optional)" className="col-span-2">
            <input
              type="date"
              className={INPUT}
              value={form.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
            />
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            Active
          </label>
        </div>
        {formError && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete coupon"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Delete coupon <span className="font-mono font-semibold text-slate-800">{deleteTarget?.code}</span>?
        </p>
      </Modal>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus-ring placeholder:text-slate-400";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
