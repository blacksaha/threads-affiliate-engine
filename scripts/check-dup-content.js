const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.contentPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'asc' },
    select: { id: true, publishedAt: true, fbContent: true, productId: true, threadsPostId: true, retryCount: true, hook: true }
  });

  console.log("Total PUBLISHED posts:", posts.length);

  // Group by fbContent text -> duplicates mean same text posted many times
  const byText = {};
  posts.forEach(p => {
    const key = (p.fbContent || p.hook || '').trim();
    byText[key] = byText[key] || [];
    byText[key].push(p);
  });

  let dupCount = 0;
  console.log("\n=== DUPLICATE FB TEXT ACROSS PUBLISHED POSTS ===");
  Object.entries(byText).forEach(([text, arr]) => {
    if (arr.length > 1) {
      dupCount++;
      console.log(`\n${arr.length}x DUPLICATE -> "${text.substring(0, 60)}..."`);
      arr.forEach(p => console.log(`   id=${p.id} publishedAt=${p.publishedAt?.toISOString()} productId=${p.productId} retries=${p.retryCount}`));
    }
  });
  console.log(`\nTotal duplicate groups: ${dupCount}`);

  // Group by productId
  console.log("\n=== POSTS PER PRODUCT ===");
  const byProduct = {};
  posts.forEach(p => { byProduct[p.productId] = (byProduct[p.productId] || 0) + 1; });
  Object.entries(byProduct).forEach(([pid, n]) => { if (n > 1) console.log(`product ${pid} -> ${n} published posts`); });
}

main().finally(() => prisma.$disconnect());
