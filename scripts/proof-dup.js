const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Jobs stuck-crashed then reset -> republished
  const jobs = await prisma.schedulerJob.findMany({
    where: { attempts: { gte: 4 } },
    include: { content: { select: { id: true, status: true, hook: true, publishedAt: true } } }
  });
  console.log("=== JOBS WITH >=4 ATTEMPTS (crash + reset + republish) ===");
  for (const j of jobs) {
    console.log(`\njob=${j.id}`);
    console.log(`  attempts=${j.attempts} jobStatus=${j.status}`);
    console.log(`  contentId=${j.contentId} contentStatus=${j.content.status}`);
    console.log(`  hook="${(j.content.hook||'').substring(0,60)}"`);
  }

  console.log("\n=== CONTENT IN 'PUBLISHING'/'PROCESSING' LIMBO (never finalized) ===");
  const limbo = await prisma.contentPost.findMany({
    where: { status: { in: ['PUBLISHING', 'GENERATING'] } },
    select: { id: true, status: true, hook: true, createdAt: true }
  });
  limbo.forEach(p => console.log(`${p.status} | ${p.id} | ${(p.hook||'').substring(0,50)}`));
}
main().finally(() => prisma.$disconnect());
