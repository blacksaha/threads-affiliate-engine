import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const isAdmin = (session.user as any).role === "ADMIN";

  const logs = await prisma.systemLog.findMany({
    where: isAdmin ? {} : { userId },
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">System Activity Logs</h1>
        <p className="text-sm text-slate-400">
          Laporan aktivitas otomatis, keputusan AI Pipeline, dan pengiriman API Threads.
        </p>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 overflow-hidden">
        {logs.length === 0 ? (
          <p className="text-slate-400 text-center py-12 text-sm">Belum ada aktivitas di sistem.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4 w-48">Timestamp</th>
                  <th className="py-3 px-4 w-24">Level</th>
                  <th className="py-3 px-4 w-40">Source</th>
                  <th className="py-3 px-4">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {new Date(log.createdAt).toLocaleString("id-ID", {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.level === "ERROR"
                            ? "bg-rose-500/20 text-rose-400"
                            : log.level === "WARN"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-indigo-300">{log.source}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      <p>{log.message}</p>
                      {log.details && (
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                          {log.details}
                        </p>
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
