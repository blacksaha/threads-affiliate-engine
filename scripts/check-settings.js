const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSettings() {
  const settings = await prisma.automationSettings.findMany();
  console.log(JSON.stringify(settings, null, 2));
  await prisma.$disconnect();
}
checkSettings().catch(console.error);