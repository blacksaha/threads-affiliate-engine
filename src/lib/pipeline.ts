import { prisma } from './prisma';
import {
  generateProductAngles,
  generateThreadContent,
  generateThematicContent,
  checkAntiRepetition,
  qualityCheckContent,
  ThreadPostDraft,
} from './gemini';

/**
 * Calculates the next available scheduled posting timestamp based on rules
 */
export async function calculateNextScheduleSlot(userId: string): Promise<Date> {
  const settings = await prisma.automationSettings.findUnique({
    where: { userId },
  });

  const times = settings?.postingTimes ? settings.postingTimes.split(',') : ['08:00', '13:00', '19:00'];
  const minIntervalMinutes = settings?.minimumIntervalMinutes ?? 240;

  // Find the latest scheduled post
  const lastScheduled = await prisma.contentPost.findFirst({
    where: {
      userId,
      status: { in: ['SCHEDULED', 'READY'] },
      scheduledAt: { not: null },
    },
    orderBy: { scheduledAt: 'desc' },
  });

  const now = new Date();
  let baseTime = lastScheduled?.scheduledAt ? new Date(lastScheduled.scheduledAt) : now;

  // If baseTime is in the past, reset to now
  if (baseTime < now) {
    baseTime = now;
  }

  // Next slot must be at least minIntervalMinutes after baseTime
  const candidateTime = new Date(baseTime.getTime() + minIntervalMinutes * 60 * 1000);

  // Match the closest preferred posting hour if possible
  return candidateTime;
}

/**
 * Hands-Off Full Automation Pipeline:
 * Product -> Analysis -> Angle -> AI Generation -> Anti-Repetition -> Quality Check -> Auto-Schedule
 */
export async function runProductPipeline(productId: string, userId = 'default_user', themeOverride?: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { angles: true },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const settings = await prisma.automationSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  // 1. Generate angles if product has none
  let angle = product.angles[0];
  if (!angle) {
    const generatedAngles = await generateProductAngles(product.name, product.price, product.description ?? '');
    const firstAngle = generatedAngles[0] || {
      angleType: 'Problem Solver',
      description: 'Mengatasi keluhan sehari-hari',
      targetAudience: 'Umum',
    };

    angle = await prisma.contentAngle.create({
      data: {
        productId: product.id,
        angleType: firstAngle.angleType,
        description: firstAngle.description,
        targetAudience: firstAngle.targetAudience,
      },
    });
  }

  // Fetch previous hooks for anti-repetition check
  const previousPosts = await prisma.contentPost.findMany({
    where: { userId },
    select: { hook: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
  const previousHooks = previousPosts.map((p) => p.hook).filter(Boolean) as string[];

  let attempt = 0;
  const maxAttempts = settings.maxRegenerationAttempts || 3;
  let draft: ThreadPostDraft | null = null;
  let repetitionPass = false;
  let qualityPass = false;
  let similarityScore = 0;
  let qualityScore = 0;
  let lastErrorReason = '';

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`[PIPELINE] Attempt ${attempt}/${maxAttempts} for product: ${product.name} | Theme: ${themeOverride || 'None'}`);

    try {
      if (themeOverride) {
        draft = await generateThematicContent(
          themeOverride,
          product.name,
          product.price,
          product.affiliateUrl
        );
      } else {
        draft = await generateThreadContent(
          product.name,
          product.price,
          product.affiliateUrl,
          angle.angleType,
          angle.description
        );
      }

      // 2. Anti-Repetition Check
      const repCheck = await checkAntiRepetition(draft.hook, previousHooks);
      similarityScore = repCheck.score;
      repetitionPass = repCheck.pass;

      if (!repetitionPass) {
        lastErrorReason = `Repetition check failed (Similarity: ${similarityScore.toFixed(2)})`;
        console.warn(`[PIPELINE] ${lastErrorReason}. Retrying...`);
        continue;
      }

      // 3. Quality Check
      const qCheck = await qualityCheckContent(draft);
      qualityScore = qCheck.score;
      qualityPass = qCheck.pass;

      if (!qualityPass) {
        lastErrorReason = `Quality check failed (Score: ${qualityScore.toFixed(2)}): ${qCheck.reason}`;
        console.warn(`[PIPELINE] ${lastErrorReason}. Retrying...`);
        continue;
      }

      // Both checks passed!
      break;
    } catch (err: unknown) {
      lastErrorReason = err instanceof Error ? err.message : String(err);
      console.error(`[PIPELINE] Error in generation attempt ${attempt}:`, err);
    }
  }

  // If failed all attempts
  if (!draft || !repetitionPass || !qualityPass) {
    await prisma.contentPost.create({
      data: {
        userId,
        productId: product.id,
        angleId: angle.id,
        content: draft ? JSON.stringify(draft.chain) : '[]',
        hook: draft?.hook ?? '',
        body: draft?.story ?? '',
        cta: draft?.cta ?? '',
        status: 'FAILED',
        validationStatus: 'FAIL',
        generationAttempt: attempt,
        similarityScore,
        qualityScore,
        lastError: lastErrorReason,
      },
    });

    await prisma.systemLog.create({
      data: {
        level: 'ERROR',
        source: 'PIPELINE',
        message: `Failed to generate compliant content for ${product.name} after ${attempt} attempts.`,
        details: lastErrorReason,
      },
    });

    return { success: false, reason: lastErrorReason };
  }

  // 4. Determine Auto Schedule slot
  const nextSlot = await calculateNextScheduleSlot(userId);

  // 5. Save to Content Queue with SCHEDULED status (No manual review)
  const newPost = await prisma.contentPost.create({
    data: {
      userId,
      productId: product.id,
      angleId: angle.id,
      content: JSON.stringify(draft.chain),
      hook: draft.hook,
      body: `${draft.story}\n\n${draft.review}`,
      cta: draft.cta,
      xContent: draft.xContent,
      fbContent: draft.fbContent,
      fbComment: draft.fbComment,
      status: 'SCHEDULED',
      validationStatus: 'PASS',
      generationAttempt: attempt,
      similarityScore,
      qualityScore,
      scheduledAt: nextSlot,
      timezone: settings.timezone,
    },
  });

  // Create corresponding Scheduler Job
  await prisma.schedulerJob.create({
    data: {
      userId,
      contentId: newPost.id,
      scheduledAt: nextSlot,
      status: 'PENDING',
    },
  });

  await prisma.systemLog.create({
    data: {
      level: 'INFO',
      source: 'PIPELINE',
      message: `Content generated and automatically scheduled for ${nextSlot.toISOString()}`,
      details: JSON.stringify({ postId: newPost.id, attempts: attempt, qualityScore }),
    },
  });

  return { success: true, post: newPost };
}
