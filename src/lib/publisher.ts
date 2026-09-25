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
      chain = JSON.parse(post.content || "[]");
    } catch {
      chain = [post.hook || "", post.body || "", post.cta || ""];
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
        chain = JSON.parse(post.content || "[]");
      } catch {
        chain = [post.hook || "", post.body || "", post.cta || ""];
      }
      await publishThreadChain(acc.accountId, acc.accessToken, chain, post.product?.imageUrl);
    } else if (acc.platform === "FACEBOOK") {
      const fbText = post.fbContent || `${post.hook}\n\n${post.body}\n\n${post.cta}`;
      const fbComment = post.fbComment || post.product?.affiliateUrl;
      const fbRes = await publishToFacebook(acc.accountId, acc.accessToken, fbText, post.product?.imageUrl, fbComment);
      results.facebook = fbRes;
    }
  }

  return results;
}
