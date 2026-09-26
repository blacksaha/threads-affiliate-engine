const { PrismaClient } = require('@prisma/client');
const { publishToAllPlatforms } = require('./src/lib/publisher.ts'); // Wait, publisher is TS, need to run it via ts-node or just use fetch directly.

const prisma = new PrismaClient();

async function testPublish() {
  const post = await prisma.contentPost.findFirst({
    where: { userId: 'admin_initial_id', status: { not: 'FAILED' } },
    orderBy: { createdAt: 'desc' }
  });

  if (!post) {
    console.log("No valid post found");
    return;
  }
  
  console.log("Testing publish for post:", post.id);
  // Do exactly what lib/publisher does:
  const settings = await prisma.automationSettings.findUnique({ where: { userId: post.userId } });
  
  const token = settings.threadsAccessToken;
  const userId = settings.threadsUserId;
  console.log("Token:", token ? "yes" : "no", "UserId:", userId);

  const chain = [post.hook || "", post.body || "", post.cta || ""].filter(Boolean);
  console.log("Chain length:", chain.length);
  
  // Actually we can just hit the API endpoint!
}

testPublish().then(() => prisma.$disconnect());
