import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const current = await prisma.automationSettings.findUnique({
    where: { userId },
  });

  const nextState = current ? !current.enabled : true;

  const updated = await prisma.automationSettings.upsert({
    where: { userId },
    update: { enabled: nextState },
    create: { id: userId + '_settings', userId, enabled: nextState },
  });

  await prisma.systemLog.create({
    data: {
      userId,
      level: 'INFO',
      source: 'AUTOMATION_TOGGLE',
      message: `User toggled automation state to: ${nextState ? 'ACTIVE' : 'PAUSED'}.`,
    },
  });

  return NextResponse.json({ success: true, enabled: updated.enabled });
}
