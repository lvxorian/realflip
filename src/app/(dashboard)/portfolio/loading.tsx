export default function PortfolioLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-40 rounded-lg bg-card animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
            <div className="h-5 w-3/4 rounded bg-card-hover animate-pulse" />
            <div className="h-8 w-1/2 rounded bg-card-hover animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-card-hover animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-card-hover animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
