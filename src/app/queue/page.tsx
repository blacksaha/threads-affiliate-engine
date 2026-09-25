import { prisma } from "@/lib/prisma";
import QueueClientView from "./QueueClientView";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const posts = await prisma.contentPost.findMany({
    where: { userId },
    include: {
      product: { select: { name: true, price: true } },
      angle: { select: { angleType: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Queue</h1>
          <p className="text-sm text-slate-400">
            Daftar konten yang telah digenerate AI. Semua dijadwalkan secara otomatis.
          </p>
        </div>
      </div>

      <QueueClientView initialPosts={posts} />
    </div>
  );
}
