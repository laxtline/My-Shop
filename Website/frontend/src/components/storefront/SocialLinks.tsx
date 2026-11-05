import { socialLinks } from '@shared/social';

function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'instagram' && <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" /></>}
    {name === 'facebook' && <path fill="currentColor" stroke="none" d="M14 22v-9h3l.5-4H14V7c0-1 .3-2 2-2h2V1.5A25 25 0 0 0 15 1c-3 0-5 2-5 5v3H7v4h3v9z" />}
    {name === 'youtube' && <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" /></>}
    {name === 'googleMaps' && <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>}
    {name === 'whatsapp' && <><path d="M4 17 2 22l6-2a10 10 0 1 0-4-3Z" /><path d="M8 7c0 5 4 9 8 9l1-3-3-1-1 1-3-3 1-1-1-3Z" /></>}
  </svg>;
}

export function SocialLinks() {
  const links = socialLinks();
  if (!links.length) return null;
  return <nav aria-label="Follow and find us" className="mt-4 flex flex-wrap gap-3">{links.map((link) =>
    <a key={link.key} href={link.href} aria-label={link.label} title={link.label} target="_blank" rel="noopener noreferrer"
      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand focus-ring"><Icon name={link.key} /></a>
  )}</nav>;
}
