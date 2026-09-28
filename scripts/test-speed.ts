import { PrismaClient } from '@prisma/client';
import { runProductPipeline } from '../src/lib/pipeline';

const prisma = new PrismaClient();

async function run() {
  const t0 = Date.now();
  console.log("Starting pipeline for Cetakan Es Batu Tekan...");
  const res = await runProductPipeline('fd494775-af1e-4caf-9d37-0d8d81a4b25b', 'admin_initial_id');
  const elapsed = (Date.now() - t0) / 1000;
  console.log(`Finished in ${elapsed}s! Success:`, res.success);
  if (res.post) {
    console.log("Hook:", res.post.hook);
  }
}

run().finally(() => prisma.$disconnect());
