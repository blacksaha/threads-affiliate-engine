import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Aggregate metrics per user
    const stats = await Promise.all(
      users.map(async (u) => {
        const productCount = await prisma.product.count({ where: { userId: u.id } });
        const postCount = await prisma.contentPost.count({ where: { userId: u.id } });
        const publishedCount = await prisma.contentPost.count({ where: { userId: u.id, status: "PUBLISHED" } });
        const scheduledCount = await prisma.contentPost.count({ where: { userId: u.id, status: "SCHEDULED" } });
        const accountCount = await prisma.socialAccount.count({ where: { userId: u.id } });
        const settings = await prisma.automationSettings.findUnique({ where: { userId: u.id } });

        return {
          ...u,
          stats: {
            products: productCount,
            totalPosts: postCount,
            published: publishedCount,
            scheduled: scheduledCount,
            accounts: accountCount,
            automationEnabled: settings?.enabled ?? false,
          },
        };
      })
    );

    // Global summary
    const summary = {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === "ACTIVE").length,
      inactiveUsers: users.filter((u) => u.status === "INACTIVE").length,
      totalPosts: stats.reduce((acc, s) => acc + s.stats.totalPosts, 0),
      totalPublished: stats.reduce((acc, s) => acc + s.stats.published, 0),
      totalScheduled: stats.reduce((acc, s) => acc + s.stats.scheduled, 0),
    };

    return NextResponse.json({ success: true, summary, users: stats });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
