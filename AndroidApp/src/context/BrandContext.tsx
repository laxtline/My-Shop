import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useBrand } from "@/hooks/useBrand";
import type { BrandConfig } from "@shared/types";
import { DEFAULT_BRAND } from "@shared/constants";

interface BrandContextType {
  brand: BrandConfig;
  loading: boolean;
}

const BrandContext = createContext<BrandContextType | null>(null);

export function BrandProvider({ children }: { children: ReactNode }) {
  const { brand, loading } = useBrand();

  return (
    <BrandContext.Provider value={{ brand, loading }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrandContext() {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error("useBrandContext must be used within a BrandProvider");
  }
  return ctx;
}

/**
 * Hook that returns the brand config, waiting for loading to complete.
 * Returns DEFAULT_BRAND while loading.
 */
export function useBrandReady(): BrandConfig {
  const { brand, loading } = useBrandContext();
  return loading ? DEFAULT_BRAND : brand;
}