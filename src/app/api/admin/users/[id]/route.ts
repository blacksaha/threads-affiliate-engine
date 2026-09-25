import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if ((session.user as any).role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

// PATCH: update status / role / reset password
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const { id } = await params;
  try {
    const body = await request.json();
    const data: any = {};

    if (body.status) data.status = body.status;
    if (body.role) data.role = body.role;
    if (body.name !== undefined) data.name = body.name;

    if (body.newPassword) {
      data.password = await bcrypt.hash(String(body.newPassword), 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: remove a user (and their tenant data)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const { id } = await params;
  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    if (target.role === "ADMIN") {
      return NextResponse.json({ success: false, error: "Tidak bisa menghapus akun ADMIN." }, { status: 400 });
    }

    // Clean up tenant data
    await prisma.schedulerJob.deleteMany({ where: { userId: id } });
    await prisma.contentPost.deleteMany({ where: { userId: id } });
    await prisma.contentAngle.deleteMany({ where: { product: { userId: id } } });
    await prisma.product.deleteMany({ where: { userId: id } });
    await prisma.socialAccount.deleteMany({ where: { userId: id } });
    await prisma.systemLog.deleteMany({ where: { userId: id } });
    await prisma.automationSettings.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
