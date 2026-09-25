export interface PublishResult {
  success: boolean;
  publishedId?: string;
  error?: string;
}

export async function publishThreadChain(
  userId: string,
  accessToken: string,
  chain: string[],
  imageUrl?: string | null
): Promise<PublishResult> {
  // Check if credentials exist or if we should run in Mock mode
  if (!userId || !accessToken || userId === "MOCK" || accessToken === "MOCK") {
    console.log("[MOCK THREADS PUBLISHER] Simulating publication of", chain.length, "posts");
    return {
      success: true,
      publishedId: `mock_post_${Date.now()}`,
    };
  }

  let replyToId: string | undefined = undefined;

  for (let i = 0; i < chain.length; i++) {
    const text = chain[i];
    const isImagePost = i === 2 && imageUrl && imageUrl.startsWith("http");

    try {
      // Step 1: Create Container
      const createUrl = `https://graph.threads.net/v1.0/${userId}/threads`;
      const createBody: Record<string, string> = {
        media_type: isImagePost ? "IMAGE" : "TEXT",
        text,
        access_token: accessToken,
      };

      if (isImagePost) {
        createBody.image_url = imageUrl;
      }
      if (replyToId) {
        createBody.reply_to_id = replyToId;
      }

      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(createBody),
      });

      const createData = await createRes.json();
      if (!createData.id) {
        return { success: false, error: `Container creation failed at post ${i + 1}: ${JSON.stringify(createData)}` };
      }

      const containerId = createData.id;
      // Wait 5 seconds for media processing
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Step 2: Publish Container
      const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish`;
      const publishRes = await fetch(publishUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: containerId,
          access_token: accessToken,
        }),
      });

      const publishData = await publishRes.json();
      if (!publishData.id) {
        return { success: false, error: `Publish container failed at post ${i + 1}: ${JSON.stringify(publishData)}` };
      }

      replyToId = publishData.id;
      // Natural interval between thread replies
      await new Promise((resolve) => setTimeout(resolve, 4000));
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return {
    success: true,
    publishedId: replyToId,
  };
}
