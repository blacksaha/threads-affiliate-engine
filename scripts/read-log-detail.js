require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getLogDetail() {
  const l = await prisma.systemLog.findFirst({
    where: { source: 'MULTI_PUBLISH' },
    orderBy: { createdAt: 'desc' }
  });
  console.log("Full log details:", l.details);
}

getLogDetail().finally(() => prisma.$disconnect());
