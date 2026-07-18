"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/** Route-level error boundary. Shown when a page throws during render/data fetch. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid place-items-center py-24 text-center">
      <p className="text-6xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        We hit an unexpected error. Please try again — if it keeps happening, check that the backend API is
        running.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <a href="/">
          <Button variant="outline">Back to home</Button>
        </a>
      </div>
    </div>
  );
}
