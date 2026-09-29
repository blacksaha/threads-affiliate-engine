import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ success: true, accounts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  try {
    const body = await request.json();
    const { platform, name, accountId, accessToken, refreshToken } = body;

    if (!platform || !accountId || !accessToken) {
      return NextResponse.json({ success: false, error: 'Platform, Account ID, dan Access Token wajib diisi.' }, { status: 400 });
    }

    let finalAccessToken = accessToken;

    // Untuk Facebook Page Access Token, coba extend ke Long-Lived Token jika App ID & App Secret tersedia
    if (platform === 'FACEBOOK') {
      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;
      if (appId && appSecret) {
        try {
          const exchangeRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`);
          const exchangeData = await exchangeRes.json();
          if (exchangeData.access_token) {
            finalAccessToken = exchangeData.access_token;
          }
        } catch (err) {
          console.warn('[FACEBOOK] Gagal extend token saat registrasi:', err);
        }
      }
    }

    const account = await prisma.socialAccount.create({
      data: {
        userId,
        platform,
        name: name || `${platform} Account`,
        accountId,
        accessToken: finalAccessToken,
        refreshToken: refreshToken || null,
        tokenExpiresAt: platform === 'X' ? new Date(Date.now() + 7100 * 1000) : null,
        isActive: true,
      }
    });

    return NextResponse.json({ success: true, account });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.socialAccount.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "Not found or not owned" }, { status: 404 });
    }

    await prisma.socialAccount.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
