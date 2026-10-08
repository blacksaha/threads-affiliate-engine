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
    console.log(`[SHOPEE SCRAPER] Starting to resolve: ${url}...`);

    // Step 1: Follow redirects AND extract OG tags from the FINAL page (as backup)
    const headRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "id-ID,id;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000), // Max 8s for redirect resolution
    });

    const finalUrl = headRes.url || url;
    const html = await headRes.text();
    
    const elapsed = Date.now() - startTime;
    console.log(`[SHOPEE SCRAPER] Redirect followed in ${elapsed}ms. Final URL: ${finalUrl}`);

    let ogTitle = "";
    let ogImage = "";
    if (html && html.length > 100) {
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      ogTitle = ogTitleMatch ? ogTitleMatch[1] : "";
      ogImage = ogImageMatch ? ogImageMatch[1] : "";
    }

    // Step 2: Extract shopId & itemId from the FINAL resolved URL (NOT short one)
    const ids = extractIdsFromRedirectUrl(finalUrl);
    
    // Step 3: Fetch the Canonical Product page using Facebook Crawler UA
    // Shopee ALWAYS renders rich OpenGraph tags (real product photo & title) for social crawlers!
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

        // Check that it is NOT the generic homepage title or generic logo
        const isGenericTitle = !realTitle || realTitle.includes("Situs Belanja Online Terlengkap");
        const isGenericImage = !realImage || realImage.includes("ios_icon") || realImage.includes("splash_screen");

        if (!isGenericTitle && !isGenericImage) {
          const cleanName = cleanTitleFromOG(realTitle);
          console.log(`[SHOPEE SCRAPER SUCCESS] Social OG Scraped: ${cleanName} | Image: ${realImage}`);
          return {
            name: cleanName,
            price: "Cek Promo",
            imageUrl: realImage,
            platform: "SHOPEE",
          };
        }
      } catch (e: any) {
        console.warn("[SHOPEE SCRAPER] Social crawler fetch failed:", e.message);
      }
    }

    // Step 4: Fallback to OG tags ONLY if API fails and NOT generic Shopee homepage
    if (ogImage && ogTitle && !ogTitle.includes("Situs Belanja Online Terlengkap") && !ogImage.includes("ios_icon")) {
      const elapsedFallback = Date.now() - startTime;
      console.log(`[SHOPEE SCRAPER] Using OG tag fallback after ${elapsedFallback}ms`);
      return {
        name: cleanTitleFromOG(ogTitle),
        price: "Cek Promo",
        imageUrl: ogImage,
        platform: "SHOPEE",
      };
    }

    // Step 5: Ultimate fallback
    const totalElapsed = Date.now() - startTime;
    console.log(`[SHOPEE SCRAPER] Total time: ${totalElapsed}ms. Returning empty result.`);
    return { platform: "SHOPEE", name: "", price: "", imageUrl: "" };
  } catch (err: any) {
    const totalElapsed = Date.now() - startTime;
    console.warn(`[SHOPEE SCRAPER ERROR] After ${totalElapsed}ms:`, err.message);
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
