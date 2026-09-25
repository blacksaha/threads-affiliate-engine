import ProductIngestForm from "@/components/ProductIngestForm";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

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
    take: 8,
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header & Status Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                settings?.enabled !== false
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}
            >
              <span className={`w-2 h-2 rounded-full mr-2 ${settings?.enabled !== false ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}></span>
              {settings?.enabled !== false ? "AUTOMATION ACTIVE" : "AUTOMATION PAUSED"}
            </span>
            <span className="text-xs text-slate-500 font-mono">CRON: ACTIVE (Every 10m)</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-2">Executive Control Dashboard</h1>
          <p className="text-sm text-slate-400">
            Autonomous Pipeline: Product Analysis → Angle Generation → AI Creation → Anti-Repetition → Auto-Schedule.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <form action="/api/cron/scheduler" method="GET" target="_blank">
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
            >
              Trigger Cron Scheduler
            </button>
          </form>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Products</p>
          <p className="text-3xl font-extrabold text-white mt-2">{productCount}</p>
        </div>
        <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Generated Content</p>
          <p className="text-3xl font-extrabold text-indigo-400 mt-2">{totalPosts}</p>
        </div>
        <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">In Queue / Scheduled</p>
          <p className="text-3xl font-extrabold text-amber-400 mt-2">{scheduledCount}</p>
        </div>
        <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Published</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">{publishedCount}</p>
        </div>
        <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Next Scheduled</p>
          <p className="text-sm font-bold text-slate-200 mt-3 truncate">
            {nextPost?.scheduledAt ? new Date(nextPost.scheduledAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "None"}
          </p>
          <p className="text-xs text-slate-400">
            {nextPost?.scheduledAt ? new Date(nextPost.scheduledAt).toLocaleDateString("id-ID") : "Waiting for items"}
          </p>
        </div>
      </div>

      {/* Two Column Layout: Quick Auto-Runner & Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Instant Product Ingest & Auto-Pipeline */}
        <div className="lg:col-span-1 bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-lg font-bold text-white">Input Produk & Auto-Run</h2>
          <p className="text-xs text-slate-400">
            Cukup masukkan link Shopee, klik <strong>Tarik Data</strong> untuk auto-scrape nama & gambar, lalu tekan tombol untuk menjalankan pipeline otomatis.
          </p>

          <ProductIngestForm />
        </div>

        {/* Right: Live Queue & Activity Logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Queue Items */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-lg font-bold text-white mb-4">Live Content Queue</h2>
            {recentPosts.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada konten di antrean.</p>
            ) : (
              <div className="space-y-3">
                {recentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            post.status === "PUBLISHED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : post.status === "SCHEDULED"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {post.status}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">{post.product.name}</span>
                      </div>
                      <p className="text-sm text-slate-200 line-clamp-2 italic font-serif">
                        &quot;{post.hook}&quot;
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">
                        {post.scheduledAt
                          ? new Date(post.scheduledAt).toLocaleString("id-ID", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </p>
                      <p className="text-[10px] text-slate-400">Score: {post.qualityScore ?? 0.85}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Logs */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-lg font-bold text-white mb-4">Autonomous System Activity Logs</h2>
            <div className="space-y-2 text-xs font-mono">
              {recentLogs.length === 0 ? (
                <p className="text-slate-500">Belum ada log aktivitas.</p>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-3 text-slate-400 border-b border-slate-900 py-1.5">
                    <span className="text-slate-600 shrink-0">
                      {new Date(log.createdAt).toLocaleTimeString("id-ID")}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${log.level === "ERROR" ? "bg-rose-950 text-rose-400" : "bg-slate-800 text-slate-300"}`}>
                      {log.source}
                    </span>
                    <span className="text-slate-300">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
