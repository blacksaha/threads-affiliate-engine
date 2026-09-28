import { PrismaClient } from '@prisma/client';
import { runProductPipeline } from '../src/lib/pipeline';

const prisma = new PrismaClient();

async function run() {
  const t0 = Date.now();
  console.log("Recovering LUCKY STAR...");
  const res = await runProductPipeline('2fc5636d-f154-4f96-ad17-33b8c10f2796', 'admin_initial_id');
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s. Success:`, res.success, res.reason || '');
}

run().finally(() => prisma.$disconnect());
