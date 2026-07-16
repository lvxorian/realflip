"use client";

export default function PropertiesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="h-12 w-12 rounded-2xl bg-red-500/20 flex items-center justify-center">
        <span className="text-red-400 text-xl font-bold">!</span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">Chyba při načítání</h2>
      <p className="text-sm text-muted text-center max-w-md">
        Nepodařilo se načíst seznam nemovitostí. Zkuste to prosím znovu.
      </p>
      <details className="text-xs text-red-400/80 bg-red-500/5 rounded-xl p-3 max-w-md w-full">
        <summary className="cursor-pointer font-medium">Technický detail</summary>
        <pre className="mt-2 whitespace-pre-wrap break-all">{error.message}</pre>
        {error.digest && <p className="mt-2 text-muted">Digest: {error.digest}</p>}
      </details>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
      >
        Zkusit znovu
      </button>
    </div>
  );
}
