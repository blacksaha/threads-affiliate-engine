const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserData() {
  const users = await prisma.user.findMany();
  console.log("Users:", users.map(u => ({ id: u.id, email: u.email, role: u.role })));

  const settings = await prisma.automationSettings.findMany();
  console.log("AutomationSettings:", settings.map(s => ({
    id: s.id,
    userId: s.userId,
    threadsUserId: s.threadsUserId,
    hasToken: !!s.threadsAccessToken,
    enabled: s.enabled,
    autoPublish: s.autoPublish
  })));

  const posts = await prisma.contentPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Recent ContentPosts:");
  console.table(posts.map(p => ({
    id: p.id,
    userId: p.userId,
    status: p.status,
    threadsPostId: p.threadsPostId,
    scheduledAt: p.scheduledAt,
    publishedAt: p.publishedAt,
    lastError: p.lastError
  })));
  
  const accounts = await prisma.socialAccount.findMany();
  console.log("SocialAccounts:", accounts);
}

checkUserData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
