import { prisma } from './prisma';
import type { AIGatewayConfig, CallGeminiOptions } from './gemini';

/**
 * Builds the AI options used by every generation call.
 *
 * Sources, in order of precedence:
 *  1. User's multi-gateway list (AIGatewayKey) — the primary source when the
 *     user configured at least one active key in Settings.
 *  2. Legacy single-key fields on AutomationSettings (aiProvider/aiApiKey/...).
 *
 * The gateway list is always returned alongside the legacy fields so callGemini
 * can walk the gateways first and only fall back to the legacy/system keys when
 * every configured gateway fails.
 */
export async function buildAIConfig(userId: string): Promise<CallGeminiOptions> {
  const settings = await prisma.automationSettings.findUnique({ where: { userId } });

  const legacyFallback = settings?.aiFallbackModels
    ? settings.aiFallbackModels.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  let gateways: AIGatewayConfig[] = [];
  try {
    const rows = await prisma.aIGatewayKey.findMany({
      where: { userId, isActive: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    gateways = rows.map((r) => ({
      id: r.id,
      name: r.name,
      provider: r.provider,
      apiKey: r.apiKey,
      baseUrl: r.baseUrl,
      modelName: r.modelName,
      priority: r.priority,
      isActive: r.isActive,
    }));
  } catch (err) {
    console.warn('[AI CONFIG] Could not load gateway keys:', err);
  }

  return {
    gateways,
    provider: settings?.aiProvider || 'GEMINI',
    apiKey: settings?.aiApiKey || null,
    baseUrl: settings?.aiBaseUrl || null,
    modelName: settings?.aiModel || null,
    fallbackModels: legacyFallback,
  };
}
