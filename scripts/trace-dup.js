const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // The 9-attempt job - what happened at each attempt?
  const job = await prisma.schedulerJob.findFirst({
    where: { attempts: { gte: 8 } },
    include: { content: true }
  });
  console.log("Job:", job.id, "attempts:", job.attempts, "status:", job.status);
  console.log("content status:", job.content.status, "threadsPostId:", job.content.threadsPostId);
  console.log("content hook:", (job.content.hook || '').substring(0, 80));

  console.log("\n=== ALL LOGS FOR THIS JOB'S CONTENT ===");
  const logs = await prisma.systemLog.findMany({
    where: { details: { contains: job.contentId } },
    orderBy: { createdAt: 'asc' }
  });
  logs.forEach(l => {
    console.log(`[${l.createdAt.toISOString()}] ${l.source} ${l.level}: ${l.message.substring(0,80)}`);
    console.log(`   ${(l.details || '').substring(0, 500)}`);
  });
}
main().finally(() => prisma.$disconnect());
