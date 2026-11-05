import { Button } from './Button';

export function CursorPager({ page, total, nextCursor, onNext, onPrevious, disabled = false }: {
  page: number; total?: number; nextCursor?: string | null;
  onNext: (cursor: string) => void; onPrevious: () => void; disabled?: boolean;
}) {
  return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-slate-600">
    <Button type="button" size="sm" variant="outline" disabled={disabled || page <= 1} onClick={onPrevious}>Previous</Button>
    <span>Page {page}{total !== undefined ? ` · ${total.toLocaleString('en-IN')} results` : ''}</span>
    <Button type="button" size="sm" variant="outline" disabled={disabled || !nextCursor} onClick={() => nextCursor && onNext(nextCursor)}>Next</Button>
  </nav>;
}
