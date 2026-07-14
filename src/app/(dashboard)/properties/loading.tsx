export default function PropertiesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 rounded-lg bg-card animate-pulse" />
          <div className="h-4 w-32 rounded-lg bg-card animate-pulse mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-56 rounded-lg bg-card animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-card animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-card animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="aspect-[4/3] bg-card-hover animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-4 w-3/4 rounded bg-card-hover animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-card-hover animate-pulse" />
              <div className="h-5 w-1/3 rounded bg-card-hover animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
