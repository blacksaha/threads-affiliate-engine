async function main() {
  const res = await fetch('https://s.shopee.co.id/3LRA2oMwbh?share_channel_code=2', {
    headers: {
      "User-Agent": "facebookexternalhit/1.1; TelegramBot (like TwitterBot)",
      "Accept": "text/html",
    },
    redirect: "follow",
  });
  const html = await res.text();
  console.log("status:", res.status);
  console.log("len:", html.length);
  console.log("first og:image:", html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1]);
  console.log("first og:title:", html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]);
}
main().catch(console.error);
