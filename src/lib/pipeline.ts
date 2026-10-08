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

  const aiConfig = {
    provider: settings.aiProvider || "GEMINI",
    apiKey: *** || null,
    baseUrl: settings.aiBaseUrl || null,
    modelName: settings.aiModel || null,
  };

  // 1. Assign angle if product has none (Quick archetype selection without LLM latency)
  let angle = product.angles[0];
  if (!angle) {
    const archetypes = [
      { angleType: 'Problem Solver', description: 'Curhat masalah harian/anak kost/kantoran yang bikin jengkel secara jujur', targetAudience: 'Umum / Pekerja / Anak Kost' },
      { angleType: 'Curious Discovery', description: 'Pengakuan nemu barang random yang ternyata mengubah rutinitas harian', targetAudience: 'Netizen yang suka kepo' },
      { angleType: 'Myth Buster', description: 'Membantah anggapan barang bagus harus mahal padahal ada alternatif praktis', targetAudience: 'Pecinta efisiensi' },
      { angleType: 'Plot Twist', description: 'Awalnya skeptis dan ngeremehin barangnya, pas datang malah ketagihan', targetAudience: 'Pembeli selektif' },
      { angleType: 'Social Proof', description: 'Cerita gara-gara racun teman atau lewat di FYP terus nyobain sendiri', targetAudience: 'Anak muda / Netizen' }
    ];
    // Rotate or pick randomly
    const selected = archetypes[Math.floor(Math.random() * archetypes.length)];

    angle = await prisma.contentAngle.create({
      data: {
        productId: product.id,
        angleType: selected.angleType,
        description: selected.description,
        targetAudience: selected.targetAudience,
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
  const similarityThreshold = settings.similarityThreshold ?? 0.65;
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
          product.affiliateUrl,
          aiConfig
        );
      } else {
        draft = await generateThreadContent(
          product.name,
          product.price,
          product.affiliateUrl,
          angle.angleType,
          angle.description,
          previousHooks,
          aiConfig
        );
      }

      // 2. Anti-Repetition Check
      const repCheck = await checkAntiRepetition(draft.hook, previousHooks, similarityThreshold);
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
