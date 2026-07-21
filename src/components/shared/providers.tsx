"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
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
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#18181b",
                color: "#f5f5f0",
                border: "1px solid rgba(255,255,255,0.06)",
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
