"use client";
import { useEffect, useState } from 'react';
import { imageUrl, isImageKitUrl } from '@shared/images';

export function ImageKitPreview({ url, existing = false }: { url: string; existing?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url.trim()) return null;
  if (!isImageKitUrl(url) && !existing) return <p role="alert" className="text-xs text-red-600">Enter an HTTPS ImageKit delivery URL, such as https://ik.imagekit.io/your-id/image.jpg.</p>;
  return <div className="space-y-1">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={imageUrl(url, 160, 160)} loading="lazy" decoding="async" alt="Image preview" onError={() => setFailed(true)}
      className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
    {failed && <p role="alert" className="max-w-52 text-xs text-red-600">Image could not load. Check the URL and image permissions.</p>}
  </div>;
}
