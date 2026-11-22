import { useEffect, useState } from "react";
import type { BrandConfig } from "@shared/types";
import { apiFetch } from "@/lib/api";
import { DEFAULT_BRAND } from "@shared/constants";

// Fetch brand config from API, fallback to default
export function useBrand() {
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await apiFetch<BrandConfig>("/api/brand");
        // console.log('[useBrand] loaded:', data.appName);
        if (mounted) setBrand(data);
      } catch {
        // fallback to default
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return { brand, loading };
}