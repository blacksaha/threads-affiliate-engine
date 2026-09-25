import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const settings = await prisma.automationSettings.upsert({
    where: { userId },
    update: {},
    create: { id: userId + '_settings', userId },
  });
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json();
  const settings = await prisma.automationSettings.upsert({
    where: { userId },
    update: { ...body },
    create: { id: userId + '_settings', userId, ...body },
  });
  return NextResponse.json(settings);
}
