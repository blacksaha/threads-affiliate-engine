require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setWebhook() {
  const settings = await prisma.automationSettings.findFirst({ where: { userId: 'admin_initial_id' } });
  if (!settings?.telegramBotToken) {
    console.log('Token bot tidak ditemukan!');
    return;
  }
  const token = settings.telegramBotToken;
  const webhookUrl = 'https://threads-affiliate-engine.vercel.app/api/telegram/webhook';
  
  console.log(`Setting webhook ke: ${webhookUrl}`);
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
  const data = await res.json();
  console.log('HASIL DARI TELEGRAM:', JSON.stringify(data));
}

setWebhook()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
