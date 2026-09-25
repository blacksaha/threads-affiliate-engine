import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const scheduledPosts = await prisma.contentPost.findMany({
    where: {
      userId,
      scheduledAt: { not: null },
    },
    include: {
      product: { select: { name: true, price: true } },
      angle: { select: { angleType: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  // Group posts by date string (YYYY-MM-DD)
  const groupedByDate: Record<string, typeof scheduledPosts> = {};
  for (const post of scheduledPosts) {
    if (post.scheduledAt) {
      const dateKey = new Date(post.scheduledAt).toISOString().split("T")[0];
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(post);
    }
  }

  const dateKeys = Object.keys(groupedByDate).sort();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Calendar</h1>
          <p className="text-sm text-slate-400">
            Jadwal tayang konten otomatis di Threads berdasarkan aturan posting.
          </p>
        </div>
      </div>

      {dateKeys.length === 0 ? (
        <div className="bg-slate-950 p-12 rounded-2xl border border-slate-800 text-center">
          <p className="text-slate-400">Belum ada konten yang terjadwal dalam kalender.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {dateKeys.map((dateStr) => {
            const postsOnDate = groupedByDate[dateStr];
            const dateObj = new Date(dateStr);
            const formattedDate = dateObj.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            });

            return (
              <div key={dateStr} className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                  <h2 className="text-base font-bold text-slate-200">{formattedDate}</h2>
                  <span className="text-xs text-slate-500 font-mono">
                    ({postsOnDate.length} Utas Terjadwal)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {postsOnDate.map((post) => {
                    const timeStr = post.scheduledAt
                      ? new Date(post.scheduledAt).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--";

                    return (
                      <div
                        key={post.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-mono font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                              ⏰ {timeStr}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                post.status === "PUBLISHED"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : post.status === "SCHEDULED"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {post.status}
                            </span>
                          </div>

                          <h3 className="font-semibold text-slate-100 text-sm line-clamp-1">
                            {post.product.name}
                          </h3>

                          <p className="text-xs text-slate-400 font-serif italic line-clamp-3 mt-2">
                            &quot;{post.hook}&quot;
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                          <span>Angle: {post.angle?.angleType || "General"}</span>
                          <span className="text-emerald-400">Rp {post.product.price}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
