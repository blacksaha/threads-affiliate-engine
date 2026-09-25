import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const session = await auth();
  
  const { pathname } = request.nextUrl;
  
  // Rute API Publik yang tidak butuh login
  const cronSecret = process.env.CRON_SECRET || 'threads_affiliate_cron_secret_2026';
  const authHeader = request.headers.get('authorization');
  const isInternalSecret = authHeader === `Bearer ${cronSecret}`;

  const isPublicApi = isInternalSecret ||
                      pathname.startsWith('/api/telegram') || 
                      pathname.startsWith('/api/cron') ||
                      pathname.startsWith('/api/products/scrape'); // Diizinkan agar scraper bot bisa jalan
                      
  if (isPublicApi) return NextResponse.next();

  // Rute auth bypass
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    if (session && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Lindungi semua halaman dan API internal
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Jika login tapi mencoba mengakses halaman admin khusus
  if (pathname.startsWith('/admin') && (session.user as any).role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};