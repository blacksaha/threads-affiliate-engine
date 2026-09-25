import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

import AutomationStatusBadge from "@/components/AutomationStatusBadge";
import { prisma } from "@/lib/prisma";
import AuthProvider from "@/components/AuthProvider";
import SidebarNav from "@/components/SidebarNav";
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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const userId = session?.user?.id;
  const settings = userId
    ? await prisma.automationSettings.findUnique({ where: { userId } })
    : null;
  const isEnabled = settings ? settings.enabled : false;

  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex bg-slate-900 text-slate-100 font-sans">
        <AuthProvider>
          {/* Sidebar Nav */}
          <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between shrink-0">
            <SidebarNav />
            <AutomationStatusBadge initialEnabled={isEnabled} />
          </aside>

          {/* Main Workspace */}
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-900">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
