async function test() {
  const res = await fetch('https://s.shopee.co.id/3LRA2oMwbh?share_channel_code=2', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'id-ID,id;q=0.9',
    },
    redirect: 'follow'
  });
  const html = await res.text();
  console.log('URL:', res.url);
  console.log('Length:', html.length);
  const m = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  console.log('og:image:', m ? m[1] : 'NONE');
  const t = html.match(/<title>([^<]+)<\/title>/i);
  console.log('title:', t ? t[1] : 'NONE');
}
test().catch(console.error);
