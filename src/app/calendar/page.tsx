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
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-black text-black tracking-tight uppercase">Content Calendar</h1>
        <p className="text-sm font-bold text-gray-700">
          Jadwal tayang konten otomatis di Threads dan platform lainnya.
        </p>
      </div>

      {dateKeys.length === 0 ? (
        <div className="cartoon-card bg-white p-12 text-center">
          <p className="font-bold text-gray-700">Belum ada konten yang terjadwal dalam kalender.</p>
        </div>
      ) : (
        <div className="space-y-10">
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
              <div key={dateStr} className="space-y-4">
                <div className="flex items-center space-x-3 bg-main cartoon-card inline-flex px-4 py-2 transform -rotate-1">
                  <h2 className="text-sm font-black text-black uppercase">{formattedDate}</h2>
                  <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded-full border border-black">
                    {postsOnDate.length} JADWAL
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
                        className="cartoon-card bg-white p-4 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs mb-3">
                            <span className="cartoon-badge bg-amber-200 text-black px-2 py-0.5 text-[11px]">
                              ⏰ {timeStr}
                            </span>
                            <span
                              className={`cartoon-badge px-2 py-0.5 text-[9px] ${
                                post.status === "PUBLISHED"
                                  ? "bg-emerald-300 text-black"
                                  : post.status === "SCHEDULED"
                                  ? "bg-amber-300 text-black"
                                  : "bg-gray-200 text-black"
                              }`}
                            >
                              {post.status}
                            </span>
                          </div>

                          <h3 className="font-black text-black text-sm line-clamp-1">
                            {post.product.name}
                          </h3>

                          <p className="text-xs text-gray-800 font-bold italic line-clamp-3 mt-2 border-l-2 border-main pl-2">
                            &quot;{post.hook}&quot;
                          </p>
                        </div>

                        <div className="pt-3 border-t-2 border-gray-100 flex items-center justify-between text-[10px] font-black text-gray-500 uppercase">
                          <span>{post.angle?.angleType || "General"}</span>
                          <span className="text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded border border-[#111111]">
                            Rp {post.product.price}
                          </span>
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
