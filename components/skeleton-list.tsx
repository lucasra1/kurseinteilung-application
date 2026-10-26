export function SkeletonList({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
