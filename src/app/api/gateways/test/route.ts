import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { provider, apiKey, baseUrl, modelName } = body;

  if (!provider || !apiKey) {
    return NextResponse.json({ error: 'Provider dan API Key wajib diisi!' }, { status: 400 });
  }

  const cleanKey = apiKey.trim();
  const startTime = Date.now();

  try {
    if (provider.toUpperCase() === 'GEMINI') {
      const model = (modelName || 'gemini-2.0-flash').trim();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Halo, balas satu kata "OK"' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
        signal: AbortSignal.timeout(12000),
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({
          success: false,
          error: `HTTP ${res.status}: ${errText.substring(0, 300)}`,
          latencyMs,
        }, { status: 200 });
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'OK';

      return NextResponse.json({
        success: true,
        message: `Koneksi Gemini (${model}) Berhasil! Respon: "${reply.trim()}"`,
        latencyMs,
      });
    } else {
      // DEEPSEEK, OPENAI, CUSTOM
      let base = (baseUrl || (provider.toUpperCase() === 'DEEPSEEK' ? 'https://api.deepseek.com' : 'https://api.openai.com/v1')).trim().replace(/\/+$/, '');
      const endpoint = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
      const model = (modelName || (provider.toUpperCase() === 'DEEPSEEK' ? 'deepseek-chat' : 'gpt-4o-mini')).trim();

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Halo, balas satu kata "OK"' }],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(12000),
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({
          success: false,
          error: `HTTP ${res.status}: ${errText.substring(0, 300)}`,
          latencyMs,
        }, { status: 200 });
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'OK';

      return NextResponse.json({
        success: true,
        message: `Koneksi Gateway (${model}) Berhasil! Respon: "${reply.trim()}"`,
        latencyMs,
      });
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      error: `Gagal terhubung (${err.name || 'Error'}): ${err.message}`,
      latencyMs,
    }, { status: 200 });
  }
}
