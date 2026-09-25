export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[SCHEDULER DAEMON] Initializing Local Background Runner...");

    // Check jobs every 60 seconds locally
    setInterval(async () => {
      try {
        const { prisma } = await import("./lib/prisma");
        const { publishThreadChain } = await import("./lib/threads");

        const settings = await prisma.automationSettings.findFirst({
          where: { enabled: true },
        });

        if (!settings || !settings.autoPublish) return;

        const now = new Date();
        const pendingJobs = await prisma.schedulerJob.findMany({
          where: {
            status: "PENDING",
            scheduledAt: { lte: now },
          },
          include: {
            content: {
              include: { product: true },
            },
          },
          take: 3,
        });

        if (pendingJobs.length === 0) return;

        console.log(`[SCHEDULER DAEMON] Processing ${pendingJobs.length} due job(s)...`);

        for (const job of pendingJobs) {
          // Idempotency lock
          await prisma.schedulerJob.update({
            where: { id: job.id },
            data: { status: "PROCESSING", lastAttemptAt: now, attempts: { increment: 1 } },
          });

          await prisma.contentPost.update({
            where: { id: job.contentId },
            data: { status: "PUBLISHING" },
          });

          const chain: string[] = JSON.parse(job.content.content || "[]");
          const imageUrl = job.content.product.imageUrl;

          const threadsUserId = settings.threadsUserId || process.env.THREADS_USER_ID || "";
          const threadsAccessToken = settings.threadsAccessToken || process.env.THREADS_ACCESS_TOKEN || "";

          const res = await publishThreadChain(threadsUserId, threadsAccessToken, chain, imageUrl);

          if (res.success) {
            await prisma.schedulerJob.update({
              where: { id: job.id },
              data: { status: "COMPLETED", publishedAt: new Date() },
            });
            await prisma.contentPost.update({
              where: { id: job.contentId },
              data: {
                status: "PUBLISHED",
                publishedAt: new Date(),
                threadsPostId: res.publishedId,
              },
            });
            await prisma.systemLog.create({
              data: {
                level: "INFO",
                source: "DAEMON_PUBLISH",
                message: `Utas ${job.contentId} berhasil diterbitkan ke Threads secara otomatis!`,
                details: JSON.stringify({ postId: res.publishedId }),
              },
            });
            console.log(`[SCHEDULER DAEMON] Post ${job.contentId} published successfully!`);
          } else {
            const isFinal = job.attempts >= (settings.maxRegenerationAttempts || 3);
            await prisma.schedulerJob.update({
              where: { id: job.id },
              data: { status: isFinal ? "FAILED" : "PENDING", errorMessage: res.error },
            });
            await prisma.contentPost.update({
              where: { id: job.contentId },
              data: {
                status: isFinal ? "FAILED" : "SCHEDULED",
                lastError: res.error,
                retryCount: { increment: 1 },
              },
            });
            console.warn(`[SCHEDULER DAEMON] Post ${job.contentId} publish failed: ${res.error}`);
          }
        }
      } catch (err) {
        console.error("[SCHEDULER DAEMON ERROR]", err);
      }
    }, 60 * 1000); // 60 seconds
  }
}
