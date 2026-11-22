"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AdminShipment, AdminShipmentList } from "@shared/types";
import type { CourierCode, ShippingSettings } from "@shared/shipping";
import { COURIER_LIST, SHIPMENT_STATUS_LABELS } from "@shared/shipping";
import { apiFetch, API_URL } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminTabs } from "./AdminTabs";
import { formatINR } from "@/lib/format";

interface SettingsResponse {
  settings: ShippingSettings;
  carriers: { shiprocket: boolean; delhivery: boolean; any: boolean };
  couriers: typeof COURIER_LIST;
}

const STATUS_FILTERS = ["ALL", "PENDING", "CREATED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION", "RTO_IN_TRANSIT", "RTO_DELIVERED", "CANCELLED"];

export function AdminShipmentsView() {
  return (
    <ProtectedRoute adminOnly>
      <Shipments />
    </ProtectedRoute>
  );
}

function Shipments() {
  const [tab, setTab] = useState<"shipments" | "settings">("shipments");
  const [list, setList] = useState<AdminShipmentList | null>(null);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create-shipment form
  const [orderId, setOrderId] = useState("");
  const [courierCode, setCourierCode] = useState<CourierCode | "">("");
  const [weight, setWeight] = useState("0.5");
  const [dims, setDims] = useState({ length: "20", breadth: "15", height: "10" });
  const [creating, setCreating] = useState(false);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = status === "ALL" ? "" : `?status=${encodeURIComponent(status)}`;
      setList(await apiFetch<AdminShipmentList>(`/api/shipping/admin/shipments${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load shipments");
    } finally {
      setLoading(false);
    }
  }, [status]);

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await apiFetch<SettingsResponse>("/api/shipping/admin/settings"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load shipping settings");
    }
  }, []);

  useEffect(() => {
    void loadShipments();
  }, [loadShipments]);

  // Deep link from the admin order list: /admin/shipments?order=<id>
  useEffect(() => {
    const order = new URLSearchParams(window.location.search).get("order");
    if (order) setOrderId(order);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const act = async (shipment: AdminShipment, action: "sync" | "pickup" | "cancel") => {
    if (action === "cancel" && !confirm(`Cancel shipment ${shipment.awb || shipment.id} with the courier?`)) return;
    setBusyId(shipment.id);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/shipping/admin/shipments/${shipment.id}/${action}`, { method: "POST" });
      setNotice(action === "sync" ? "Tracking refreshed." : action === "pickup" ? "Pickup scheduled." : "Shipment cancelled.");
      await loadShipments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const openLabel = (shipment: AdminShipment) => {
    // Auth is cookie-based, so a normal tab navigation carries the session.
    window.open(`${API_URL}/api/shipping/admin/shipments/${shipment.id}/label`, "_blank", "noopener");
  };

  const createShipment = async () => {
    const id = orderId.trim();
    if (!id) {
      setError("Enter the order id to ship.");
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/shipping/admin/orders/${id}/shipment`, {
        method: "POST",
        body: JSON.stringify({
          ...(courierCode ? { courierCode } : {}),
          weight: Number(weight) || 0.5,
          length: Number(dims.length) || 20,
          breadth: Number(dims.breadth) || 15,
          height: Number(dims.height) || 10,
          schedulePickup: true,
        }),
      });
      setOrderId("");
      setNotice("Shipment created and AWB assigned.");
      await loadShipments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the shipment");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
      <AdminTabs />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-700">Shipping</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("shipments")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === "shipments" ? "bg-brand text-white" : "bg-white text-slate-600"}`}
          >
            Shipments
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === "settings" ? "bg-brand text-white" : "bg-white text-slate-600"}`}
          >
            Settings
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

      {tab === "settings" ? (
        <SettingsPanel settings={settings} onSaved={loadSettings} />
      ) : (
        <>
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
            <h3 className="text-sm font-semibold text-slate-700">Create a shipment</h3>
            <p className="mt-1 text-xs text-slate-400">
              Assign a courier and AWB for a paid order. Leave the courier empty to let the aggregator pick the cheapest service.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Order id"
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm lg:col-span-2"
              />
              <select
                value={courierCode}
                onChange={(e) => setCourierCode(e.target.value as CourierCode | "")}
                className="h-10 rounded-lg border border-slate-200 px-2 text-sm"
              >
                <option value="">Auto courier</option>
                {COURIER_LIST.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Weight kg"
                inputMode="decimal"
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <div className="flex gap-1">
                <input value={dims.length} onChange={(e) => setDims((d) => ({ ...d, length: e.target.value }))} placeholder="L" className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm" />
                <input value={dims.breadth} onChange={(e) => setDims((d) => ({ ...d, breadth: e.target.value }))} placeholder="B" className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm" />
                <input value={dims.height} onChange={(e) => setDims((d) => ({ ...d, height: e.target.value }))} placeholder="H" className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm" />
              </div>
              <Button loading={creating} onClick={createShipment}>Create</Button>
            </div>
          </section>

          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatus(f)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${status === f ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
              >
                {f === "ALL" ? "All" : SHIPMENT_STATUS_LABELS[f as keyof typeof SHIPMENT_STATUS_LABELS] ?? f}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid place-items-center py-24"><Spinner className="h-8 w-8" /></div>
          ) : !list?.shipments.length ? (
            <EmptyState icon="📦" title="No shipments here" message="Create one from a paid order to start tracking." />
          ) : (
            <div className="space-y-3">
              {list.shipments.map((shipment) => (
                <div key={shipment.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">{shipment.courierName || "Courier"}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          {SHIPMENT_STATUS_LABELS[shipment.status] ?? shipment.status}
                        </span>
                        {shipment.awb && <span className="font-mono text-xs text-slate-500">{shipment.awb}</span>}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Order{" "}
                        <Link href={`/orders/${shipment.order}`} className="font-medium text-brand hover:underline">
                          #{shipment.orderNumber ?? shipment.order.slice(-6).toUpperCase()}
                        </Link>
                        {" · "}
                        {shipment.weight} kg
                        {shipment.codAmount > 0 && <> · COD {formatINR(shipment.codAmount)}</>}
                        {shipment.estimatedDeliveryDate && (
                          <> · ETA {new Date(shipment.estimatedDeliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</>
                        )}
                      </p>
                      {shipment.events[0] && (
                        <p className="mt-1 text-xs text-slate-400">
                          {shipment.events[0].rawStatus}
                          {shipment.events[0].location ? ` · ${shipment.events[0].location}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {busyId === shipment.id ? (
                        <Spinner className="h-5 w-5" />
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => act(shipment, "sync")}>Sync</Button>
                          <Button size="sm" variant="outline" onClick={() => act(shipment, "pickup")}>Pickup</Button>
                          <Button size="sm" variant="outline" onClick={() => openLabel(shipment)}>Label</Button>
                          {!["DELIVERED", "CANCELLED", "RTO_DELIVERED"].includes(shipment.status) && (
                            <Button size="sm" variant="danger" onClick={() => act(shipment, "cancel")}>Cancel</Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {list && list.total > list.shipments.length && (
            <p className="text-center text-xs text-slate-400">
              Showing {list.shipments.length} of {list.total}. Filter by status to narrow the list.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SettingsPanel({ settings, onSaved }: { settings: SettingsResponse | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<ShippingSettings | null>(settings?.settings ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings?.settings) setForm(settings.settings);
  }, [settings]);

  if (!form) {
    return <div className="grid place-items-center py-16"><Spinner className="h-8 w-8" /></div>;
  }

  const set = <K extends keyof ShippingSettings>(key: K, value: ShippingSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch("/api/shipping/admin/settings", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setSaved(true);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Warehouse &amp; delivery policy</h3>
        <p className="text-xs text-slate-400">
          Carriers: Shiprocket {settings?.carriers.shiprocket ? "connected" : "off"} · Delhivery {settings?.carriers.delhivery ? "connected" : "off"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Pickup pincode" value={form.originPincode} onChange={(v) => set("originPincode", v)} />
        <Field label="Pickup city" value={form.originCity} onChange={(v) => set("originCity", v)} />
        <Field label="Pickup state" value={form.originState} onChange={(v) => set("originState", v)} />
        <Field label="Pickup location name" value={form.pickupLocationName} onChange={(v) => set("pickupLocationName", v)} />
        <Field label="Contact name" value={form.contactName} onChange={(v) => set("contactName", v)} />
        <Field label="Contact phone" value={form.contactPhone} onChange={(v) => set("contactPhone", v)} />
        <Field label="Address line 1" value={form.addressLine1} onChange={(v) => set("addressLine1", v)} />
        <Field label="Address line 2" value={form.addressLine2} onChange={(v) => set("addressLine2", v)} />
        <Field label="Base delivery fee (₹)" value={String(form.baseDeliveryFee)} onChange={(v) => set("baseDeliveryFee", Number(v) || 0)} numeric />
        <Field label="Free delivery over (₹)" value={String(form.freeDeliveryOver)} onChange={(v) => set("freeDeliveryOver", Number(v) || 0)} numeric />
        <Field label="COD fee (₹)" value={String(form.codFee)} onChange={(v) => set("codFee", Number(v) || 0)} numeric />
        <label className="flex items-center gap-2 self-end text-sm text-slate-600">
          <input type="checkbox" checked={form.codEnabled} onChange={(e) => set("codEnabled", e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Cash on Delivery enabled
        </label>
        <Field
          label="Serviceable pincodes (comma separated, blank = all)"
          value={form.serviceablePincodes.join(", ")}
          onChange={(v) => set("serviceablePincodes", splitList(v))}
          className="sm:col-span-2 lg:col-span-3"
        />
        <Field
          label="No-COD pincodes (comma separated)"
          value={form.noCodPincodes.join(", ")}
          onChange={(v) => set("noCodPincodes", splitList(v))}
          className="sm:col-span-2 lg:col-span-3"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Local ETA min (days)" value={String(form.localDaysMin)} onChange={(v) => set("localDaysMin", Number(v) || 0)} numeric />
        <Field label="Local ETA max (days)" value={String(form.localDaysMax)} onChange={(v) => set("localDaysMax", Number(v) || 0)} numeric />
        <div />
        <Field label="Regional ETA min" value={String(form.regionalDaysMin)} onChange={(v) => set("regionalDaysMin", Number(v) || 0)} numeric />
        <Field label="Regional ETA max" value={String(form.regionalDaysMax)} onChange={(v) => set("regionalDaysMax", Number(v) || 0)} numeric />
        <div />
        <Field label="National ETA min" value={String(form.nationalDaysMin)} onChange={(v) => set("nationalDaysMin", Number(v) || 0)} numeric />
        <Field label="National ETA max" value={String(form.nationalDaysMax)} onChange={(v) => set("nationalDaysMax", Number(v) || 0)} numeric />
      </div>

      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      {saved && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">Settings saved.</p>}
      <Button loading={saving} onClick={save}>Save settings</Button>
    </section>
  );
}

function splitList(value: string) {
  return value.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
}

function Field({
  label,
  value,
  onChange,
  className,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={numeric ? "decimal" : undefined}
        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
