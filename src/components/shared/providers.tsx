"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { MotionConfig } from "framer-motion";

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
        </MotionConfig>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#12121a",
              color: "#f0f0f5",
              border: "1px solid #2a2a3a",
              borderRadius: "0.75rem",
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  );
}
