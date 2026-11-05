"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Category, Paginated } from "@shared/types";
import { apiFetch } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { AdminTabs } from "./AdminTabs";
import { PLACEHOLDER_IMAGE } from "@/lib/format";
import { imageUrl, isImageKitUrl } from '@shared/images';
import { ImageKitPreview } from '@/components/ui/ImageKitPreview';
import { CataloguePicker } from '@/components/ui/CataloguePicker';
import { CursorPager } from '@/components/ui/CursorPager';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useAdminLive } from '@/hooks/useAdminLive';
import { LiveStatus } from '@/components/ui/LiveStatus';

interface CategoryForm {
  name: string;
  image: string;
  order: string;
  parentCategory: string;
}

const EMPTY_FORM: CategoryForm = { name: "", image: "", order: "0", parentCategory: "" };

function formFromCategory(c: Category): CategoryForm {
  return {
    name: c.name,
    image: c.image ?? "",
    order: String(c.order ?? 0),
    parentCategory: typeof c.parentCategory === "string" ? c.parentCategory : "",
  };
}

export function AdminCategoriesView() {
  return (
    <ProtectedRoute adminOnly>
      <CategoriesManager />
    </ProtectedRoute>
  );
}

function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const paging = useCursorPages(search);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Paginated<Category>>(`/api/categories?${new URLSearchParams({ q: search, limit: '20', cursor: paging.cursor })}`, { cache: 'no-store' });
      setCategories(data.items); setNextCursor(data.nextCursor ?? null); setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [search, paging.cursor]);

  const connected = useAdminLive(() => load(true));

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm(formFromCategory(c));
    setFormError(null);
    setFormOpen(true);
  };

  const save = async () => {
    setFormError(null);
    if (!form.name.trim()) return setFormError("Name is required.");
    if (form.image.trim() && form.image.trim() !== editing?.image && !isImageKitUrl(form.image.trim())) return setFormError('Use a valid HTTPS ImageKit image URL.');

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        image: form.image.trim(),
        order: Number(form.order) || 0,
        parentCategory: form.parentCategory || null,
      };
      if (editing) {
        await apiFetch<Category>(`/api/categories/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<Category>("/api/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/categories/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setDeleting(false);
    }
  };

  const set = <K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Parent options exclude the category being edited (can't be its own parent).
  const parentOptions = categories.filter((c) => c.id !== editing?.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
      <AdminTabs />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Categories</h2>
        <LiveStatus connected={connected} />
        <Button size="sm" onClick={openCreate}>
          + Add category
        </Button>
      </div>

      <input aria-label="Search categories" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search category names…" className={INPUT} />
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="grid place-items-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState icon="🗂️" title="No categories yet" message="Add your first category to organise products." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-card">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl(c.image || PLACEHOLDER_IMAGE, 80, 80)}
                        loading="lazy"
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                      <span className="font-medium text-slate-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.slug}</td>
                  <td className="px-4 py-3 text-slate-700">{c.order}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
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
      <CursorPager page={paging.page} total={total} nextCursor={nextCursor} onNext={paging.next} onPrevious={paging.previous} disabled={loading} />

      {/* Create / Edit modal */}
      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? "Edit category" : "Add category"}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Create category"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name *">
            <input className={INPUT} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Image URL">
            <input className={INPUT} value={form.image} onChange={(e) => set("image", e.target.value)} />
            <ImageKitPreview url={form.image} existing={form.image === editing?.image} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Order">
              <input
                type="number"
                className={INPUT}
                value={form.order}
                onChange={(e) => set("order", e.target.value)}
              />
            </Field>
            <div><p className="mb-1 text-xs font-medium text-slate-500">Parent category (optional)</p>
              <CataloguePicker value={form.parentCategory ? [form.parentCategory] : []} onChange={(ids) => set('parentCategory', ids[0] ?? '')} exclude={editing ? [editing.id] : []} />
            </div>
          </div>
        </div>

        {formError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{formError}</p>}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete category"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Delete <span className="font-semibold text-slate-800">{deleteTarget?.name}</span>? Products in this
          category and child categories must be moved or deleted first.
        </p>
      </Modal>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus-ring placeholder:text-slate-400";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
