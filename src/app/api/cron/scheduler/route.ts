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

  // 0. Recover any jobs stuck in PROCESSING for more than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.schedulerJob.updateMany({
    where: {
      status: 'PROCESSING',
      lastAttemptAt: { lt: fiveMinutesAgo },
    },
    data: {
      status: 'PENDING',
    },
  });

  // 1. Find pending jobs whose scheduledAt has arrived (process max 2 per run to stay well within serverless limits)
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
    take: 2, // Process in small batches
  });

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

    // Idempotency: lock status + attempt count
    await prisma.schedulerJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', lastAttemptAt: now, attempts: { increment: 1 } },
    });

    // Double-check guard: if already published by another concurrent run, skip
    const freshContent = await prisma.contentPost.findUnique({
      where: { id: job.contentId },
      select: { status: true, publishedAt: true, threadsPostId: true, facebookPostId: true, xPostId: true }
    });
    if (freshContent?.status === 'PUBLISHED') {
      console.log(`[SCHEDULER] Job ${job.id} already published (status=PUBLISHED). Skipping.`);
      await prisma.schedulerJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', publishedAt: freshContent.publishedAt || new Date() },
      });
      continue;
    }

    // 3. Delegate to the Multi-Platform Publisher!
    // The publisher automatically loads the correct tokens for this user.
    const { publishToAllPlatforms } = await import('@/lib/publisher');
    
    let publishResult;
    try {
      publishResult = await publishToAllPlatforms(job.contentId);
    } catch (e: any) {
      publishResult = { threads: { success: false, error: e.message } };
    }

    // Idempotency: mark post as PUBLISHED only if not already published
    const alreadyPublished = await prisma.contentPost.findUnique({
      where: { id: job.contentId },
      select: { status: true, publishedAt: true, threadsPostId: true, facebookPostId: true, xPostId: true }
    });

    if (alreadyPublished?.status === 'PUBLISHED') {
      console.log(`[SCHEDULER] Content ${job.contentId} already PUBLISHED. Skipping duplicate update.`);
      results.push({ jobId: job.id, status: 'ALREADY_PUBLISHED' });
      continue;
    }

    // We consider it a success if at least threads published successfully (or if it wasn't requested but something else succeeded)
    const isSuccess = publishResult.threads?.success || publishResult.facebook?.success || publishResult.x?.success;

    if (isSuccess) {
      const publishedAt = new Date();
      await prisma.schedulerJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', publishedAt },
      });

      await prisma.contentPost.update({
        where: { id: job.contentId },
        data: {
          status: 'PUBLISHED',
          publishedAt,
          threadsPostId: publishResult.threads?.id || alreadyPublished?.threadsPostId || null,
          facebookPostId: publishResult.facebook?.id || alreadyPublished?.facebookPostId || null,
          xPostId: publishResult.x?.id || alreadyPublished?.xPostId || null,
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

      // NOTIFIKASI INSTAN TELEGRAM SAAT BERHASIL TAYANG
      try {
        const ownerSettings = await prisma.automationSettings.findUnique({
          where: { userId: job.userId },
        });
        if (ownerSettings?.telegramBotToken && ownerSettings?.telegramChatId && ownerSettings?.telegramEnabled) {
          const { sendTelegramMessage } = await import('@/lib/telegram');
          const platforms = [];
          if (publishResult.threads?.success) platforms.push('🧵 Threads');
          if (publishResult.facebook?.success) platforms.push('📘 Facebook');
          if (publishResult.x?.success) platforms.push('✖️ X/Twitter');

          const prodName = job.content?.product?.name || 'Produk';
          const hookPreview = job.content?.hook ? `\n\n💬 Preview:\n_${job.content.hook}_` : '';
          const msg = `🚀 *KONTEN BERHASIL TAYANG!*\n\n📦 *${prodName}*\n🌐 Platform: ${platforms.join(', ')}${hookPreview}\n\n_Auto-published 24/7 by Engine._`;
          await sendTelegramMessage(ownerSettings.telegramBotToken, ownerSettings.telegramChatId, msg);
        }
      } catch (notifErr) {
        console.error('[SCHEDULER] Error sending Telegram publish notification:', notifErr);
      }

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

  // 4. Auto-Regenerate FAILED or ABORTED Pipelines (Rate limit / Timeout recovery)
  let recoveredCount = 0;
  try {
    // Only attempt recovery if we have spare time and capacity
    if (jobsToProcess.length < 5) {
      // Find active products that have NO posts (aborted by timeout) OR only FAILED posts
      const failedProductsToRecover = await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { posts: { none: {} } },
            { posts: { some: { status: 'FAILED' }, none: { status: { in: ['PUBLISHED', 'SCHEDULED', 'READY'] } } } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 2 // Max 2 per cycle
      });

      for (const prod of failedProductsToRecover) {
        const ownerSettings = await prisma.automationSettings.findUnique({
          where: { userId: prod.userId },
        });

        if (ownerSettings?.enabled && ownerSettings?.autoRegenerate) {
          console.log(`[SCHEDULER] Auto-recovering pipeline for product: ${prod.name}`);
          const { runProductPipeline } = await import('@/lib/pipeline');
          const res = await runProductPipeline(prod.id, prod.userId);
          recoveredCount++;

          // Beritahu pengguna via Telegram jika berhasil pulih
          if (res.success && res.post && ownerSettings.telegramBotToken && ownerSettings.telegramChatId) {
            const { sendTelegramMessage } = await import('@/lib/telegram');
            const t = res.post.scheduledAt ? new Date(res.post.scheduledAt).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "-";
            await sendTelegramMessage(
              ownerSettings.telegramBotToken, 
              ownerSettings.telegramChatId, 
              `✅ *AI Selesai Membedah!*\n\nProduk: *${prod.name}*\n⏰ Jam Tayang: *${t}*\n💬 Preview:\n_${res.post.hook}_`
            ).catch(console.error);
          }
        }
      }
    }
  } catch (err) {
    console.error("[SCHEDULER] Error during auto-recovery:", err);
  }

  if (results.length === 0 && recoveredCount === 0) {
    return NextResponse.json({
      status: 'idle',
      message: 'No scheduled jobs due and no failed pipelines to recover.',
    });
  }

  return NextResponse.json({
    status: 'processed',
    processedCount: results.length,
    recoveredCount,
    results,
  });
}
