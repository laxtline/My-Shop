"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Category, Paginated, Product } from "@shared/types";
import { apiFetch } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { AdminTabs } from "./AdminTabs";
import { formatINR, primaryImage } from "@/lib/format";
import { uploadImageFile } from "@/lib/upload";

// ---------------------------------------------------------------------------
// Form state — all inputs are strings; converted to the API payload on submit.
// ---------------------------------------------------------------------------
interface ProductForm {
  title: string;
  sku: string;
  category: string; // category id
  brand: string;
  description: string;
  price: string;
  mrp: string;
  stock: string;
  gstRate: string;
  weight: string;
  isActive: boolean;
  imagesText: string; // one URL per line
  tagsText: string; // comma separated
  specsText: string; // "key: value" per line
  bulkText: string; // "minQty: pricePerUnit" per line
}

const EMPTY_FORM: ProductForm = {
  title: "",
  sku: "",
  category: "",
  brand: "",
  description: "",
  price: "",
  mrp: "",
  stock: "0",
  gstRate: "18",
  weight: "0",
  isActive: true,
  imagesText: "",
  tagsText: "",
  specsText: "",
  bulkText: "",
};

function categoryId(category: Product["category"]): string {
  return typeof category === "string" ? category : category?.id ?? "";
}

function formFromProduct(p: Product): ProductForm {
  return {
    title: p.title,
    sku: p.sku,
    category: categoryId(p.category),
    brand: p.brand ?? "",
    description: p.description ?? "",
    price: String(p.price),
    mrp: String(p.mrp),
    stock: String(p.stock),
    gstRate: String(p.gstRate),
    weight: String(p.weight),
    isActive: p.isActive,
    imagesText: (p.images ?? []).join("\n"),
    tagsText: (p.tags ?? []).join(", "),
    specsText: Object.entries(p.specifications ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
    bulkText: (p.bulkPricing ?? []).map((t) => `${t.minQty}: ${t.pricePerUnit}`).join("\n"),
  };
}

function parseSpecs(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function parseBulk(text: string): { minQty: number; pricePerUnit: number }[] {
  const out: { minQty: number; pricePerUnit: number }[] = [];
  for (const line of text.split("\n")) {
    const [q, p] = line.split(":");
    const minQty = Number(q);
    const pricePerUnit = Number(p);
    if (minQty > 0 && pricePerUnit >= 0) out.push({ minQty, pricePerUnit });
  }
  return out;
}

function buildPayload(form: ProductForm) {
  return {
    title: form.title.trim(),
    sku: form.sku.trim(),
    category: form.category,
    brand: form.brand.trim(),
    description: form.description,
    price: Number(form.price),
    mrp: Number(form.mrp),
    stock: Number(form.stock) || 0,
    gstRate: Number(form.gstRate) || 0,
    weight: Number(form.weight) || 0,
    isActive: form.isActive,
    images: form.imagesText.split("\n").map((s) => s.trim()).filter(Boolean),
    tags: form.tagsText.split(",").map((s) => s.trim()).filter(Boolean),
    specifications: parseSpecs(form.specsText),
    bulkPricing: parseBulk(form.bulkText),
  };
}

export function AdminProductsView() {
  return (
    <ProtectedRoute adminOnly>
      <ProductsManager />
    </ProtectedRoute>
  );
}

function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [editing, setEditing] = useState<Product | null>(null); // null + open=create
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, cats] = await Promise.all([
        apiFetch<Paginated<Product>>(`/api/products/admin/all?page=${page}&limit=20`),
        apiFetch<Category[]>("/api/categories"),
      ]);
      setProducts(list.items);
      setTotalPages(list.totalPages);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: categories[0]?.id ?? "" });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm(formFromProduct(p));
    setFormError(null);
    setFormOpen(true);
  };

  const save = async () => {
    setFormError(null);
    if (!form.title.trim()) return setFormError("Title is required.");
    if (!form.sku.trim()) return setFormError("SKU is required.");
    if (!form.category) return setFormError("Please choose a category.");
    if (!form.price || Number(form.price) <= 0) return setFormError("Price must be greater than 0.");
    if (!form.mrp || Number(form.mrp) <= 0) return setFormError("MRP must be greater than 0.");

    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editing) {
        await apiFetch<Product>(`/api/products/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<Product>("/api/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/products/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  };

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Upload picked image files and append their URLs to the images textarea.
  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadImageFile(file));
      }
      setForm((f) => ({
        ...f,
        imagesText: [f.imagesText.trim(), ...urls].filter(Boolean).join("\n"),
      }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const imageUrls = form.imagesText.split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
      <AdminTabs />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Products</h2>
        <Button size="sm" onClick={openCreate} disabled={categories.length === 0}>
          + Add product
        </Button>
      </div>

      {categories.length === 0 && !loading && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          Create a category first — products need one.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="grid place-items-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState icon="📦" title="No products yet" message="Add your first product to get started." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={primaryImage(p)}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{p.title}</p>
                        <p className="truncate text-xs text-slate-400">
                          {p.sku}
                          {typeof p.category !== "string" && p.category ? ` · ${p.category.name}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-800">{formatINR(p.price)}</span>
                    {p.mrp > p.price && (
                      <span className="ml-1 text-xs text-slate-400 line-through">{formatINR(p.mrp)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={p.stock === 0 ? "font-semibold text-red-600" : "text-slate-700"}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <Badge tone="emerald">Active</Badge>
                    ) : (
                      <Badge tone="slate">Hidden</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(p)}>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? "Edit product" : "Add product"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Create product"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Title *" className="sm:col-span-2">
            <input className={INPUT} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>

          <Field label="SKU *">
            <input className={INPUT} value={form.sku} onChange={(e) => set("sku", e.target.value)} />
          </Field>
          <Field label="Category *">
            <select className={INPUT} value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Brand">
            <input className={INPUT} value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          </Field>
          <Field label="Weight (kg)">
            <input
              type="number"
              className={INPUT}
              value={form.weight}
              onChange={(e) => set("weight", e.target.value)}
            />
          </Field>

          <Field label="Price (₹) *">
            <input
              type="number"
              className={INPUT}
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
            />
          </Field>
          <Field label="MRP (₹) *">
            <input
              type="number"
              className={INPUT}
              value={form.mrp}
              onChange={(e) => set("mrp", e.target.value)}
            />
          </Field>

          <Field label="Stock">
            <input
              type="number"
              className={INPUT}
              value={form.stock}
              onChange={(e) => set("stock", e.target.value)}
            />
          </Field>
          <Field label="GST rate (%)">
            <input
              type="number"
              className={INPUT}
              value={form.gstRate}
              onChange={(e) => set("gstRate", e.target.value)}
            />
          </Field>

          <Field label="Description" className="sm:col-span-2">
            <textarea
              className={INPUT}
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>

          <Field label="Images" className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {uploading ? "Uploading…" : "⬆️ Upload images"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => onUpload(e.target.files)}
                />
              </label>
              <span className="text-xs text-slate-400">or paste URLs below (one per line)</span>
            </div>
            {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}

            {imageUrls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {imageUrls.map((url, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
                    <button
                      type="button"
                      onClick={() =>
                        set("imagesText", imageUrls.filter((_, idx) => idx !== i).join("\n"))
                      }
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-xs text-white"
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              className={`${INPUT} mt-3`}
              rows={2}
              placeholder="https://…/image1.jpg"
              value={form.imagesText}
              onChange={(e) => set("imagesText", e.target.value)}
            />
          </Field>

          <Field label="Tags (comma separated)" className="sm:col-span-2">
            <input
              className={INPUT}
              placeholder="premium, waterproof"
              value={form.tagsText}
              onChange={(e) => set("tagsText", e.target.value)}
            />
          </Field>

          <Field label="Specifications (key: value, one per line)">
            <textarea
              className={INPUT}
              rows={3}
              placeholder="Size: 600x600 mm"
              value={form.specsText}
              onChange={(e) => set("specsText", e.target.value)}
            />
          </Field>
          <Field label="Bulk pricing (minQty: price, one per line)">
            <textarea
              className={INPUT}
              rows={3}
              placeholder="10: 450"
              value={form.bulkText}
              onChange={(e) => set("bulkText", e.target.value)}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            Active (visible in the store)
          </label>
        </div>

        {formError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{formError}</p>}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete product"
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
          Delete <span className="font-semibold text-slate-800">{deleteTarget?.title}</span>? This cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus-ring placeholder:text-slate-400";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
