require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getRecentLogs() {
  const logs = await prisma.systemLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log("Recent System Logs:");
  logs.forEach(l => {
    console.log(`[${l.createdAt.toISOString()}] [${l.level}] [${l.source}]: ${l.message}`);
    if (l.details) console.log(`   Details: ${l.details.substring(0, 150)}`);
  });
}

getRecentLogs().finally(() => prisma.$disconnect());
