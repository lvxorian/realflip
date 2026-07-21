export default function PortfolioDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-24 rounded-lg bg-card animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
            <div className="h-6 w-3/4 rounded bg-card-hover animate-pulse" />
            <div className="h-10 w-1/3 rounded bg-card-hover animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-card-hover animate-pulse" />
              <div className="h-3 w-5/6 rounded bg-card-hover animate-pulse" />
            </div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
            <div className="h-5 w-32 rounded bg-card-hover animate-pulse" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-full rounded bg-card-hover animate-pulse" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
            <div className="h-5 w-28 rounded bg-card-hover animate-pulse" />
            <div className="h-20 w-full rounded bg-card-hover animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
