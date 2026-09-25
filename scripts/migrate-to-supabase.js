const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const path = require('path');

const prisma = new PrismaClient();
const sqlite = new Database(path.join(__dirname, '../prisma/dev.db')); // <-- Folder yang benar

async function migrate() {
  console.log("🚀 Menyedot data dari dev.db lokal...");

  try {
    // 1. Users
    const users = sqlite.prepare("SELECT * FROM User").all();
    console.log(`Mengunggah ${users.length} Users...`);
    for (const u of users) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: {},
        create: {
          id: u.id,
          name: u.name,
          email: u.email,
          password: u.password,
          role: u.role,
          status: u.status,
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
        }
      });
    }

    // 2. AutomationSettings
    const settings = sqlite.prepare("SELECT * FROM AutomationSettings").all();
    console.log(`Mengunggah ${settings.length} Settings...`);
    for (const s of settings) {
      await prisma.automationSettings.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          userId: s.userId,
          enabled: Boolean(s.enabled),
          autoGenerate: Boolean(s.autoGenerate),
          autoSchedule: Boolean(s.autoSchedule),
          autoPublish: Boolean(s.autoPublish),
          autoRegenerate: Boolean(s.autoRegenerate),
          maxRegenerationAttempts: s.maxRegenerationAttempts,
          postsPerDay: s.postsPerDay,
          minimumIntervalMinutes: s.minimumIntervalMinutes,
          postingDays: s.postingDays,
          postingTimes: s.postingTimes,
          timezone: s.timezone,
          similarityThreshold: s.similarityThreshold,
          threadsUserId: s.threadsUserId,
          threadsAccessToken: s.threadsAccessToken,
          telegramBotToken: s.telegramBotToken,
          telegramChatId: s.telegramChatId,
          telegramEnabled: Boolean(s.telegramEnabled),
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        }
      });
    }

    // 3. SocialAccounts
    const accounts = sqlite.prepare("SELECT * FROM SocialAccount").all();
    console.log(`Mengunggah ${accounts.length} Social Accounts...`);
    for (const a of accounts) {
      await prisma.socialAccount.upsert({
        where: { id: a.id },
        update: {},
        create: {
          id: a.id,
          userId: a.userId,
          platform: a.platform,
          name: a.accountName || a.name || "Akun Migrasi", // <-- Handle perbedaan schema Prisma
          accountId: a.accountId,
          accessToken: a.accessToken,
          refreshToken: a.refreshToken,
          isActive: Boolean(a.isActive),
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
        }
      });
    }

    // 4. Products
    const products = sqlite.prepare("SELECT * FROM Product").all();
    console.log(`Mengunggah ${products.length} Products...`);
    for (const p of products) {
      await prisma.product.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          userId: p.userId,
          name: p.name,
          price: p.price,
          affiliateUrl: p.affiliateUrl,
          imageUrl: p.imageUrl,
          description: p.description,
          category: p.category,
          status: p.status,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }
      });
    }

    // 5. ContentAngles
    const angles = sqlite.prepare("SELECT * FROM ContentAngle").all();
    console.log(`Mengunggah ${angles.length} Content Angles...`);
    for (const an of angles) {
      await prisma.contentAngle.upsert({
        where: { id: an.id },
        update: {},
        create: {
          id: an.id,
          productId: an.productId,
          angleType: an.angleType,
          description: an.description,
          targetAudience: an.targetAudience,
          createdAt: an.createdAt ? new Date(an.createdAt) : new Date(),
        }
      });
    }

    // 6. ContentPosts
    const posts = sqlite.prepare("SELECT * FROM ContentPost").all();
    console.log(`Mengunggah ${posts.length} Content Posts...`);
    for (const po of posts) {
      // Pastikan produk terkait benar-benar ada di database (karena relation check)
      const isProductExist = await prisma.product.findUnique({ where: { id: po.productId } });
      if (!isProductExist) continue;

      await prisma.contentPost.upsert({
        where: { id: po.id },
        update: {},
        create: {
          id: po.id,
          userId: po.userId || "admin_initial_id",
          product: { connect: { id: po.productId } }, // Gunakan connect untuk relation
          angle: po.angleId ? { connect: { id: po.angleId } } : undefined, // <-- Tambahkan angle relasi
          hook: po.hook,
          body: po.body,
          cta: po.cta,
          xContent: po.xContent,
          fbContent: po.fbContent,
          fbComment: po.fbComment,
          content: po.fullDraftJson || "{}", // <-- Isi fallback kosong
          qualityScore: po.qualityScore || 0.85,
          status: po.status || "PUBLISHED",
          scheduledAt: po.scheduledAt ? new Date(po.scheduledAt) : null,
          threadsPostId: po.threadsPostId,
          threadsUrl: po.threadsUrl,
          generationAttempts: po.generationAttempts,
          errorMessage: po.errorMessage,
          createdAt: po.createdAt ? new Date(po.createdAt) : new Date(),
          updatedAt: po.updatedAt ? new Date(po.updatedAt) : new Date(),
        }
      });
    }

    // 7. SchedulerJobs
    const jobs = sqlite.prepare("SELECT * FROM SchedulerJob").all();
    console.log(`Mengunggah ${jobs.length} Scheduler Jobs...`);
    for (const j of jobs) {
      const postId = j.postId || j.contentPostId;
      if (!postId) continue;

      const isPostExist = await prisma.contentPost.findUnique({ where: { id: postId } });
      if (!isPostExist) continue;

      await prisma.schedulerJob.upsert({
        where: { id: j.id },
        update: {},
        create: {
          id: j.id,
          userId: j.userId || "admin_initial_id",
          content: { connect: { id: postId } },
          scheduledAt: j.scheduledAt ? new Date(j.scheduledAt) : new Date(),
          status: j.status,
          retryCount: j.retryCount || 0,
          lastError: j.lastError,
          publishedAt: j.publishedAt ? new Date(j.publishedAt) : null,
          createdAt: j.createdAt ? new Date(j.createdAt) : new Date(),
          updatedAt: j.updatedAt ? new Date(j.updatedAt) : new Date(),
        }
      });
    }

    console.log("\n=============================================");
    console.log("🎉 SUKSES BESAR! SELURUH DATA LOKAL SUDAH PINDAH KE SUPABASE!");
    console.log("=============================================\n");

  } catch (err) {
    console.error("Gagal saat memindahkan data:", err);
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

migrate();