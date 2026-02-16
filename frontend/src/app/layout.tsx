import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardPreferencesProvider } from "@/lib/dashboard-preferences";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Review Analytics Dashboard",
  description: "Multi-modal tool suite for analyzing Google Play app reviews",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DashboardPreferencesProvider>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar />
              <main className="flex flex-1 flex-col">
                <Suspense fallback={null}>
                  <Header />
                </Suspense>
                <div className="flex-1 overflow-auto">
                  <Suspense fallback={null}>{children}</Suspense>
                </div>
              </main>
            </SidebarProvider>
          </TooltipProvider>
        </DashboardPreferencesProvider>
      </body>
    </html>
  );
}
