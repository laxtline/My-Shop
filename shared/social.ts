// Fill these once: the website footer and mobile app share this configuration.
export const SOCIAL_URLS = {
  instagram: 'https://www.instagram.com/rama_chandra_traders/',
  facebook: 'https://www.facebook.com/share/1DxynSHbdw/?mibextid=wwXIfr',
  youtube: 'https://www.youtube.com/@ramachandratraders',
  googleMaps: 'https://maps.app.goo.gl/tRtVDFYnXvRVNgyK6',
  whatsapp: 'https://api.whatsapp.com/send/?phone=916370419708&text&type=phone_number&app_absent=0',
} as const;

export const SOCIAL_LABELS = {
  instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube',
  googleMaps: 'Google Maps', whatsapp: 'WhatsApp',
} as const;

export function socialLinks() {
  return (Object.keys(SOCIAL_URLS) as (keyof typeof SOCIAL_URLS)[]).flatMap((key) => {
    const href: string = SOCIAL_URLS[key];
    try {
      const url = new URL(href);
      return url.protocol === 'https:' && !url.username && !url.password
        ? [{ key, href, label: SOCIAL_LABELS[key] }] : [];
    } catch { return []; }
  });
}
