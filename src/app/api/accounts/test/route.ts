import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  try {
    const { id } = await request.json();
    const account = await prisma.socialAccount.findUnique({ where: { id } });

    if (!account || account.userId !== userId) {
      return NextResponse.json({ success: false, error: "Akun tidak ditemukan atau bukan milik Anda." }, { status: 404 });
    }

    // 1. Test THREADS
    if (account.platform === "THREADS") {
      const res = await fetch(`https://graph.threads.net/v1.0/me?access_token=${account.accessToken}&fields=id,username,name`);
      const data = await res.json();
      if (data.id) {
        return NextResponse.json({
          success: true,
          message: `Terhubung dengan Threads: @${data.username || data.name || data.id}`
        });
      }
      return NextResponse.json({
        success: false,
        error: data.error?.message || JSON.stringify(data)
      });
    }

    // 2. Test FACEBOOK PAGE
    if (account.platform === "FACEBOOK") {
      const res = await fetch(`https://graph.facebook.com/v19.0/${account.accountId}?access_token=${account.accessToken}&fields=id,name`);
      const data = await res.json();
      if (data.id) {
        return NextResponse.json({
          success: true,
          message: `Terhubung dengan Page: ${data.name} (ID: ${data.id})`
        });
      }
      return NextResponse.json({
        success: false,
        error: data.error?.message || JSON.stringify(data)
      });
    }

    // 3. Test X (Twitter)
    if (account.platform === "X") {
      // Check if it's an OAuth 2.0 User Bearer token
      const res = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${account.accessToken}` }
      });
      const data = await res.json();
      if (data.data?.username) {
        return NextResponse.json({
          success: true,
          message: `Terhubung dengan X: @${data.data.username}`
        });
      }

      // If failed, explain clearly
      return NextResponse.json({
        success: false,
        error: data.detail || "Token X tidak valid atau memerlukan OAuth 1.0a (API Key + Secret)."
      });
    }

    return NextResponse.json({ success: false, error: "Platform belum didukung untuk tes." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
