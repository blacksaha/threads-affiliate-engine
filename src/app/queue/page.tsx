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
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-black text-black tracking-tight uppercase">Content Queue</h1>
        <p className="text-sm font-bold text-gray-700">
          Daftar antrean postingan otomatis ke Threads, X, dan Facebook Page.
        </p>
      </div>

      <QueueClientView initialPosts={posts} />
    </div>
  );
}
