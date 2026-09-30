const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.systemLog.findMany({
    where: { source: 'SCHEDULER' },
    orderBy: { createdAt: 'asc' },
    take: 60
  });

  console.log("Total SCHEDULER logs:", logs.length, "\n");

  const fbIds = {};
  for (const l of logs) {
    let fb = null, th = null, x = null;
    try {
      const d = JSON.parse(l.details || '{}');
      fb = d.facebook && d.facebook.success ? d.facebook.id : (d.facebook ? 'FAIL' : 'n/a');
      th = d.threads && d.threads.success ? d.threads.id : (d.threads ? 'FAIL' : 'n/a');
      x  = d.x && d.x.success ? d.x.id : (d.x ? 'FAIL' : 'n/a');
    } catch (e) { fb = th = x = 'parse-err'; }

    if (typeof fb === 'string' && fb.startsWith('1348386401690147_')) {
      fbIds[fb] = (fbIds[fb] || 0) + 1;
    }
    console.log(`[${l.createdAt.toISOString()}] ${l.level} | ${l.message.substring(0,70)}`);
    console.log(`    threads=${th} | fb=${fb} | x=${x}`);
  }

  console.log("\n=== FB POST ID FREQUENCY ===");
  console.log(JSON.stringify(fbIds, null, 2));
}

main().finally(() => prisma.$disconnect());
