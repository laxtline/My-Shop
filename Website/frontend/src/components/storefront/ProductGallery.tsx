"use client";

import { useState } from "react";
import type { Product } from "@shared/types";
import { primaryImage } from "@/lib/format";
import { cn } from "@/lib/cn";
import { imageUrl } from '@shared/images';

/** Main image with selectable thumbnails for the product detail page. */
export function ProductGallery({ product }: { product: Product }) {
  const images = product.images?.length ? product.images : [primaryImage(product)];
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(images[active], 960, 960)}
          decoding="async"
          alt={product.title}
          className="aspect-square w-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={cn(
                "h-16 w-16 overflow-hidden rounded-lg border-2 focus-ring",
                i === active ? "border-brand" : "border-transparent hover:border-slate-200"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(src, 128, 128)} loading="lazy" decoding="async" alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
