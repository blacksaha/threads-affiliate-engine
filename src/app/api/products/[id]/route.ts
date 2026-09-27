import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { runProductPipeline } from '@/lib/pipeline';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (product.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prisma cascade deletes content angles & posts
    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Produk berhasil dihapus.' });
  } catch (error: any) {
    console.error('[DELETE PRODUCT ERROR]', error);
    return NextResponse.json({ error: error.message || 'Gagal menghapus produk' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (product.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await runProductPipeline(product.id, session.user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[GENERATE PRODUCT THREAD ERROR]', error);
    return NextResponse.json({ success: false, reason: error.message || 'Gagal generate utas' }, { status: 500 });
  }
}
