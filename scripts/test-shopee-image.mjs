async function scrapeShopeePage(url) {
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
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  const ogImage = ogImageMatch ? ogImageMatch[1] : "";
  console.log("finalUrl:", finalUrl);
  console.log("ogImage:", ogImage);
}
scrapeShopeePage("https://s.shopee.co.id/5fp5orbQWs?share_channel_code=2");
