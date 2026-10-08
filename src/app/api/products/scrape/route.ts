import { NextResponse } from 'next/server';
import { scrapeMarketplaceProduct } from '@/lib/shopee';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ success: false, error: 'URL tidak valid.' }, { status: 400 });
    }

    const scraped = await scrapeMarketplaceProduct(url);

    return NextResponse.json({
      success: true,
      data: {
        name: scraped.name || '',
        price: scraped.price || 'Cek Promo',
        imageUrl: scraped.imageUrl || '',
      }
    });

  } catch (error: any) {
    console.error('[SCRAPE API ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
