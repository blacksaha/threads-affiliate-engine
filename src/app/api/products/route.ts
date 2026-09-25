import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runProductPipeline } from '@/lib/pipeline';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const contentType = request.headers.get('content-type') || '';
  let name = '';
  let price = '';
  let affiliateUrl = '';
  let imageUrl = '';
  let theme = '';
  let isFormData = false;

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    isFormData = true;
    const formData = await request.formData();
    name = String(formData.get('name') || '');
    price = String(formData.get('price') || '');
    affiliateUrl = String(formData.get('affiliateUrl') || '');
    imageUrl = String(formData.get('imageUrl') || '');
    theme = String(formData.get('theme') || '');
  } else {
    const json = await request.json();
    name = json.name;
    price = json.price;
    affiliateUrl = json.affiliateUrl;
    imageUrl = json.imageUrl;
    theme = json.theme || '';
  }

  if (!name || !price || !affiliateUrl) {
    return NextResponse.json({ error: 'Name, price, and affiliateUrl are required' }, { status: 400 });
  }

  // 1. Create Product in DB with authenticated userId
  const product = await prisma.product.create({
    data: {
      userId,
      name,
      price,
      affiliateUrl,
      imageUrl: imageUrl || null,
    },
  });

  await prisma.systemLog.create({
    data: {
      userId,
      level: 'INFO',
      source: 'PRODUCT_INGEST',
      message: `Produk "${product.name}" diinput${theme ? ` (Tema: ${theme})` : ''}. Memicu autonomous pipeline...`,
      details: JSON.stringify({ productId: product.id, theme }),
    },
  });

  // 2. Run pipeline asynchronously (or await if JSON request)
  if (isFormData) {
    // For form submit, run in background and immediately redirect so UI doesn't hang
    runProductPipeline(product.id, userId, theme || undefined)
      .then((res) => console.log('[PIPELINE BG SUCCESS]', res))
      .catch((err) => console.error('[PIPELINE BG ERROR]', err));

    return NextResponse.redirect(new URL('/', request.url));
  } else {
    const res = await runProductPipeline(product.id, userId, theme || undefined);
    return NextResponse.json({ success: true, product, pipeline: res });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const products = await prisma.product.findMany({
    where: { userId },
    include: { posts: true, angles: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(products);
}
