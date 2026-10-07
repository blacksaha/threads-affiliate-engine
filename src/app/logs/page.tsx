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
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-black text-black tracking-tight uppercase">System Logs</h1>
        <p className="text-sm font-bold text-gray-700">
          Laporan aktivitas otomatis, keputusan AI Pipeline, dan pengiriman API.
        </p>
      </div>

      <div className="cartoon-card bg-white overflow-hidden">
        {logs.length === 0 ? (
          <p className="font-bold text-gray-500 text-center py-12 text-sm">Belum ada aktivitas di sistem.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-100 text-[10px] font-black uppercase text-black">
                <tr>
                  <th className="px-4 py-3 border-2 border-[#111111] w-48">WAKTU</th>
                  <th className="px-4 py-3 border-2 border-[#111111] w-24">LEVEL</th>
                  <th className="px-4 py-3 border-2 border-[#111111] w-36">SUMBER</th>
                  <th className="px-4 py-3 border-2 border-[#111111]">PESAN</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-amber-50 transition">
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-600">
                      {new Date(log.createdAt).toLocaleString("id-ID", {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`cartoon-badge px-2 py-0.5 text-[9px] ${
                          log.level === "ERROR"
                            ? "bg-rose-300 text-rose-950"
                            : log.level === "WARN"
                            ? "bg-amber-300 text-amber-950"
                            : "bg-blue-200 text-blue-950"
                        }`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black text-black">
                      {log.source}
                    </td>
                    <td className="px-4 py-3 text-black font-bold">
                      <p>{log.message}</p>
                      {log.details && (
                        <p className="text-[10px] text-gray-500 font-mono mt-0.5 line-clamp-1">
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
