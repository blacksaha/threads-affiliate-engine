
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProducts() {
  // Cek produk yang belum selesai diproses (belum punya post terkait atau status SCHEDULED)
  const products = await prisma.product.findMany({
    where: {
      userId: 'default_user'
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  console.log('Produk terbaru (20):');
  for (const p of products) {
    const posts = await prisma.contentPost.findMany({
      where: { productId: p.id, status: 'SCHEDULED' }
    });
    
    console.log(`- ${p.name.substring(0, 40)}... | Link: ${p.affiliateUrl} | Status Post Scheduled: ${posts.length > 0 ? '✅' : '❌'}`);
  }
}

checkProducts().finally(() => prisma.$disconnect());
