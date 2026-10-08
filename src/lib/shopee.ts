/**
 * Shopee product metadata resolver.
 * Resolves Shopee short links, extracts shopId/itemId from the redirected URL,
 * then fetches product details via Shopee public API.
 */

export interface ShopeeScrapeResult {
  name?: string;
  price?: string;
  imageUrl?: string;
  platform?: "SHOPEE" | "TIKTOK" | "TOKOPEDIA" | "UNKNOWN";
}

function formatPrice(value: number | string | undefined): string {
  if (value == null) return "";
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) return String(value);
  return num.toLocaleString("id-ID");
}

function extractIdsFromRedirectUrl(url: string): { shopId?: string; itemId?: string } | null {
  try {
    const u = new URL(url);
    // Full product URL: https://shopee.co.id/<slug>/<shopid>/<itemid>?...
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 3) {
      const shopId = parts[parts.length - 2];
      const itemId = parts[parts.length - 1];
      if (/^\d+$/.test(shopId) && /^\d+$/.test(itemId)) {
        return { shopId, itemId };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function scrapeShopeePage(url: string): Promise<ShopeeScrapeResult> {
  try {
    // Step 1: Resolve short link to full product URL and extract og:image in case API fails.
    const headRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "id-ID,id;q=0.9",
      },
      redirect: "follow",
    });

    const finalUrl = headRes.url || url;
    const html = await headRes.text();

    let ogTitle = "";
    let ogImage = "";
    if (html && html.length > 100) {
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      ogTitle = ogTitleMatch ? ogTitleMatch[1] : "";
      ogImage = ogImageMatch ? ogImageMatch[1] : "";
    }

    // Step 2: Try public Shopee API to get accurate name/price/image.
    const ids = extractIdsFromRedirectUrl(finalUrl);
    if (ids?.itemId && ids.shopId) {
      const apiUrl = `https://shopee.co.id/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`;
      const apiRes = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Referer": `https://shopee.co.id/product-${ids.shopId}-${ids.itemId}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      const data = await apiRes.json();
      if (data?.data) {
        const item = data.data;
        // image field can be a hash or direct CDN path
        const imgHash = item.image || item.item_image || (item.images && item.images[0]);
        let imageUrl: string | undefined;
        if (imgHash) {
          imageUrl = imgHash.startsWith("http") ? imgHash : `https://cf.shopee.co.id/file/${imgHash}`;
        }
        // price from API is in smallest currency unit (e.g. 1489740000 -> 148974)
        let rawPrice = item.price?.toString();
        if (rawPrice && rawPrice.length > 5) {
          rawPrice = rawPrice.slice(0, -5);
        }
        return {
          name: item.name || item.item_name || ogTitle.replace(/^Jual\s+/i, "").trim(),
          price: formatPrice(rawPrice || item.price_min || item.price),
          imageUrl: imageUrl || ogImage,
          platform: "SHOPEE",
        };
      }
    }

    // Fallback to og tags only
    if (ogImage) {
      return {
        name: ogTitle.replace(/^Jual\s+/i, "").trim(),
        imageUrl: ogImage,
        platform: "SHOPEE",
      };
    }

    return { platform: "SHOPEE" };
  } catch (err) {
    console.warn("[SCRAPE] Failed to fetch Shopee page:", err);
    return { platform: "SHOPEE" };
  }
}

/**
 * Scrapes metadata from TikTok Shop product / showcase links.
 * Supports: vt.tiktok.com, shop.tiktok.com, tiktok.com/@user/live, etc.
 */
export async function scrapeTikTokShop(url: string): Promise<ShopeeScrapeResult> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: "follow",
    });

    const finalUrl = res.url || url;
    const html = await res.text();
    
    let name = "";
    let imageUrl = "";
    let price = "";

    // 1. Try Open Graph tags
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);

    if (ogTitle?.[1]) {
      name = ogTitle[1].replace(/\|\s*TikTok(\s*Shop)?/i, "").trim();
    }
    if (ogImage?.[1]) {
      imageUrl = ogImage[1];
    }

    // 2. Try JSON-LD schema if present
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch?.[1]) {
      try {
        const parsedLd = JSON.parse(jsonLdMatch[1]);
        if (parsedLd.name && !name) name = parsedLd.name;
        if (parsedLd.image && !imageUrl) {
          imageUrl = Array.isArray(parsedLd.image) ? parsedLd.image[0] : parsedLd.image;
        }
        if (parsedLd.offers?.price) {
          price = formatPrice(parsedLd.offers.price);
        }
      } catch {
        // ignore json parse error
      }
    }

    // 3. Fallback: Search for price pattern in HTML or Description (e.g. Rp 45.000)
    if (!price && ogDesc?.[1]) {
      const priceMatch = ogDesc[1].match(/(?:Rp|IDR)\s*([\d.,]+)/i);
      if (priceMatch?.[1]) {
        price = priceMatch[1].trim();
      }
    }

    return {
      name: name || "Produk TikTok Shop",
      price: price || "",
      imageUrl: imageUrl || undefined,
      platform: "TIKTOK",
    };
  } catch (err: any) {
    console.warn("[TIKTOK SCRAPER] Error scraping TikTok Shop link:", err.message);
    return { platform: "TIKTOK" };
  }
}

/**
 * Universal Marketplace Scraper router (detects Shopee vs TikTok Shop).
 */
export async function scrapeMarketplaceProduct(url: string): Promise<ShopeeScrapeResult> {
  if (/tiktok\.com/i.test(url)) {
    return scrapeTikTokShop(url);
  }
  return scrapeShopeePage(url);
}
