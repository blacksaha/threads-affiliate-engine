const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const prods = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { id: true, name: true, imageUrl: true, affiliateUrl: true, createdAt: true }
  });
  prods.forEach(p => {
    console.log(`${p.createdAt.toISOString()} | img=${p.imageUrl ? 'YES' : 'NO'} | ${p.name.substring(0, 50)}`);
  });
  const total = await prisma.product.count();
  const withImg = await prisma.product.count({ where: { imageUrl: { not: null } } });
  console.log(`
Total: ${total}, With image: ${withImg}, Without: ${total - withImg}`);
}
main().finally(() => prisma.$disconnect());
