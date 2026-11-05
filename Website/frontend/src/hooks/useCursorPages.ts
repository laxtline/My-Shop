"use client";
import { useState } from 'react';

export function useCursorPages(key: string) {
  const [state, setState] = useState({ key, cursors: [''] });
  const cursors = state.key === key ? state.cursors : [''];
  return {
    cursor: cursors.at(-1)!, page: cursors.length,
    next: (cursor: string) => setState({ key, cursors: [...cursors, cursor] }),
    previous: () => setState({ key, cursors: cursors.slice(0, -1).length ? cursors.slice(0, -1) : [''] }),
    reset: () => setState({ key, cursors: [''] }),
  };
}
