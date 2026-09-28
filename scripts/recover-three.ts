import { PrismaClient } from '@prisma/client';
import { runProductPipeline } from '../src/lib/pipeline';

const prisma = new PrismaClient();

async function run() {
  const ids = [
    'efaae1f1-142e-4222-aaba-203f3187145e', // YAWANG
    '2fc5636d-f154-4f96-ad17-33b8c10f2796', // LUCKY STAR
    'fd494775-af1e-4caf-9d37-0d8d81a4b25b', // Cetakan Es Batu
  ];

  for (const id of ids) {
    const p = await prisma.product.findUnique({ where: { id } });
    console.log(`\n=== Running for: ${p?.name} ===`);
    try {
      const res = await runProductPipeline(id, p?.userId || 'admin_initial_id');
      console.log('Result:', res.success ? 'SUCCESS' : 'FAILED', res);
    } catch (e: any) {
      console.error('Error:', e.message);
    }
  }
}

run().finally(() => prisma.$disconnect());
