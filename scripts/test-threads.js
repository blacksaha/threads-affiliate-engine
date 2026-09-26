const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testThreadsApi() {
  const settings = await prisma.automationSettings.findFirst();
  const userId = settings.threadsUserId;
  const token = settings.threadsAccessToken;
  
  console.log(`User ID: ${userId}, Token: ${token?.substring(0,10)}...`);

  // Step 1: Create Container
  console.log('Creating Threads container...');
  const createUrl = `https://graph.threads.net/v1.0/${userId}/threads?media_type=TEXT&text=${encodeURIComponent('Test manual API call from local script')}&access_token=${token}`;
  
  try {
    const createRes = await fetch(createUrl, { method: 'POST' });
    const createData = await createRes.json();
    console.log('Create Response:', createData);
    
    if (createData.id) {
      console.log('Publishing container:', createData.id);
      const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish?creation_id=${createData.id}&access_token=${token}`;
      const publishRes = await fetch(publishUrl, { method: 'POST' });
      const publishData = await publishRes.json();
      console.log('Publish Response:', publishData);
    }
  } catch(e) {
    console.error('Fetch error:', e);
  }
}

testThreadsApi().finally(() => prisma.$disconnect());