const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Jobs with more than 1 attempt => republished
  const jobs = await prisma.schedulerJob.findMany({
    where: { attempts: { gt: 1 } },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { content: { select: { id: true, status: true, hook: true, publishedAt: true } } }
  });
  console.log("=== JOBS WITH attempts > 1 (republished!) ===");
  jobs.forEach(j => console.log(`job=${j.id} attempts=${j.attempts} status=${j.status} content=${j.contentId} postStatus=${j.content.status}`));

  console.log("\n=== CONTENT POSTS with retryCount > 0 ===");
  const posts = await prisma.contentPost.findMany({
    where: { retryCount: { gt: 0 } },
    select: { id: true, status: true, retryCount: true, publishedAt: true, hook: true }
  });
  posts.forEach(p => console.log(`post=${p.id} retries=${p.retryCount} status=${p.status} publishedAt=${p.publishedAt} hook=${(p.hook||'').substring(0,40)}`));

  console.log("\n=== POSTS THAT PUBLISHED WITH MULTIPLE ATTEMPTS (real duplicate risk) ===");
  const all = await prisma.schedulerJob.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: 'asc' },
    include: { content: { select: { publishedAt: true, hook: true, threadsPostId: true } } }
  });
  all.forEach(j => console.log(`job=${j.id} attempts=${j.attempts} publishedAt=${j.publishedAt?.toISOString()} hook=${(j.content.hook||'').substring(0,40)}`));
}
main().finally(() => prisma.$disconnect());
