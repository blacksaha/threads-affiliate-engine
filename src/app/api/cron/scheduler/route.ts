import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishThreadChain } from '@/lib/threads';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60s for batch processing and publishing

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Optional simple secret check
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && searchParams.get('secret') !== cronSecret) {
    // allow for now if local dev
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date();

  // 1. Find pending jobs whose scheduledAt has arrived
  const jobsToProcess = await prisma.schedulerJob.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now },
    },
    include: {
      content: {
        include: { product: true },
      },
    },
    take: 5, // Process in batches
  });

  if (jobsToProcess.length === 0) {
    return NextResponse.json({
      status: 'idle',
      message: 'No scheduled jobs due for publishing.',
    });
  }

  const results = [];

  for (const job of jobsToProcess) {
    // 2. Check if the job's owner has automation enabled
    const ownerSettings = await prisma.automationSettings.findUnique({
      where: { userId: job.userId },
    });

    if (!ownerSettings || !ownerSettings.enabled) {
      console.log(`[SCHEDULER] Skipping job ${job.id} because user ${job.userId} paused automation.`);
      continue;
    }

    // Idempotency: Lock job to PROCESSING
    await prisma.schedulerJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', lastAttemptAt: now, attempts: { increment: 1 } },
    });

    await prisma.contentPost.update({
      where: { id: job.contentId },
      data: { status: 'PUBLISHING' },
    });

    // 3. Delegate to the Multi-Platform Publisher!
    // The publisher automatically loads the correct tokens for this user.
    const { publishToAllPlatforms } = await import('@/lib/publisher');
    
    let publishResult;
    try {
      publishResult = await publishToAllPlatforms(job.contentId);
    } catch (e: any) {
      publishResult = { threads: { success: false, error: e.message } };
    }

    // We consider it a success if at least threads published successfully (or if it wasn't requested but something else succeeded)
    const isSuccess = publishResult.threads?.success || publishResult.facebook?.success || publishResult.x?.success;

    if (isSuccess) {
      await prisma.schedulerJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', publishedAt: new Date() },
      });

      await prisma.contentPost.update({
        where: { id: job.contentId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          threadsPostId: publishResult.threads?.id || null,
        },
      });

      await prisma.systemLog.create({
        data: {
          userId: job.userId,
          level: 'INFO',
          source: 'SCHEDULER',
          message: `Post ${job.contentId} successfully published across configured platforms.`,
          details: JSON.stringify(publishResult),
        },
      });

      results.push({ jobId: job.id, status: 'PUBLISHED', results: publishResult });
    } else {
      const maxRetries = 3;
      const isFinalFail = job.attempts >= maxRetries;
      const errorMsg = JSON.stringify(publishResult);

      await prisma.schedulerJob.update({
        where: { id: job.id },
        data: {
          status: isFinalFail ? 'FAILED' : 'PENDING',
          errorMessage: errorMsg,
        },
      });

      await prisma.contentPost.update({
        where: { id: job.contentId },
        data: {
          status: isFinalFail ? 'FAILED' : 'SCHEDULED',
          lastError: errorMsg,
          retryCount: { increment: 1 },
        },
      });

      await prisma.systemLog.create({
        data: {
          userId: job.userId,
          level: 'ERROR',
          source: 'SCHEDULER',
          message: `Failed to publish post ${job.contentId}. ${isFinalFail ? 'Max retries reached.' : 'Will retry later.'}`,
          details: errorMsg,
        },
      });

      results.push({ jobId: job.id, status: isFinalFail ? 'FAILED' : 'RETRYING', error: errorMsg });
    }
  }

  return NextResponse.json({
    status: 'processed',
    processedCount: results.length,
    results,
  });
}
