import ProductIngestForm from "@/components/ProductIngestForm";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, History, Bot, PackageSearch, Megaphone, Send, Zap, Activity, ListTodo } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  // 1. Fetch live metrics (scoped to current user)
  const productCount = await prisma.product.count({ where: { userId } });
  const totalPosts = await prisma.contentPost.count({ where: { userId } });
  const scheduledCount = await prisma.contentPost.count({ where: { userId, status: "SCHEDULED" } });
  const publishedCount = await prisma.contentPost.count({ where: { userId, status: "PUBLISHED" } });
  const failedCount = await prisma.contentPost.count({ where: { userId, status: "FAILED" } });

  const nextPost = await prisma.contentPost.findFirst({
    where: { userId, status: "SCHEDULED", scheduledAt: { not: null } },
    orderBy: { scheduledAt: "asc" },
  });

  const recentLogs = await prisma.systemLog.findMany({
    where: { userId },
    take: 6,
    orderBy: { createdAt: "desc" },
  });

  const recentPosts = await prisma.contentPost.findMany({
    where: { userId },
    take: 5,
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });

  const settings = await prisma.automationSettings.findUnique({
    where: { userId },
  });
  const timezone = settings?.timezone || "Asia/Makassar";

  return (
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="cartoon-card bg-amber-300 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transform -rotate-1 hover:rotate-0">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="cartoon-badge px-3 py-1 bg-white text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse border border-black"></span>
              BOT AKTIF
            </span>
            <span className="cartoon-badge px-3 py-1 bg-[#111111] text-white text-xs">
              CRON: 10m
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-black uppercase tracking-tight">Executive Dashboard</h1>
          <p className="text-sm font-bold text-gray-800">
            Pipeline Otomatis: Bedah Produk → Cari Angle → Tulis AI → Jadwal Tayang.
          </p>
        </div>

        <form action="/api/cron/scheduler" method="GET" target="_blank" className="shrink-0">
          <button
            type="submit"
            className="cartoon-btn px-5 py-3 bg-white text-black hover:bg-gray-100 flex items-center gap-2 text-sm"
          >
            <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
            PAKSA JALANKAN CRON
          </button>
        </form>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="cartoon-card bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2 text-blue-500">
            <PackageSearch className="w-5 h-5 stroke-[2.5]" />
            <p className="text-xs font-black text-black">PRODUK</p>
          </div>
          <p className="text-4xl font-black text-black">{productCount}</p>
        </div>
        <div className="cartoon-card bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2 text-purple-500">
            <Bot className="w-5 h-5 stroke-[2.5]" />
            <p className="text-xs font-black text-black">DRAFT AI</p>
          </div>
          <p className="text-4xl font-black text-black">{totalPosts}</p>
        </div>
        <div className="cartoon-card bg-amber-100 p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2 text-amber-600">
            <History className="w-5 h-5 stroke-[2.5]" />
            <p className="text-xs font-black text-black">ANTREAN</p>
          </div>
          <p className="text-4xl font-black text-black">{scheduledCount}</p>
        </div>
        <div className="cartoon-card bg-emerald-100 p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2 text-emerald-600">
            <Send className="w-5 h-5 stroke-[2.5]" />
            <p className="text-xs font-black text-black">TERPUBLIKASI</p>
          </div>
          <p className="text-4xl font-black text-black">{publishedCount}</p>
        </div>
        <div className="cartoon-card bg-rose-100 p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2 text-rose-600">
            <Megaphone className="w-5 h-5 stroke-[2.5]" />
            <p className="text-xs font-black text-black">JADWAL NEXT</p>
          </div>
          <div>
            <p className="text-3xl font-black text-black">
              {nextPost?.scheduledAt ? new Date(nextPost.scheduledAt).toLocaleTimeString("id-ID", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }) : "KOSONG"}
            </p>
            <p className="text-xs font-bold text-gray-700">
              {nextPost?.scheduledAt ? new Date(nextPost.scheduledAt).toLocaleDateString("id-ID", { timeZone: timezone }) : "Menunggu produk"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Instant Product Ingest */}
        <div className="lg:col-span-1 space-y-6">
          <div className="cartoon-card bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 border-b-3 border-[#111111] pb-3">
              <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500" />
              <h2 className="text-lg font-black text-black uppercase">Auto-Run Produk</h2>
            </div>
            <p className="text-xs font-bold text-gray-600">
              Masukkan link Shopee, klik tarik data, lalu jalankan AI.
            </p>
            <ProductIngestForm />
          </div>

          {/* Activity Logs */}
          <div className="cartoon-card bg-white p-5">
             <div className="flex items-center gap-2 border-b-3 border-[#111111] pb-3 mb-4">
              <Activity className="w-5 h-5 text-blue-500" strokeWidth={3} />
              <h2 className="text-lg font-black text-black uppercase">System Logs</h2>
            </div>
            <div className="space-y-3">
              {recentLogs.length === 0 ? (
                <p className="text-xs font-bold text-gray-500">Belum ada log aktivitas.</p>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="text-xs font-bold border-b-2 border-gray-100 pb-2 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 border border-gray-400">
                        {new Date(log.createdAt).toLocaleTimeString("id-ID", { timeZone: timezone })}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                        log.level === "ERROR" ? "bg-rose-100 text-rose-700 border-rose-300" : "bg-blue-100 text-blue-700 border-blue-300"
                      }`}>
                        {log.source}
                      </span>
                    </div>
                    <p className="text-black line-clamp-2">{log.message}</p>
                  </div>
                ))
              )}
            </div>
            <Link href="/logs" className="block text-center mt-4 text-xs font-black text-main hover:underline">
              LIHAT SEMUA LOGS →
            </Link>
          </div>
        </div>

        {/* Right: Live Queue */}
        <div className="lg:col-span-2">
          <div className="cartoon-card bg-white p-5 h-full">
            <div className="flex items-center justify-between border-b-3 border-[#111111] pb-3 mb-5">
              <div className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-emerald-500" strokeWidth={3} />
                <h2 className="text-lg font-black text-black uppercase">Live Content Queue</h2>
              </div>
              <Link href="/queue" className="text-xs font-black text-main hover:underline">
                LIHAT ANTREAN →
              </Link>
            </div>
            
            {recentPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-50">
                <Bot className="w-16 h-16 mb-2" />
                <p className="text-sm font-bold">Belum ada konten di antrean.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="cartoon-card border-2 bg-bg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black px-2 py-1 rounded border-2 border-[#111111] ${
                            post.status === "PUBLISHED"
                              ? "bg-emerald-300 text-black"
                              : post.status === "SCHEDULED"
                              ? "bg-amber-300 text-black"
                              : "bg-rose-300 text-black"
                          }`}
                        >
                          {post.status}
                        </span>
                        <span className="text-xs font-black text-gray-800 line-clamp-1">{post.product.name}</span>
                      </div>
                      <p className="text-sm text-black font-bold italic line-clamp-2">
                        &quot;{post.hook}&quot;
                      </p>
                    </div>

                    <div className="shrink-0 text-left sm:text-right bg-white p-2 rounded-lg border-2 border-[#111111]">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Jadwal Tayang</p>
                      <p className="text-xs font-black text-black">
                        {post.scheduledAt
                          ? new Date(post.scheduledAt).toLocaleString("id-ID", {
                              timeZone: timezone,
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
