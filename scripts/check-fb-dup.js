const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log("=== SOCIAL ACCOUNTS ===");
  const accounts = await prisma.socialAccount.findMany({ where: { isActive: true } });
  accounts.forEach(a => console.log(`${a.platform} | id=${a.id} | accountId=${a.accountId} | name=${a.name}`));

  console.log("\n=== DUPLICATE FB ACCOUNTS? ===");
  const fb = accounts.filter(a => a.platform === 'FACEBOOK');
  const byPageId = {};
  fb.forEach(a => { byPageId[a.accountId] = (byPageId[a.accountId] || 0) + 1; });
  console.log(byPageId);

  console.log("\n=== SCHEDULER JOBS PER CONTENT (duplicates?) ===");
  const jobs = await prisma.schedulerJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: { content: { select: { hook: true, status: true } } }
  });
  const byContent = {};
  jobs.forEach(j => {
    byContent[j.contentId] = byContent[j.contentId] || [];
    byContent[j.contentId].push({ jobId: j.id, status: j.status, attempts: j.attempts, sched: j.scheduledAt });
  });
  Object.entries(byContent).forEach(([cid, arr]) => {
    if (arr.length > 1) console.log(`Content ${cid} has ${arr.length} jobs:`, JSON.stringify(arr));
  });

  console.log("\n=== PUBLISHED POSTS (last 15) ===");
  const posts = await prisma.contentPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 15,
    select: { id: true, publishedAt: true, threadsPostId: true, retryCount: true, hook: true }
  });
  posts.forEach(p => console.log(`${p.publishedAt?.toISOString()} | id=${p.id} | retries=${p.retryCount} | hook=${(p.hook || '').substring(0, 45)}`));
}

check().finally(() => prisma.$disconnect());
