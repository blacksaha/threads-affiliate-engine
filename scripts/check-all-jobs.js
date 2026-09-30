const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.schedulerJob.findMany({ select: { contentId: true } });
  const counts = {};
  jobs.forEach(j => { counts[j.contentId] = (counts[j.contentId] || 0) + 1; });
  const dups = Object.entries(counts).filter(([, n]) => n > 1);
  console.log("Total jobs:", jobs.length);
  console.log("Content IDs with >1 job:", dups.length);
  dups.forEach(([cid, n]) => console.log(`  ${cid} -> ${n} jobs`));
}
main().finally(() => prisma.$disconnect());
