/**
 * Converts a stored product image URL into a URL that third-party platforms
 * (Threads / Facebook / Instagram Graph API) are able to fetch.
 *
 * Telegram's file endpoint requires the bot token and is therefore NOT a public
 * URL: any social platform asked to download it fails with
 * "Media download has failed. The media URI doesn't meet our requirements."
 * Those images are instead served through our own public proxy route.
 */

const TELEGRAM_FILE_HOST = "api.telegram.org/file/";

export function isTelegramFileUrl(imageUrl?: string | null): boolean {
  return !!imageUrl && imageUrl.includes(TELEGRAM_FILE_HOST);
}

export function getPublicImageUrl(
  imageUrl: string | null | undefined,
  productId?: string | null,
  baseUrl?: string | null
): string | null {
  if (!imageUrl) return null;

  if (!isTelegramFileUrl(imageUrl)) {
    return imageUrl;
  }

  // Without a product id we cannot route to the proxy entry point.
  if (!productId) {
    console.warn("[PUBLIC IMAGE] Telegram image has no product id; skipping image.");
    return null;
  }

  const origin =
    baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://threads-affiliate-engine.vercel.app";

  return `${origin.replace(/\/$/, "")}/api/media/${productId}`;
}