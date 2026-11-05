import Link from 'next/link';
import type { Category, Paginated } from '@shared/types';
import { imageUrl } from '@shared/images';
import { serverFetchOrNull } from '@/lib/server-api';
import { Pagination } from '@/components/storefront/Pagination';

export const metadata = { title: 'Categories' };
export default async function CategoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const input = await searchParams;
  const params = Object.fromEntries(['q', 'cursor', 'page'].map((key) => [key, typeof input[key] === 'string' ? input[key] as string : '']));
  const data = await serverFetchOrNull<Paginated<Category>>(`/api/categories?${new URLSearchParams({ ...params, limit: '24' })}`);
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Shop by category</h1>
    <form action="/categories" className="flex gap-2"><input aria-label="Search category names" name="q" defaultValue={params.q} placeholder="Search category names…" className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2" /><button className="rounded-lg bg-brand px-4 text-white">Search</button></form>
    {!data ? <p>Categories are temporarily unavailable.</p> : !data.items.length ? <p>No matching categories.</p> : <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{data.items.map((category) => <Link key={category.id} href={`/products?category=${encodeURIComponent(category.slug)}`} className="rounded-xl border border-slate-200 bg-white p-4">
        {category.image && <img src={imageUrl(category.image, 240, 240)} loading="lazy" decoding="async" alt="" className="mb-3 aspect-square w-full rounded-lg object-cover" />}
        <span className="font-semibold">{category.name}</span></Link>)}</div>
      <Pagination basePath="/categories" page={data.page} totalPages={data.totalPages} params={params} nextCursor={data.nextCursor} />
    </>}
  </div>;
}
