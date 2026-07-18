"use client";

import { useState } from "react";
import Link from "next/link";
import type { SavedAddress, User } from "@shared/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setUser } from "@/store/authSlice";
import { apiFetch } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface AddrForm {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

const EMPTY: AddrForm = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: false,
};

export function AccountView() {
  return (
    <ProtectedRoute fallback={<SignInPrompt />}>
      <Account />
    </ProtectedRoute>
  );
}

function SignInPrompt() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <p className="text-slate-600">Please sign in to view your account.</p>
      <Link href="/" className="mt-3 inline-block font-medium text-brand hover:underline">
        Go home
      </Link>
    </div>
  );
}

function Account() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;
  const addresses = user.addresses ?? [];

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddrForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  };

  const openEdit = (a: SavedAddress) => {
    setEditingId(a.id);
    setForm({
      fullName: a.fullName,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2 ?? "",
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      isDefault: !!a.isDefault,
    });
    setError(null);
    setOpen(true);
  };

  const set = <K extends keyof AddrForm>(k: K, v: AddrForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setError(null);
    if (!form.fullName.trim()) return setError("Full name is required.");
    if (!/^\d{10}$/.test(form.phone.trim())) return setError("Enter a valid 10-digit phone number.");
    if (!form.line1.trim()) return setError("Address line 1 is required.");
    if (!form.city.trim() || !form.state.trim()) return setError("City and state are required.");
    if (!/^\d{6}$/.test(form.pincode.trim())) return setError("Enter a valid 6-digit pincode.");

    setSaving(true);
    try {
      const updated = editingId
        ? await apiFetch<User>(`/api/addresses/${editingId}`, {
            method: "PUT",
            body: JSON.stringify(form),
          })
        : await apiFetch<User>("/api/addresses", {
            method: "POST",
            body: JSON.stringify(form),
          });
      dispatch(setUser(updated));
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this address?")) return;
    setBusyId(id);
    try {
      const updated = await apiFetch<User>(`/api/addresses/${id}`, { method: "DELETE" });
      dispatch(setUser(updated));
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  };

  const makeDefault = async (a: SavedAddress) => {
    setBusyId(a.id);
    try {
      const updated = await apiFetch<User>(`/api/addresses/${a.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...a, isDefault: true }),
      });
      dispatch(setUser(updated));
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">My account</h1>

      {/* Profile */}
      <section className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.picture} alt="" className="h-16 w-16 rounded-full" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
            {user.name?.[0]?.toUpperCase() ?? "U"}
          </span>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{user.name}</h2>
            {user.role === "ADMIN" && <Badge tone="brand">Admin</Badge>}
          </div>
          <p className="text-sm text-slate-500">{user.email}</p>
          <div className="mt-2 flex gap-3 text-sm">
            <Link href="/orders" className="font-medium text-brand hover:underline">
              My orders
            </Link>
            <Link href="/wishlist" className="font-medium text-brand hover:underline">
              My wishlist
            </Link>
          </div>
        </div>
      </section>

      {/* Addresses */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Saved addresses</h2>
          <Button size="sm" onClick={openAdd}>
            + Add address
          </Button>
        </div>

        {addresses.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No saved addresses yet. Add one to check out faster.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-800">{a.fullName}</p>
                  {a.isDefault && <Badge tone="emerald">Default</Badge>}
                </div>
                <address className="mt-1 text-sm not-italic leading-relaxed text-slate-600">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}
                  <br />
                  {a.city}, {a.state} — {a.pincode}
                  <br />
                  📞 {a.phone}
                </address>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)} disabled={busyId === a.id}>
                    Edit
                  </Button>
                  {!a.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => makeDefault(a)}
                      disabled={busyId === a.id}
                    >
                      Set default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => remove(a.id)}
                    disabled={busyId === a.id}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add / edit modal */}
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={editingId ? "Edit address" : "Add address"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AddrField label="Full name" className="sm:col-span-2" value={form.fullName} onChange={(v) => set("fullName", v)} />
          <AddrField label="Phone (10-digit)" value={form.phone} onChange={(v) => set("phone", v)} inputMode="numeric" />
          <AddrField label="Pincode (6-digit)" value={form.pincode} onChange={(v) => set("pincode", v)} inputMode="numeric" />
          <AddrField label="Address line 1" className="sm:col-span-2" value={form.line1} onChange={(v) => set("line1", v)} />
          <AddrField label="Address line 2 (optional)" className="sm:col-span-2" value={form.line2} onChange={(v) => set("line2", v)} />
          <AddrField label="City" value={form.city} onChange={(v) => set("city", v)} />
          <AddrField label="State" value={form.state} onChange={(v) => set("state", v)} />
          <label className="mt-1 flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.isDefault}
              onChange={(e) => set("isDefault", e.target.checked)}
            />
            Set as default address
          </label>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      </Modal>
    </div>
  );
}

function AddrField({
  label,
  value,
  onChange,
  className = "",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
