// Add any ImageKit custom delivery domains here before using them in admin.
export const IMAGEKIT_CUSTOM_HOSTS: readonly string[] = [];
// Add any Cloudinary custom delivery domains (CNAME) here.
export const CLOUDINARY_CUSTOM_HOSTS: readonly string[] = [];

function isCleanHttps(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
}

export function isImageKitUrl(value: string): boolean {
  const url = isCleanHttps(value);
  if (!url) return false;
  return (
    url.pathname.split('/').filter(Boolean).length >= 2 &&
    (url.hostname === 'ik.imagekit.io' || IMAGEKIT_CUSTOM_HOSTS.includes(url.hostname))
  );
}

/** Cloudinary delivery URL: https://res.cloudinary.com/<cloud>/image/upload/... */
export function isCloudinaryUrl(value: string): boolean {
  const url = isCleanHttps(value);
  if (!url) return false;
  if (url.hostname === 'res.cloudinary.com' || url.hostname.endsWith('.res.cloudinary.com')) {
    return url.pathname.split('/').filter(Boolean).length >= 3;
  }
  return CLOUDINARY_CUSTOM_HOSTS.includes(url.hostname);
}

/** Check if URL is a local upload (pathname starts with /uploads/). */
export function isLocalUploadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.pathname.startsWith('/uploads/');
  } catch {
    return false;
  }
}

/** Any image URL the admin UI should accept: ImageKit, Cloudinary or a local upload. */
export function isSupportedImageUrl(value: string): boolean {
  return isImageKitUrl(value) || isCloudinaryUrl(value) || isLocalUploadUrl(value);
}

/** Valid image URL for products: ImageKit, Cloudinary or a local upload. */
export function isValidProductImageUrl(value: string): boolean {
  return isSupportedImageUrl(value);
}

/**
 * Preserve legacy images; add ImageKit size transforms only to verified
 * ImageKit delivery URLs. Cloudinary URLs are returned untouched because they
 * may already contain transforms or signatures.
 */
export function imageUrl(value: string, width = 400, height?: number): string {
  if (!isImageKitUrl(value)) return value;
  const url = new URL(value);
  // Signed URLs must be generated with their transformations already included.
  if (url.searchParams.has('ik-s')) return value;
  const size = Math.max(16, Math.min(2400, Math.round(width)));
  const transform = `w-${size}${height ? `,h-${Math.max(16, Math.min(2400, Math.round(height)))}` : ''},c-at_max,f-auto,q-80`;
  const existing = url.searchParams.get('tr');
  url.searchParams.set('tr', existing ? `${existing}:${transform}` : transform);
  return url.toString();
}
