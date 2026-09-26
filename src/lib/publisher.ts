import { prisma } from './prisma';
import { publishThreadChain } from './threads';

export interface MultiPlatformResult {
  threads?: { success: boolean; id?: string; error?: string };
  facebook?: { success: boolean; id?: string; error?: string };
  x?: { success: boolean; id?: string; error?: string };
}

/**
 * Publishes content to Facebook Page using Graph API
 */
export async function publishToFacebook(
  pageId: string,
  accessToken: string,
  message: string,
  imageUrl?: string | null,
  commentLink?: string | null
) {
  try {
    if (!pageId || !accessToken) {
      return { success: false, error: "Facebook Page ID atau Token belum diisi." };
    }

    let url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    const body: Record<string, string> = {
      message,
      access_token: accessToken,
    };

    if (imageUrl && imageUrl.startsWith("http")) {
      url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
      body.url = imageUrl;
      body.caption = message;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });

    const data = await res.json();
    const createdPostId = data.post_id || data.id;

    if (!createdPostId) {
      return { success: false, error: JSON.stringify(data) };
    }

    // 🎯 FASE 1: Post Affiliate Link in First Comment
    let commentId: string | undefined = undefined;
    if (commentLink) {
      try {
        // Beri jeda 3 detik agar FB selesai memproses gambar dan post ID tersedia di server mereka
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const commentMsg = `Beli di mana? Link produk promo official ada di sini ya kak: 👇\n${commentLink}`;
        const commentRes = await fetch(`https://graph.facebook.com/v19.0/${createdPostId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            message: commentMsg,
            access_token: accessToken,
          }),
        });
        const commentData = await commentRes.json();
        
        if (commentData.id) {
          commentId = commentData.id;
        } else {
          console.error("FB Comment Error Data:", JSON.stringify(commentData));
        }
      } catch (cErr) {
        console.error("Failed to post FB first comment:", cErr);
      }
    }

    return { success: true, id: createdPostId, commentId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Refreshes an expired X (Twitter) OAuth 2.0 Access Token using its Refresh Token
 */
export async function refreshXAccessToken(account: {
  id: string;
  accountId: string;
  refreshToken?: string | null;
}): Promise<string | null> {
  if (!account.refreshToken) return null;

  try {
    const clientId = process.env.TWITTER_CLIENT_ID || process.env.X_CLIENT_ID || account.accountId;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET || process.env.X_CLIENT_SECRET;

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (clientId && clientSecret) {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      headers["Authorization"] = `Basic ${basic}`;
    }

    const bodyParams = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
      client_id: clientId,
    });

    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers,
      body: bodyParams,
    });

    const data = await res.json();
    if (data.access_token) {
      const newExpires = new Date(Date.now() + (data.expires_in || 7200) * 1000);
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || account.refreshToken,
          tokenExpiresAt: newExpires,
        },
      });
      return data.access_token;
    } else {
      console.error("Gagal refresh token X:", JSON.stringify(data));
    }
  } catch (err) {
    console.error("Error refreshing X token:", err);
  }
  return null;
}

/**
 * Publishes content to X (Twitter) using Twitter API v2
 */
export async function publishToX(
  accessToken: string,
  text: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (!accessToken) {
      return { success: false, error: "Access token X belum diisi." };
    }

    // Twitter standard post endpoint (API v2)
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (data.data?.id) {
      return { success: true, id: data.data.id };
    }

    return {
      success: false,
      error: data.detail || data.title || JSON.stringify(data),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master Multi-Platform Dispatcher
 */
export async function publishToAllPlatforms(postId: string): Promise<MultiPlatformResult> {
  const post = await prisma.contentPost.findUnique({
    where: { id: postId },
    include: { product: true }
  });

  if (!post) {
    throw new Error("Post not found");
  }

  const results: MultiPlatformResult = {};
  const settings = await prisma.automationSettings.findUnique({ where: { userId: post.userId } });

  // 1. Publish to Primary Threads
  if (settings?.threadsUserId && settings?.threadsAccessToken) {
    let chain: string[] = [];
    try {
      const parsed = JSON.parse(post.content || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        chain = parsed;
      } else {
        chain = [post.hook || "", post.body || "", post.cta || ""].filter(Boolean);
      }
    } catch {
      chain = [post.hook || "", post.body || "", post.cta || ""].filter(Boolean);
    }
    const tRes = await publishThreadChain(
      settings.threadsUserId,
      settings.threadsAccessToken,
      chain,
      post.product?.imageUrl
    );
    results.threads = { success: tRes.success, id: tRes.publishedId, error: tRes.error };
  }

  // 2. Publish to Extra Connected Accounts (Multi-Threads / Facebook / X)
  const extraAccounts = await prisma.socialAccount.findMany({
    where: { userId: post.userId, isActive: true }
  });

  for (const acc of extraAccounts) {
    if (acc.platform === "THREADS") {
      let chain: string[] = [];
      try {
        const parsed = JSON.parse(post.content || "[]");
        if (Array.isArray(parsed) && parsed.length > 0) {
          chain = parsed;
        } else {
          chain = [post.hook || "", post.body || "", post.cta || ""].filter(Boolean);
        }
      } catch {
        chain = [post.hook || "", post.body || "", post.cta || ""].filter(Boolean);
      }
      await publishThreadChain(acc.accountId, acc.accessToken, chain, post.product?.imageUrl);
    } else if (acc.platform === "FACEBOOK") {
      const fbText = post.fbContent || `${post.hook}\n\n${post.body}\n\n${post.cta}`;
      const fbComment = post.fbComment || post.product?.affiliateUrl;
      const fbRes = await publishToFacebook(acc.accountId, acc.accessToken, fbText, post.product?.imageUrl, fbComment);
      results.facebook = fbRes;
    } else if (acc.platform === "X") {
      let activeToken = acc.accessToken;

      // Auto-refresh token jika mendekati kadaluarsa (sisa 5 menit) atau sudah expired
      if (
        acc.refreshToken &&
        acc.tokenExpiresAt &&
        new Date(acc.tokenExpiresAt).getTime() - Date.now() < 5 * 60 * 1000
      ) {
        const refreshed = await refreshXAccessToken(acc);
        if (refreshed) activeToken = refreshed;
      }

      // Prioritize explicit X content, fallback to generated blocks. Include Affiliate URL!
      let xText = post.xContent;
      if (!xText) {
        xText = `${post.hook}\n\n${post.cta}\n${post.product?.affiliateUrl || ""}`;
      }
      
      // Strict 280 character limit handling for X free tier
      if (xText.length > 280) {
        const linkStr = post.product?.affiliateUrl ? `\n${post.product.affiliateUrl}` : "";
        const maxLen = 280 - linkStr.length - 3;
        xText = xText.substring(0, maxLen) + "..." + linkStr;
      }

      const xRes = await publishToX(activeToken, xText);
      results.x = xRes;
    }
  }

  return results;
}
