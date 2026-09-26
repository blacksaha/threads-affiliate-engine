import { prisma } from '../src/lib/prisma';
import { publishThreadChain } from '../src/lib/threads';

async function testThreads() {
  const settings = await prisma.automationSettings.findFirst({
    where: { userId: 'admin_initial_id' }
  });

  if (!settings?.threadsAccessToken || !settings?.threadsUserId) {
    console.log("No token or user id");
    return;
  }

  console.log("1. Got token & user ID. Testing direct Threads publish...");
  
  const chain = [
    "Test post dari API CLI (1/2)",
    "Ini adalah reply dari post test API (2/2)"
  ];

  console.log("2. Sending payload to Threads API via publishThreadChain...");
  
  try {
    const result = await publishThreadChain(
      settings.threadsUserId,
      settings.threadsAccessToken,
      chain,
      null
    );
    console.log("3. Publish Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("3. Crash Error:", err);
  }
  
  await prisma.$disconnect();
}

testThreads();