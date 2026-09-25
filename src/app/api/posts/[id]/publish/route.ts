import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishToAllPlatforms } from '@/lib/publisher';
import { auth } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  try {
    const { id } = await params;
    const post = await prisma.contentPost.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!post || post.userId !== userId) {
      return NextResponse.json({ error: 'Post not found or not owned' }, { status: 404 });
    }

    // Set status to PUBLISHING
    await prisma.contentPost.update({
      where: { id },
      data: { status: 'PUBLISHING' },
    });

    const results = await publishToAllPlatforms(id);
    const threadsSuccess = results.threads?.success ?? true;

    if (threadsSuccess) {
      const now = new Date();
      await prisma.contentPost.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
          threadsPostId: results.threads?.id || null,
          lastError: null,
        },
      });

      // Update scheduler job status if exists
      await prisma.schedulerJob.updateMany({
        where: { contentId: id },
        data: {
          status: 'COMPLETED',
          publishedAt: now,
        },
      });

      await prisma.systemLog.create({
        data: {
          level: 'INFO',
          source: 'MULTI_PUBLISH',
          message: `Post ${id} berhasil didistribusikan ke multi-platform! Threads ID: ${results.threads?.id || 'OK'}`,
          details: JSON.stringify(results),
        },
      });

      return NextResponse.json({ success: true, results });
    } else {
      await prisma.contentPost.update({
        where: { id },
        data: {
          status: 'FAILED',
          lastError: results.threads?.error,
        },
      });

      return NextResponse.json({ success: false, error: results.threads?.error });
    }
  } catch (err: any) {
    console.error('Publish API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
