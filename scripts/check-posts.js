const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPosts() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Latest 5 posts in DB:");
  console.table(posts.map(p => ({
    id: p.id,
    targetUserId: p.targetUserId,
    status: p.status,
    scheduledFor: p.scheduledFor,
    platformPostId: p.platformPostId,
    errorLog: p.errorLog?.substring(0, 50)
  })));
  
  const settings = await prisma.automationSettings.findMany();
  console.log("Automation Settings:");
  console.table(settings.map(s => ({
    userId: s.userId,
    targetUserId: s.targetUserId,
    threadsToken: s.threadsToken ? "SET" : "MISSING",
    threadsUserId: s.threadsUserId
  })));
}

checkPosts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
