require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFb() {
  const acc = await prisma.socialAccount.findFirst({
    where: { platform: 'FACEBOOK', isActive: true, userId: 'admin_initial_id' }
  });

  if (!acc) return console.log("No FB account");

  const pageId = acc.accountId;
  const accessToken = acc.accessToken;
  const message = "Test Photo Post for comment checking";
  const imageUrl = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop";
  const commentLink = "https://shopee.co.id/test";

  console.log("1. Publishing photo...");
  const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      url: imageUrl,
      caption: message,
      access_token: accessToken,
    }),
  });

  const data = await res.json();
  console.log("Photo Response:", data);

  const createdPostId = data.post_id || data.id;

  if (createdPostId) {
    console.log("2. Adding comment to", createdPostId, "...");
    const commentRes = await fetch(`https://graph.facebook.com/v19.0/${createdPostId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: `Beli di sini: ${commentLink}`,
        access_token: accessToken,
      }),
    });
    const cData = await commentRes.json();
    console.log("Comment Response:", cData);
  }
}

testFb().finally(() => prisma.$disconnect());
