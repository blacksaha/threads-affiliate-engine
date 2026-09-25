import { NextResponse } from 'next/server';
import { runProductPipeline } from '@/lib/pipeline';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET || 'threads_affiliate_cron_secret_2026';
  const authHeader = request.headers.get('authorization');
  const isInternal = authHeader === `Bearer ${cronSecret}`;

  let userId: string;

  try {
    const body = await request.json();
    const { productId, theme } = body;

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    if (isInternal) {
      const prod = await prisma.product.findUnique({ where: { id: productId } });
      if (!prod) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      userId = prod.userId;
    } else {
      const session = await auth();
      if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      userId = session.user.id;

      // Verify ownership of product
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product || product.userId !== userId) {
        return NextResponse.json({ error: 'Product not found or not owned' }, { status: 404 });
      }
    }

    const result = await runProductPipeline(productId, userId, theme);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Pipeline execution failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const posts = await prisma.contentPost.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return NextResponse.json(posts);
}
