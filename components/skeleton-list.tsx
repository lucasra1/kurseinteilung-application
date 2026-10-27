export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <span className="sr-only">Lädt…</span>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-200" />
      <div className="mb-2 h-5 w-72 max-w-full animate-pulse rounded-lg bg-zinc-200/70" />
      {Array.from({ length: rows }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          key={i}
          className="h-28 animate-pulse rounded-2xl bg-zinc-200/60"
        />
      ))}
    </div>
  );
}
