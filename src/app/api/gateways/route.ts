import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === 'true';

  try {
    const keys = await prisma.aIGatewayKey.findMany({
      where: {
        userId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(keys);
  } catch (err: unknown) {
    console.error('[AI GATEWAY LIST ERROR]', err);
    return NextResponse.json({ error: 'Gagal mengambil daftar API Key', details: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Format data JSON tidak valid' }, { status: 400 });
  }

  const {
    name,
    provider,
    apiKey,
    baseUrl,
    modelName,
    modelType,
    metadata,
    priority,
    isActive,
  } = body;

  if (!name || !provider || !apiKey) {
    return NextResponse.json(
      { error: 'Nama gateway, Provider, dan API Key wajib diisi!' },
      { status: 400 }
    );
  }

  const validProviders = ['GEMINI', 'DEEPSEEK', 'OPENAI', 'CUSTOM'];
  if (!validProviders.includes(provider.toUpperCase())) {
    return NextResponse.json(
      { error: `Provider tidak valid. Pilih salah satu: ${validProviders.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const key = await prisma.aIGatewayKey.create({
      data: {
        userId,
        name: name.trim(),
        provider: provider.toUpperCase(),
        apiKey: apiKey.trim(),
        baseUrl: baseUrl ? baseUrl.trim() : null,
        modelName: modelName ? modelName.trim() : (provider.toUpperCase() === 'GEMINI' ? 'gemini-2.0-flash' : 'deepseek-chat'),
        modelType: modelType || 'chat',
        metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
        priority: typeof priority === 'number' ? priority : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json(key, { status: 201 });
  } catch (err: unknown) {
    console.error('[AI GATEWAY CREATE ERROR]', err);
    return NextResponse.json({ error: 'Gagal menambahkan gateway API Key', details: String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Format data JSON tidak valid' }, { status: 400 });
  }

  const { id, name, provider, apiKey, baseUrl, modelName, modelType, metadata, priority, isActive } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID gateway wajib disertakan' }, { status: 400 });
  }

  const existingKey = await prisma.aIGatewayKey.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existingKey || existingKey.userId !== userId) {
    return NextResponse.json({ error: 'Gateway tidak ditemukan atau akses ditolak' }, { status: 404 });
  }

  try {
    const data: any = {};
    if (name) data.name = name.trim();
    if (provider) data.provider = provider.toUpperCase();
    if (apiKey) data.apiKey = apiKey.trim();
    if (baseUrl !== undefined) data.baseUrl = baseUrl ? baseUrl.trim() : null;
    if (modelName !== undefined) data.modelName = modelName ? modelName.trim() : '';
    if (modelType !== undefined) data.modelType = modelType;
    if (metadata !== undefined) data.metadata = metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null;
    if (priority !== undefined) data.priority = Number(priority);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.aIGatewayKey.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error('[AI GATEWAY UPDATE ERROR]', err);
    return NextResponse.json({ error: 'Gagal memperbarui gateway API Key', details: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID gateway wajib disertakan' }, { status: 400 });
  }

  const existingKey = await prisma.aIGatewayKey.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existingKey || existingKey.userId !== userId) {
    return NextResponse.json({ error: 'Gateway tidak ditemukan atau akses ditolak' }, { status: 404 });
  }

  try {
    await prisma.aIGatewayKey.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[AI GATEWAY DELETE ERROR]', err);
    return NextResponse.json({ error: 'Gagal menghapus gateway API Key', details: String(err) }, { status: 500 });
  }
}
