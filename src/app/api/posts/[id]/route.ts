import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runProductPipeline } from "@/lib/pipeline";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, scheduledAt, hook, body: postBody, cta } = body;

    const dataToUpdate: Record<string, unknown> = {};
    if (status !== undefined) dataToUpdate.status = status;
    if (scheduledAt !== undefined) dataToUpdate.scheduledAt = new Date(scheduledAt);
    if (hook !== undefined) dataToUpdate.hook = hook;
    if (postBody !== undefined) dataToUpdate.body = postBody;
    if (cta !== undefined) dataToUpdate.cta = cta;

    const updated = await prisma.contentPost.update({
      where: { id },
      data: dataToUpdate,
    });

    // If scheduledAt changed, also update the SchedulerJob
    if (scheduledAt !== undefined) {
      await prisma.schedulerJob.updateMany({
        where: { contentId: id },
        data: { scheduledAt: new Date(scheduledAt) },
      });
    }

    // If cancelled, update job status
    if (status === "CANCELLED") {
      await prisma.schedulerJob.updateMany({
        where: { contentId: id },
        data: { status: "CANCELLED" },
      });
    }

    return NextResponse.json({ success: true, post: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update post" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.contentPost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete post" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const post = await prisma.contentPost.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Trigger regeneration for this product
    const res = await runProductPipeline(post.productId);
    return NextResponse.json({ success: true, result: res });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to regenerate" },
      { status: 500 }
    );
  }
}
