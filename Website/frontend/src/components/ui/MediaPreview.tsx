"use client";
import { useEffect, useState } from 'react';
import { imageUrl, isSupportedImageUrl } from '@shared/images';

export function MediaPreview({ url, existing = false }: { url: string; existing?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url.trim()) return null;
  if (!isSupportedImageUrl(url) && !existing) return <p role="alert" className="text-xs text-red-600">Enter an HTTPS ImageKit or Cloudinary URL, such as https://ik.imagekit.io/your-id/image.jpg or https://res.cloudinary.com/your-cloud/image/upload/sample.jpg.</p>;
  return <div className="space-y-1">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={imageUrl(url, 160, 160)} loading="lazy" decoding="async" alt="Image preview" onError={() => setFailed(true)}
      className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
    {failed && <p role="alert" className="max-w-52 text-xs text-red-600">Image could not load. Check the URL and image permissions.</p>}
  </div>;
}
