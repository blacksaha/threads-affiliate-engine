/**
 * Lightweight Shopee page scraper to extract product metadata.
 * Mimics a social bot user-agent to bypass basic anti-bot.
 */
export async function scrapeShopeePage(url: string): Promise<{
  name?: string;
  price?: string;
  imageUrl?: string;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "facebookexternalhit/1.1; TelegramBot (like TwitterBot)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });

    const html = await res.text();
    if (!html || html.length < 100) return {};

    // Extract og:title
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogTitle = ogTitleMatch ? ogTitleMatch[1] : "";

    // Extract og:image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    const ogImage = ogImageMatch ? ogImageMatch[1] : "";

    // Extract price from JSON-LD or fallback patterns
    let price = "";
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const json = JSON.parse(jsonLdMatch[1]);
        const offers = json.offers || (Array.isArray(json) && json[0]?.offers);
        if (offers && offers.price) {
          price = String(offers.price);
        }
      } catch {
        // ignore
      }
    }

    return {
      name: ogTitle.replace(/^Jual\s+/i, "").trim(),
      price,
      imageUrl: ogImage,
    };
  } catch (err) {
    console.warn("[SCRAPE] Failed to fetch Shopee page:", err);
    return {};
  }
}
