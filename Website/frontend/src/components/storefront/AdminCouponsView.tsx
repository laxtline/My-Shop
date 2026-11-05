"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Coupon, CouponList, CouponUsage, CouponView, Paginated } from '@shared/types';
import { apiFetch } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { useAdminLive } from '@/hooks/useAdminLive';
import { useCursorPages } from '@/hooks/useCursorPages';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CursorPager } from '@/components/ui/CursorPager';
import { CataloguePicker } from '@/components/ui/CataloguePicker';
import { LiveStatus } from '@/components/ui/LiveStatus';
import { AdminTabs } from './AdminTabs';

const EMPTY = {
  code: '', description: '', type: 'PERCENT' as Coupon['type'], value: '', maxDiscount: '',
  minOrder: '', minProductPrice: '', minItems: '', scope: 'ALL' as Coupon['scope'],
  categories: [] as string[], products: [] as string[], usageLimit: '', perUserLimit: '',
  startsAt: '', expiresAt: '', isActive: true,
};
type Form = typeof EMPTY;
const INPUT = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus-ring';
const VIEWS: { key: CouponView; label: string }[] = [
  { key: 'active', label: 'Active' }, { key: 'inactive', label: 'Inactive / Disabled' },
  { key: 'expired', label: 'Expired' }, { key: 'scheduled', label: 'Scheduled' },
];
const numericFields = [
  ['value', 'Discount value *'], ['maxDiscount', 'Percentage discount cap (₹, 0 = none)'],
  ['minOrder', 'Minimum cart total (₹)'], ['minProductPrice', 'Minimum eligible unit price (₹)'],
  ['minItems', 'Minimum eligible units'], ['usageLimit', 'Total usage limit (0 = unlimited)'],
  ['perUserLimit', 'Per-customer limit (0 = unlimited)'],
] as const;
const localDate = (value?: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

export function AdminCouponsView() {
  return <ProtectedRoute adminOnly><CouponsManager /></ProtectedRoute>;
}

function CouponsManager() {
  const [view, setView] = useState<CouponView>('active');
  const [search, setSearch] = useState('');
  const paging = useCursorPages(`${view}:${search}`);
  const [data, setData] = useState<CouponList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [usageCoupon, setUsageCoupon] = useState<Coupon | null>(null);
  const [usage, setUsage] = useState<(Paginated<CouponUsage> & { totalDiscount: number }) | null>(null);
  const usagePaging = useCursorPages(usageCoupon?.id ?? '');
  const [usageError, setUsageError] = useState('');

  const loadUsage = useCallback(async () => {
    if (!usageCoupon) return;
    try {
      setUsageError('');
      setUsage(await apiFetch<Paginated<CouponUsage> & { totalDiscount: number }>(
        `/api/coupons/${usageCoupon.id}/usage?${new URLSearchParams({ limit: '20', cursor: usagePaging.cursor })}`));
    } catch (err) { setUsageError(err instanceof Error ? err.message : 'Could not load usage.'); }
  }, [usageCoupon?.id, usagePaging.cursor]);

  const load = useCallback(async (silent = false) => {
    const request = ++requestId.current;
    if (!silent) setLoading(true);
    try {
      const next = await apiFetch<CouponList>(`/api/coupons?${new URLSearchParams({ view, q: search, limit: '20', cursor: paging.cursor })}`);
      if (request !== requestId.current) return;
      setData(next); setError('');
    } catch (err) { if (request === requestId.current) setError(err instanceof Error ? err.message : 'Could not load coupons.'); }
    finally { if (request === requestId.current) setLoading(false); }
  }, [view, search, paging.cursor]);
  const connected = useAdminLive(async () => { await Promise.all([load(true), loadUsage()]); });
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { setUsage(null); void loadUsage(); }, [loadUsage]);
  useEffect(() => {
    if (!data?.nextTransitionAt) return;
    const wait = Math.max(100, Math.min(2147483647, new Date(data.nextTransitionAt).getTime() - Date.now() + 100));
    const timer = setTimeout(() => void load(true), wait);
    return () => clearTimeout(timer);
  }, [data?.nextTransitionAt, load]);

  const edit = (coupon: Coupon | null) => {
    setEditing(coupon); setFormError('');
    if (!coupon) setForm(EMPTY);
    else {
      const next = { ...EMPTY, code: coupon.code, description: coupon.description ?? '', type: coupon.type,
        scope: coupon.scope ?? 'ALL', categories: coupon.categories ?? [], products: coupon.products ?? [],
        startsAt: localDate(coupon.startsAt), expiresAt: localDate(coupon.expiresAt), isActive: coupon.isActive };
      for (const [key] of numericFields) next[key] = String(coupon[key] ?? 0);
      setForm(next);
    }
    setOpen(true);
  };
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setFormError('');
    if (!form.code.trim()) return setFormError('Coupon code is required.');
    setSaving(true);
    try {
      const payload = { ...form, ...Object.fromEntries(numericFields.map(([key]) => [key, Number(form[key] || 0)])),
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null };
      await apiFetch(`/api/coupons${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setOpen(false); paging.reset(); await load(true);
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Could not save coupon.'); }
    finally { setSaving(false); }
  };
  const toggle = async (coupon: Coupon) => {
    try {
      await apiFetch(`/api/coupons/${coupon.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !coupon.isActive }) });
      await load(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update coupon.'); }
  };

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-900">Admin</h1><AdminTabs />
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Coupons</h2>
      <LiveStatus connected={connected} /><Button onClick={() => edit(null)}>+ Add coupon</Button></div>
    <div role="tablist" aria-label="Coupon status" className="flex flex-wrap gap-2">{VIEWS.map(({ key, label }) =>
      <button type="button" role="tab" aria-selected={view === key} key={key} onClick={() => setView(key)}
        className={`rounded-full px-3 py-2 text-sm ${view === key ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'}`}>
        {label} ({data?.counts[key] ?? 0})
      </button>)}</div>
    <input aria-label="Search coupon codes" className={INPUT} placeholder="Search coupon codes…" value={search} onChange={(e) => setSearch(e.target.value)} />
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {loading ? <p role="status">Loading coupons…</p> : !data?.items.length ? <p>No coupons in this view.</p> :
      <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50"><tr>{['Coupon', 'Discount / rules', 'Dates', 'Usage', 'Actions'].map((s) => <th className="p-3" key={s}>{s}</th>)}</tr></thead>
        <tbody>{data.items.map((coupon) => <tr key={coupon.id} className="border-t border-slate-100">
          <td className="p-3"><p className="font-semibold">{coupon.code}</p><p className="max-w-48 text-xs text-slate-500">{coupon.description}</p></td>
          <td className="p-3"><p>{coupon.type === 'PERCENT' ? `${coupon.value}%` : formatINR(coupon.value)}
            {coupon.type === 'PERCENT' && coupon.maxDiscount > 0 ? ` · cap ${formatINR(coupon.maxDiscount)}` : ''}</p>
            <p className="text-xs text-slate-500">{coupon.scope ?? 'ALL'} · Min cart {formatINR(coupon.minOrder)}<br />
              Min unit {formatINR(coupon.minProductPrice ?? 0)} · Min items {coupon.minItems ?? 0}</p></td>
          <td className="p-3 text-xs">Start: {coupon.startsAt ? new Date(coupon.startsAt).toLocaleString('en-IN') : 'Any time'}<br />
            End: {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleString('en-IN') : 'No expiry'}</td>
          <td className="p-3"><p>{coupon.totalUses ?? 0} uses · {formatINR(coupon.totalDiscount ?? 0)} given</p>
            <p className="text-xs text-slate-500">Total limit: {coupon.usageLimit || 'Unlimited'} · Per customer: {coupon.perUserLimit || 'Unlimited'}</p>
            <button type="button" className="mt-1 font-medium text-brand" onClick={() => setUsageCoupon(coupon)}>Usage log</button></td>
          <td className="p-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => edit(coupon)}>Edit</Button>
            <Button size="sm" variant={coupon.isActive ? 'danger' : 'outline'} onClick={() => toggle(coupon)}>{coupon.isActive ? 'Disable' : 'Enable'}</Button></div></td>
        </tr>)}</tbody>
      </table></div>}
    <CursorPager page={paging.page} total={data?.total} nextCursor={data?.nextCursor} onNext={paging.next} onPrevious={paging.previous} disabled={loading} />

    <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? 'Edit coupon' : 'Create coupon'} footer={<>
      <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button onClick={save} loading={saving}>Save coupon</Button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label>Coupon code *<input className={INPUT} maxLength={40} value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} /></label>
        <label>Discount type<select className={INPUT} value={form.type} onChange={(e) => set('type', e.target.value as Coupon['type'])}><option value="PERCENT">Percentage</option><option value="FLAT">Flat amount (₹)</option></select></label>
        <label className="sm:col-span-2">Description<textarea className={INPUT} maxLength={1000} value={form.description} onChange={(e) => set('description', e.target.value)} /></label>
        {numericFields.filter(([key]) => key !== 'maxDiscount' || form.type === 'PERCENT').map(([key, label]) =>
          <label key={key}>{label}<input type="number" min="0" step={['minItems', 'usageLimit', 'perUserLimit'].includes(key) ? '1' : '0.01'}
            max={key === 'value' && form.type === 'PERCENT' ? 100 : undefined} className={INPUT} value={form[key]} onChange={(e) => set(key, e.target.value)} /></label>)}
        <label className="sm:col-span-2">Applies to<select className={INPUT} value={form.scope} onChange={(e) => set('scope', e.target.value as Coupon['scope'])}>
          <option value="ALL">All products</option><option value="CATEGORIES">Specific categories</option><option value="PRODUCTS">Specific products</option></select></label>
        {form.scope !== 'ALL' && <div className="sm:col-span-2"><CataloguePicker kind={form.scope === 'CATEGORIES' ? 'categories' : 'products'} multiple
          value={form.scope === 'CATEGORIES' ? form.categories : form.products} onChange={(ids) => set(form.scope === 'CATEGORIES' ? 'categories' : 'products', ids)} /></div>}
        <label>Start (optional, local time)<input type="datetime-local" className={INPUT} value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></label>
        <label>Expiry (optional, local time)<input type="datetime-local" className={INPUT} value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />Active</label>
        <p className="text-xs text-slate-500 sm:col-span-2">Optional numeric rules default to 0. Minimum units and unit price apply to eligible products; the minimum cart total uses the whole cart. Discounts apply only to eligible items.</p>
      </div>{formError && <p role="alert" className="mt-3 text-sm text-red-600">{formError}</p>}
    </Modal>
    <Modal open={!!usageCoupon} onClose={() => setUsageCoupon(null)} title={`Usage: ${usageCoupon?.code ?? ''}`}>
      {usageError && <p role="alert" className="text-red-600">{usageError}</p>}
      <p className="mb-3 font-semibold">{usage?.total ?? 0} times used · {formatINR(usage?.totalDiscount ?? 0)} total discount</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Customer', 'Date and time', 'Order ID', 'Discount'].map((s) => <th className="p-2" key={s}>{s}</th>)}</tr></thead>
        <tbody>{usage?.items.map((u) => <tr key={u.id} className="border-t border-slate-100"><td className="p-2">{u.customerName}<br /><span className="text-xs text-slate-500">{u.customerEmail}</span></td>
          <td className="p-2">{new Date(u.createdAt).toLocaleString('en-IN')}</td><td className="p-2"><a className="break-all text-brand" href={`/orders/${u.order}`}>{u.order}</a></td><td className="p-2">{formatINR(u.discount)}</td></tr>)}</tbody></table></div>
      {usage && !usage.items.length && <p>No redemptions yet.</p>}
      <CursorPager page={usagePaging.page} total={usage?.total} nextCursor={usage?.nextCursor} onNext={usagePaging.next} onPrevious={usagePaging.previous} />
    </Modal>
  </div>;
}
