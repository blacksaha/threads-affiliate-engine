const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const prods = await prisma.product.findMany({
    where: { imageUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { name: true, imageUrl: true }
  });
  prods.forEach(p => console.log(p.name.substring(0,50), '|', p.imageUrl?.substring(0,100)));
}
main().finally(() => prisma.$disconnect());
