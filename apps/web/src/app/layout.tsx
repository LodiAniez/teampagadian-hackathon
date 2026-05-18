import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import { AuthProvider } from "@/features/auth/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raket — Get paid for every gig, from anywhere in the world",
  description:
    "Cross-border payment platform for Filipino freelancers. Get paid in minutes, not days, with transparent FX, AI-powered invoicing, and BIR-ready tax summaries.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <AuthProvider>{children}</AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
