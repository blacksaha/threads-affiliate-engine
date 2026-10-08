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
  const startTime = Date.now();

  try {
    console.log(`[SHOPEE SCRAPER] Resolving short link: ${url}...`);

    // Step 1: Follow manual redirect to reliably grab the Location header
    let targetUrl = url;
    try {
      const initRes = await fetch(url, {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(6000),
      });

      const loc = initRes.headers.get("location");
      if (loc) {
        targetUrl = loc.startsWith("http") ? loc : new URL(loc, "https://shopee.co.id").toString();
      } else {
        const text = await initRes.text();
        const aMatch = text.match(/<a[^>]+href=["']([^"']+)["']/i);
        if (aMatch?.[1]) {
          targetUrl = aMatch[1].startsWith("http") ? aMatch[1] : new URL(aMatch[1], "https://shopee.co.id").toString();
        }
      }
    } catch (e: any) {
      console.warn("[SHOPEE SCRAPER] Redirect check failed:", e.message);
    }

    console.log(`[SHOPEE SCRAPER] Target URL after redirect: ${targetUrl}`);

    // Step 2: Extract shopId & itemId from the resolved URL
    const ids = extractIdsFromRedirectUrl(targetUrl);

    // Step 3: Fetch Canonical Product page via Social Crawler UA (facebookexternalhit)
    // Shopee's SSR server ALWAYS renders the real product title and high-res image for crawlers!
    if (ids?.itemId && ids.shopId) {
      console.log(`[SHOPEE SCRAPER] Extracted ShopID=${ids.shopId}, ItemID=${ids.itemId}`);
      const canonicalUrl = `https://shopee.co.id/product/${ids.shopId}/${ids.itemId}`;

      try {
        const socialRes = await fetch(canonicalUrl, {
          headers: {
            "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
          },
          signal: AbortSignal.timeout(6000),
        });

        const socialHtml = await socialRes.text();
        const socialTitleMatch = socialHtml.match(/<meta[^>]+(?:property=["']og:title["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+property=["']og:title["'])/i);
        const socialImageMatch = socialHtml.match(/<meta[^>]+(?:property=["']og:image["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+property=["']og:image["'])/i);

        const realTitle = socialTitleMatch ? (socialTitleMatch[1] || socialTitleMatch[2]) : "";
        const realImage = socialImageMatch ? (socialImageMatch[1] || socialImageMatch[2]) : "";

        const isGenericTitle = !realTitle || realTitle.includes("Situs Belanja Online Terlengkap");
        const isGenericImage = !realImage || realImage.includes("ios_icon") || realImage.includes("splash_screen");

        if (!isGenericTitle && !isGenericImage) {
          const cleanName = cleanTitleFromOG(realTitle);
          console.log(`[SHOPEE SCRAPER SUCCESS] Scraped: "${cleanName}" | Image: ${realImage}`);
          return {
            name: cleanName,
            price: "Cek Promo",
            imageUrl: realImage,
            platform: "SHOPEE",
          };
        }
      } catch (e: any) {
        console.warn("[SHOPEE SCRAPER] Social fetch failed:", e.message);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[SHOPEE SCRAPER] Completed in ${elapsed}ms without specific product metadata.`);
    return { platform: "SHOPEE", name: "", price: "Cek Promo", imageUrl: "" };
  } catch (err: any) {
    console.warn(`[SHOPEE SCRAPER FATAL]`, err.message);
    return { platform: "SHOPEE" };
  }
}

function cleanTitleFromOG(title: string): string {
  return title
    .replace(/^Jual\s+/i, "")
    .replace(/\|\s*Shopee\s*Indonesia.*$/i, "")
    .trim();
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
