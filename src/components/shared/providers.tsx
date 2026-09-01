"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { useState } from "react";
import { ZoomLock } from "@/components/shared/zoom-lock";

export function Providers({ children }: { children: React.ReactNode }) {
  // TODO(tech-debt): QueryClient zatím nikdo nevyužívá (žádný useQuery volání) —
  // buď na react-query migrovat polling (notification-bell, dashboard-layout),
  // nebo provider + závislost odstranit.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <ZoomLock />
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--color-card)",
                color: "var(--color-foreground)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.75rem",
                boxShadow: "0 20px 40px -15px rgba(0,0,0,0.4)",
              },
            }}
          />
        </MotionConfig>
      </QueryClientProvider>
    </SessionProvider>
  );
}
