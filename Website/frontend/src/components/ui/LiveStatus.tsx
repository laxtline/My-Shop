export function LiveStatus({ connected }: { connected: boolean }) {
  return <span role="status" className={`text-xs ${connected ? 'text-emerald-700' : 'text-amber-700'}`}>
    {connected ? '● Live updates connected' : '○ Connecting to live updates…'}
  </span>;
}
