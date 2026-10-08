import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import AutomationStatusBadge from "@/components/AutomationStatusBadge";
import { prisma } from "@/lib/prisma";
import AuthProvider from "@/components/AuthProvider";
import SidebarNav from "@/components/SidebarNav";
import { PWAProvider } from "@/components/PWAProvider";
import { ModalProvider } from "@/components/ui/ModalProvider";
import { auth } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "THREADS AFFILIATE CONTENT ENGINE",
  description: "Hands-off fully automated affiliate content engine for Threads",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ThreadsEngine",
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  themeColor: "#ffb347",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col bg-bg text-black font-sans">
          <AuthProvider>
            <PWAProvider />
            {children}
          </AuthProvider>
        </body>
      </html>
    );
  }

  const settings = userId
    ? await prisma.automationSettings.findUnique({ where: { userId } })
    : null;
  const isEnabled = settings ? settings.enabled : false;

  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col md:flex-row bg-bg text-black font-sans overflow-x-hidden">
        <AuthProvider>
          <PWAProvider />
          <ModalProvider>
            {/* Responsive Sidebar & Mobile Nav */}
            <div className="shrink-0 flex flex-col">
              <SidebarNav />
              <div className="hidden md:block">
                <AutomationStatusBadge initialEnabled={isEnabled} />
              </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 min-h-screen overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </ModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
