const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function checkAdmin() {
  const email = 'admin@affiliate.local';
  console.log(`Mencari user: ${email}...`);
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.log(`❌ User dengan email ${email} TIDAK DITEMUKAN di database.`);
  } else {
    console.log(`✅ User ditemukan: ID: ${user.id}, Role: ${user.role}`);
    const valid = await bcrypt.compare('admin123', user.password);
    if (valid) {
      console.log('✅ Password "admin123" COCOK.');
    } else {
      console.log('❌ Password "admin123" SALAH.');
    }
  }
  await prisma.$disconnect();
}

checkAdmin().catch(console.error);