"use client";

import { useCallback, useEffect, useState } from "react";
import type { BrandConfig } from "@shared/types";
import { apiFetch } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";

export function BrandManagementPage() {
  return (
    <ProtectedRoute adminOnly>
      <BrandManagement />
    </ProtectedRoute>
  );
}

function BrandManagement() {
  const { toast } = useToast();
  const [brand, setBrand] = useState<BrandConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<BrandConfig>("/api/brand");
      setBrand(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load brand", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!brand) return;

    setSaving(true);
    try {
      const updated = await apiFetch<BrandConfig>("/api/brand", {
        method: "PUT",
        body: JSON.stringify({
          appName: brand.appName,
          tagline: brand.tagline,
          logoUrl: brand.logoUrl,
          supportPhone: brand.supportPhone,
          supportEmail: brand.supportEmail,
          themeColor: brand.themeColor,
        }),
      });
      setBrand(updated);
      toast("Brand settings saved!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save brand", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof BrandConfig, value: string) => {
    setBrand((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!brand) {
    return <div className="text-red-600">Failed to load brand configuration.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Brand Settings</h1>
      <p className="text-slate-600">
        Manage your store's branding. Changes apply site-wide and in the mobile app after refresh.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Logo Preview */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Logo Preview</h2>
          <div className="flex items-center gap-4">
            <img
              src={brand.logoUrl}
              alt={`${brand.appName} logo`}
              className="h-16 w-16 rounded-lg object-contain bg-slate-50"
              style={{ width: 64, height: 64 }}
            />
            <div>
              <p className="font-medium text-slate-900">{brand.appName}</p>
              <p className="text-sm text-slate-500">{brand.tagline}</p>
              <p className="text-xs text-slate-400 mt-1">Current logo: {brand.logoUrl}</p>
            </div>
          </div>
        </div>

        {/* Logo URL */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Logo & Identity</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium text-slate-700 mb-1">
                Logo URL
              </label>
              <Input
                id="logoUrl"
                type="url"
                value={brand.logoUrl}
                onChange={(e) => handleChange("logoUrl", e.target.value)}
                placeholder="/logo.svg or https://example.com/logo.png"
                className="w-full max-w-md"
              />
              <p className="mt-1 text-xs text-slate-500">
                Use a relative path (e.g., <code>/logo.svg</code>) for a file in <code>public/</code>, or an absolute
                URL for an external image. SVG, PNG, WebP supported.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="appName" className="block text-sm font-medium text-slate-700 mb-1">
                  App Name
                </label>
                <Input
                  id="appName"
                  value={brand.appName}
                  onChange={(e) => handleChange("appName", e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label htmlFor="tagline" className="block text-sm font-medium text-slate-700 mb-1">
                  Tagline
                </label>
                <Input
                  id="tagline"
                  value={brand.tagline}
                  onChange={(e) => handleChange("tagline", e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="themeColor" className="block text-sm font-medium text-slate-700 mb-1">
                  Theme Color (Hex)
                </label>
                <Input
                  id="themeColor"
                  type="color"
                  value={brand.themeColor}
                  onChange={(e) => handleChange("themeColor", e.target.value)}
                  className="w-full max-w-xs h-10 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Support Info */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Support Contact</h2>
          <p className="text-sm text-slate-500 mb-4">
            Displayed in footer, invoices, and login screen.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="supportPhone" className="block text-sm font-medium text-slate-700 mb-1">
                Support Phone
              </label>
              <Input
                id="supportPhone"
                type="tel"
                value={brand.supportPhone}
                onChange={(e) => handleChange("supportPhone", e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="supportEmail" className="block text-sm font-medium text-slate-700 mb-1">
                Support Email
              </label>
              <Input
                id="supportEmail"
                type="email"
                value={brand.supportEmail}
                onChange={(e) => handleChange("supportEmail", e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? <Spinner className="h-4 w-4" /> : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}