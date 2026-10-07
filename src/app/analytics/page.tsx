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
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-black text-black tracking-tight uppercase">Performance & AI Loop</h1>
        <p className="text-sm font-bold text-gray-700">
          Metrik performa Threads & Feedback Loop untuk optimasi konten AI.
        </p>
      </div>

      {/* Sync Button */}
      <form action="/api/cron/analytics" method="GET" target="_blank" className="shrink-0">
        <button
          type="submit"
          className="cartoon-btn px-4 py-2 bg-[#111111] hover:bg-black text-white text-xs font-black flex items-center gap-2"
        >
          ⚡ SYNC DATA PERFORMA
        </button>
      </form>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="cartoon-card bg-white p-4">
          <p className="text-xs font-black text-gray-500 uppercase mb-2">Total Published</p>
          <p className="text-3xl font-black text-black">{totalPosts}</p>
        </div>
        <div className="cartoon-card bg-white p-4">
          <p className="text-xs font-black text-gray-500 uppercase mb-2">Total Views</p>
          <p className="text-3xl font-black text-blue-600">{totalViews.toLocaleString("id-ID")}</p>
        </div>
        <div className="cartoon-card bg-white p-4">
          <p className="text-xs font-black text-gray-500 uppercase mb-2">Total Engage</p>
          <p className="text-3xl font-black text-emerald-600">{(totalLikes + totalReplies).toLocaleString("id-ID")}</p>
        </div>
        <div className="cartoon-card bg-white p-4">
          <p className="text-xs font-black text-gray-500 uppercase mb-2">Avg Engagement</p>
          <p className="text-3xl font-black text-amber-600">{avgEngagement}%</p>
        </div>
      </div>

      {/* AI Learning Banner */}
      <div className="cartoon-card bg-gradient-to-r from-indigo-100 to-purple-100 p-6 flex items-start gap-4 transform -rotate-1">
        <span className="text-3xl shrink-0">🧠</span>
        <div>
          <h2 className="text-sm font-black text-indigo-900 uppercase mb-1">AI Autonomous Optimization Active!</h2>
          <p className="text-xs font-bold text-gray-800 leading-relaxed">
            Sistem mempelajari pola hook dan angle dari {topPerformers.length} top performer. Hasil analisis disuntikkan langsung ke AI generator berikutnya! 🎯
          </p>
        </div>
      </div>

      {/* Performance Table */}
      <div className="cartoon-card bg-white overflow-hidden">
        <div className="px-5 py-4 border-b-2 border-[#111111]">
          <h2 className="text-lg font-black text-black uppercase">Performance Log</h2>
        </div>

        {publishedPosts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-gray-600">Belum ada data performa. Tunggu sampai scheduler mempublish postingan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-100 text-[10px] font-black uppercase text-black sticky top-0">
                <tr>
                  <th className="px-4 py-3 border-2 border-[#111111]">Produk & Hook</th>
                  <th className="px-4 py-3 border-2 border-[#111111]">Angle</th>
                  <th className="px-4 py-3 border-2 border-[#111111] text-center">Views</th>
                  <th className="px-4 py-3 border-2 border-[#111111] text-center">Likes</th>
                  <th className="px-4 py-3 border-2 border-[#111111] text-center">Engage Rate</th>
                  <th className="px-4 py-3 border-2 border-[#111111] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-200">
                {publishedPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-amber-50 transition">
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="font-black text-black truncate">{post.product.name}</p>
                      <p className="text-gray-600 italic line-clamp-1 mt-0.5">"{post.hook}"</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="cartoon-badge bg-white text-black px-2 py-0.5 text-[10px]">
                        {post.angle?.angleType || "General"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold">
                      {post.analytics?.views?.toLocaleString("id-ID") ?? 0}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-600">
                      {post.analytics?.likes ?? 0}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-black text-amber-600">
                      {(post.analytics?.engagementRate ?? 0).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {post.analytics?.isTopPerformer ? (
                        <span className="cartoon-badge bg-amber-300 text-black text-[9px] px-2 py-0.5">
                          ⭐ TOP PERFORMER
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400">Standard</span>
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
