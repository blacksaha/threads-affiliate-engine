import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public media proxy.
 *
 * Telegram photo URLs embed the bot token and are not publicly fetchable, which
 * is why Threads/Facebook rejected them with
 * "The media could not be fetched from this URI".
 *
 * This route re-serves the stored image from a plain public URL
 * (/api/media/<productId>) so downstream publishing platforms can download it.
 * It is intentionally unauthenticated: the platforms fetch it anonymously.
 */

export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { imageUrl: true },
  });

  const imageUrl = product?.imageUrl;
  if (!imageUrl) {
    return new NextResponse("No image for this product", { status: 404 });
  }

  // A plain public URL: let the platform fetch it directly (cheaper, cached).
  if (!imageUrl.includes("api.telegram.org/file/")) {
    return NextResponse.redirect(imageUrl, 302);
  }

  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok || !res.body) {
      console.warn(`[MEDIA PROXY] Upstream returned ${res.status} for product ${productId}`);
      return new NextResponse("Image unavailable from Telegram", { status: 502 });
    }

    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err: unknown) {
    console.error("[MEDIA PROXY ERROR]", err);
    return new NextResponse("Image fetch failed", { status: 502 });
  }
}