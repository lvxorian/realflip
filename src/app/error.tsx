"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-red-400">Došlo k chybě</h1>
          <p className="text-muted text-sm">
            Aplikace narazila na neočekávanou chybu. Zkuste stránku obnovit.
          </p>
          {error.digest && (
            <p className="text-xs text-muted/50">Digest: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-foreground text-background px-4 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Zkusit znovu
          </button>
        </div>
      </body>
    </html>
  );
}
