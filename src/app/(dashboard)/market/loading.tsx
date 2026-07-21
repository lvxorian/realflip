export default function MarketLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-40 rounded-lg bg-card animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
            <div className="h-4 w-20 rounded bg-card-hover animate-pulse" />
            <div className="h-7 w-24 rounded bg-card-hover animate-pulse" />
            <div className="h-3 w-16 rounded bg-card-hover animate-pulse" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border/50 bg-card">
        <div className="p-5 space-y-4">
          <div className="h-5 w-36 rounded bg-card-hover animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded bg-card-hover animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
