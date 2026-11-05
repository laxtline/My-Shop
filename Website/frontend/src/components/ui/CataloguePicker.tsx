"use client";
import { useEffect, useId, useState } from 'react';
import type { Category, Paginated, Product } from '@shared/types';
import { apiFetch } from '@/lib/api';

type Option = { id: string; label: string; value: string };
/** Bounded server search; never downloads the full catalogue for a select. */
export function CataloguePicker({ kind = 'categories', value, onChange, multiple = false, valueKey = 'id', exclude = [] }: {
  kind?: 'categories' | 'products'; value: string[]; onChange: (ids: string[]) => void;
  multiple?: boolean; valueKey?: 'id' | 'slug'; exclude?: string[];
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endpoint = kind === 'categories' ? '/api/categories' : '/api/products/admin/all';
  const option = (item: Category | Product): Option => ({ id: item.id,
    label: 'name' in item ? item.name : item.title, value: valueKey === 'slug' ? item.slug : item.id });
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      apiFetch<Paginated<Category | Product>>(`${endpoint}?${new URLSearchParams({ q: query, limit: '20', cursor })}`, { signal: controller.signal })
        .then((data) => {
          const rows = data.items.map(option);
          setOptions((current) => cursor ? [...current, ...rows].slice(-100) : rows);
          setLabels((current) => ({ ...current, ...Object.fromEntries(rows.map((o) => [o.value, o.label])) }));
          setNext(data.nextCursor ?? null);
        }).catch((err) => { if (!controller.signal.aborted) setError(err.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [endpoint, query, cursor, valueKey]);
  const selected = value.join(',');
  useEffect(() => {
    if (valueKey !== 'id' || !selected) return;
    const controller = new AbortController();
    apiFetch<Paginated<Category | Product>>(`${endpoint}?${new URLSearchParams({ ids: selected, limit: '100' })}`, { signal: controller.signal })
      .then((data) => setLabels((current) => ({ ...current, ...Object.fromEntries(data.items.map((i) => [i.id, 'name' in i ? i.name : i.title])) })))
      .catch(() => {});
    return () => controller.abort();
  }, [endpoint, selected, valueKey]);
  const choose = (v: string) => onChange(multiple ? value.includes(v) ? value.filter((item) => item !== v) : [...value, v].slice(0, 200) : [v]);
  return <div className="space-y-2 rounded-lg border border-slate-200 p-2">
    <label htmlFor={id} className="sr-only">Search {kind}</label>
    <input id={id} value={query} placeholder={`Search ${kind}…`} onChange={(e) => { setQuery(e.target.value); setCursor(''); }}
      className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
    {!!value.length && <div className="flex max-h-24 flex-wrap gap-1 overflow-auto">{value.map((v) =>
      <button type="button" key={v} onClick={() => onChange(value.filter((i) => i !== v))} className="rounded bg-brand-50 px-2 py-1 text-xs text-brand" aria-label={`Remove ${labels[v] ?? v}`}>
        {labels[v] ?? v} ×
      </button>)}</div>}
    <ul className="max-h-44 overflow-auto" aria-label={`${kind} search results`}>
      {options.filter((o) => !exclude.includes(o.id)).map((o) => <li key={o.id}>
        <button type="button" aria-pressed={value.includes(o.value)} onClick={() => choose(o.value)}
          className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50 ${value.includes(o.value) ? 'font-semibold text-brand' : 'text-slate-700'}`}>
          {value.includes(o.value) ? '✓ ' : ''}{o.label}
        </button>
      </li>)}
    </ul>
    {loading && <p role="status" className="text-xs text-slate-500">Searching…</p>}
    {!loading && !options.length && <p className="text-xs text-slate-500">No matches.</p>}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    {next && <button type="button" disabled={loading} onClick={() => setCursor(next)} className="text-xs font-semibold text-brand">Load more results</button>}
  </div>;
}
