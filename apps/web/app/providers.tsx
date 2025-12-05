"use client";

import { QueryProvider } from "./providers/query-client";
import * as React from "react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthContextProvider } from "@/providers/authprovider";
import "./global.css";
import dynamic from "next/dynamic";

export interface ProvidersProps {
  children: React.ReactNode;
}

const Loading = () => (
  <div className="flex items-center justify-center h-screen">
    <p>Loading...</p>
  </div>
);

const RequiredAuthProvider = dynamic(
  () => import("@propelauth/react").then((mod) => mod.RequiredAuthProvider),
  {
    ssr: false,
  }
);

export function Providers({ children }: ProvidersProps) {
  return (
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
      <RequiredAuthProvider
          authUrl={process.env.NEXT_PUBLIC_AUTH_URL!}
          displayWhileLoading={<Loading />}
        >
          <AuthContextProvider>
            <QueryProvider>
              <TooltipProvider>
                {process.env.NODE_ENV === "development" &&
                  process.env.NEXT_PUBLIC_DEBUG && <ReactQueryDevtools />}
                {children}
                <Toaster />
                <Sonner />
              </TooltipProvider>
            </QueryProvider>
          </AuthContextProvider>
        </RequiredAuthProvider>
      </ThemeProvider>
  );
}
