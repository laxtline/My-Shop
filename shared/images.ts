// Add any ImageKit custom delivery domains here before using them in admin.
export const IMAGEKIT_CUSTOM_HOSTS: readonly string[] = [];

export function isImageKitUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.port && url.pathname.split('/').filter(Boolean).length >= 2 &&
      (url.hostname === 'ik.imagekit.io' || IMAGEKIT_CUSTOM_HOSTS.includes(url.hostname));
  } catch {
    return false;
  }
}

/** Preserve legacy images; transform only verified ImageKit delivery URLs. */
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
