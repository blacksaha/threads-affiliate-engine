import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const publishedPosts = await prisma.contentPost.findMany({
    where: { userId, status: "PUBLISHED" },
    include: {
      product: true,
      angle: true,
      analytics: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  const totalPosts = publishedPosts.length;
  const totalViews = publishedPosts.reduce((acc, p) => acc + (p.analytics?.views ?? 0), 0);
  const totalLikes = publishedPosts.reduce((acc, p) => acc + (p.analytics?.likes ?? 0), 0);
  const totalReplies = publishedPosts.reduce((acc, p) => acc + (p.analytics?.replies ?? 0), 0);
  
  const avgEngagement = totalViews > 0 
    ? (((totalLikes + totalReplies) / totalViews) * 100).toFixed(2)
    : "0.00";

  const topPerformers = publishedPosts.filter((p) => p.analytics?.isTopPerformer);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Performance & AI Analytics</h1>
          <p className="text-sm text-slate-400">
            Metrik performa Threads & Feedback Loop untuk optimasi konten AI berikutnya.
          </p>
        </div>

        <form action="/api/cron/analytics" method="GET" target="_blank">
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/30 transition cursor-pointer"
          >
            ⚡ Sync Performance Data
          </button>
        </form>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Published</p>
          <p className="text-3xl font-extrabold text-white mt-2">{totalPosts}</p>
        </div>
        <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Views (Estimated)</p>
          <p className="text-3xl font-extrabold text-indigo-400 mt-2">{totalViews.toLocaleString("id-ID")}</p>
        </div>
        <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Engagements</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">{(totalLikes + totalReplies).toLocaleString("id-ID")}</p>
        </div>
        <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Avg Engagement Rate</p>
          <p className="text-3xl font-extrabold text-amber-400 mt-2">{avgEngagement}%</p>
        </div>
      </div>

      {/* AI Learning Feedback Loop Banner */}
      <div className="bg-gradient-to-r from-indigo-950/80 via-purple-950/50 to-slate-950 border border-indigo-500/30 rounded-2xl p-6">
        <div className="flex items-start space-x-3">
          <span className="text-2xl">🧠</span>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-indigo-200">
              Autonomous AI Optimization Active (Feedback Loop)
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sistem secara otomatis mempelajari pola kalimat, gaya *hook*, dan sudut pandang (*angle*) dari konten yang mendapatkan interaksi tertinggi ({topPerformers.length} konten unggulan terdeteksi). Hasil analisis ini disuntikkan sebagai pedoman saat AI memproduksi naskah baru.
            </p>
          </div>
        </div>
      </div>

      {/* Published Posts Performance Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Performance Log</h2>

        {publishedPosts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Belum ada postingan yang berstatus PUBLISHED. Setelah scheduler mempublish konten, data performa akan muncul di sini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Produk & Hook</th>
                  <th className="py-3 px-4">Angle</th>
                  <th className="py-3 px-4 text-center">Views</th>
                  <th className="py-3 px-4 text-center">Likes</th>
                  <th className="py-3 px-4 text-center">Replies</th>
                  <th className="py-3 px-4 text-center">Engage Rate</th>
                  <th className="py-3 px-4 text-center">AI Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {publishedPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-semibold text-white truncate">{post.product.name}</p>
                      <p className="text-slate-400 italic line-clamp-1 mt-0.5">&quot;{post.hook}&quot;</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                        {post.angle?.angleType || "General"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      {post.analytics?.views?.toLocaleString("id-ID") ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-emerald-400">
                      {post.analytics?.likes ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-indigo-400">
                      {post.analytics?.replies ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-400">
                      {post.analytics?.engagementRate?.toFixed(2) ?? "0.00"}%
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {post.analytics?.isTopPerformer ? (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          ⭐ Top Performer
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Standard</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
