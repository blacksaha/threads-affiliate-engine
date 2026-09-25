"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function SidebarNav() {
  const { data: session } = useSession();

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div className="p-6 border-b border-slate-800/80">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              THREADS ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">
            Autonomous System
          </p>
        </div>
        <nav className="p-4 space-y-1.5 text-sm font-medium">
          <Link
            href="/"
            className="flex items-center px-4 py-2.5 rounded-lg text-slate-300 hover:bg-slate-900 transition"
          >
            Dashboard
          </Link>
          <Link
            href="/products"
            className="flex items-center px-4 py-2.5 rounded-lg text-slate-300 hover:bg-slate-900 transition"
          >
            Database Produk
          </Link>
          <Link
            href="/queue"
            className="flex items-center px-4 py-2.5 rounded-lg text-slate-300 hover:bg-slate-900 transition"
          >
            Content Queue
          </Link>
          <Link
            href="/calendar"
            className="flex items-center px-4 py-2.5 rounded-lg text-slate-300 hover:bg-slate-900 transition"
          >
            Content Calendar
          </Link>
          <Link
            href="/analytics"
            className="flex items-center px-4 py-2.5 rounded-lg text-slate-300 hover:bg-slate-900 transition"
          >
            Analytics & AI Loop
          </Link>
          <Link
            href="/logs"
            className="flex items-center px-4 py-2.5 rounded-lg text-slate-300 hover:bg-slate-900 transition"
          >
            Activity Logs
          </Link>
          <Link
            href="/settings"
            className="flex items-center px-4 py-2.5 rounded-lg text-slate-300 hover:bg-slate-900 transition"
          >
            Automation Settings
          </Link>

          {(session?.user as any)?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="flex items-center px-4 py-2.5 rounded-lg text-amber-300 hover:bg-amber-950/30 transition mt-4 border border-amber-900/30"
            >
              🛡️ Admin Console
            </Link>
          )}
        </nav>
      </div>

      {session && (
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-bold text-white truncate">{session.user?.name || "User"}</p>
              <p className="text-[10px] text-slate-400 truncate">{session.user?.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold rounded border border-rose-500/20 transition shrink-0"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}