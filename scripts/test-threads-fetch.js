require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const s = await prisma.automationSettings.findFirst({ where: { userId: 'admin_initial_id' } });
  
  const token = s.threadsAccessToken;
  const uid = s.threadsUserId;
  
  console.log("Token length:", token?.length);
  
  // Create first container
  const res1 = await fetch(`https://graph.threads.net/v1.0/${uid}/threads?media_type=TEXT&text=${encodeURIComponent("Test 1")}&access_token=${token}`, { method: 'POST' });
  const data1 = await res1.json();
  console.log("Cont 1:", data1);
  
  if (data1.id) {
    const pub = await fetch(`https://graph.threads.net/v1.0/${uid}/threads_publish?creation_id=${data1.id}&access_token=${token}`, { method: 'POST' });
    const pData = await pub.json();
    console.log("Publish:", pData);
  }
}

check().finally(() => prisma.$disconnect());
