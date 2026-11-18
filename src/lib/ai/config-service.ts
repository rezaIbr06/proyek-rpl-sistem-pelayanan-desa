import prisma from '@/lib/db';
import { DEFAULT_AI_CONFIG, DEFAULT_SYSTEM_PROMPT, SUPPORTED_PROVIDERS } from './constants';
import { decryptApiKey, encryptApiKey, maskApiKey } from './crypto';
import { getProviderAdapter } from './providers';
import { AIAdminViewData, AIConfigData, ConnectionTestResult } from './types';

/**
 * Retrieves the active AI Configuration.
 * Auto-initializes the configuration and initial credential if none exist yet.
 */
export async function getActiveAIConfig(): Promise<AIConfigData> {
  let config = await prisma.aIConfiguration.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (!config) {
    // Auto-seed default configuration
    config = await prisma.aIConfiguration.create({
      data: {
        provider: DEFAULT_AI_CONFIG.provider,
        modelId: DEFAULT_AI_CONFIG.modelId,
        baseUrl: DEFAULT_AI_CONFIG.baseUrl,
        temperature: DEFAULT_AI_CONFIG.temperature,
        topP: DEFAULT_AI_CONFIG.topP,
        maxTokens: DEFAULT_AI_CONFIG.maxTokens,
        timeout: DEFAULT_AI_CONFIG.timeout,
        streamingEnabled: DEFAULT_AI_CONFIG.streamingEnabled,
        isEnabled: DEFAULT_AI_CONFIG.isEnabled,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        assistantName: DEFAULT_AI_CONFIG.assistantName,
        assistantDescription: DEFAULT_AI_CONFIG.assistantDescription,
        responseLanguage: DEFAULT_AI_CONFIG.responseLanguage,
        databaseOnlyMode: true, // Always forced true
        useKnowledgeBase: DEFAULT_AI_CONFIG.useKnowledgeBase,
        useDatabaseStats: DEFAULT_AI_CONFIG.useDatabaseStats,
        fallbackMessage: DEFAULT_AI_CONFIG.fallbackMessage,
        updatedBy: 'SYSTEM_INIT'
      }
    });

    // Auto-seed credential from environment if present
    const envNvidiaKey = process.env.NVIDIA_API_KEY;
    if (envNvidiaKey && envNvidiaKey.trim()) {
      try {
        const existingCred = await prisma.aIProviderCredential.findUnique({
          where: { provider: 'NVIDIA' }
        });
        if (!existingCred) {
          await prisma.aIProviderCredential.create({
            data: {
              provider: 'NVIDIA',
              encryptedApiKey: encryptApiKey(envNvidiaKey.trim()),
              keyMask: maskApiKey(envNvidiaKey.trim()),
              status: 'CONFIGURED'
            }
          });
        }
      } catch (err) {
        console.error('Failed to auto-seed NVIDIA credential:', err);
      }
    }
  }

  return {
    id: config.id,
    provider: config.provider,
    modelId: config.modelId,
    baseUrl: config.baseUrl,
    temperature: config.temperature,
    topP: config.topP,
    maxTokens: config.maxTokens,
    timeout: config.timeout,
    streamingEnabled: config.streamingEnabled,
    isEnabled: config.isEnabled,
    systemPrompt: config.systemPrompt,
    assistantName: config.assistantName,
    assistantDescription: config.assistantDescription,
    responseLanguage: config.responseLanguage,
    databaseOnlyMode: true, // Always true
    useKnowledgeBase: config.useKnowledgeBase,
    useDatabaseStats: config.useDatabaseStats,
    fallbackMessage: config.fallbackMessage,
    updatedBy: config.updatedBy,
    updatedAt: config.updatedAt
  };
}

/**
 * Resolves decrypted API key for a provider.
 * Looks in AIProviderCredential first, falls back to environment variables.
 */
export async function getProviderCredential(provider: string): Promise<{
  apiKey: string;
  keyMask: string;
  status: string;
  lastTestedAt: Date | null;
  lastErrorMessage: string | null;
}> {
  const normalized = (provider || 'NVIDIA').toUpperCase();
  const credential = await prisma.aIProviderCredential.findUnique({
    where: { provider: normalized }
  });

  if (credential && credential.encryptedApiKey) {
    try {
      const decrypted = decryptApiKey(credential.encryptedApiKey);
      return {
        apiKey: decrypted,
        keyMask: credential.keyMask,
        status: credential.status,
        lastTestedAt: credential.lastTestedAt,
        lastErrorMessage: credential.lastErrorMessage
      };
    } catch (err) {
      console.error(`Failed to decrypt credential for provider ${provider}:`, err);
    }
  }

  // Fallback to environment variables
  let envKey = '';
  if (normalized === 'NVIDIA') {
    envKey = process.env.NVIDIA_API_KEY || '';
  } else if (normalized === 'OPENAI') {
    envKey = process.env.OPENAI_API_KEY || '';
  } else if (normalized === 'GEMINI') {
    envKey = process.env.GEMINI_API_KEY || '';
  }

  if (envKey) {
    return {
      apiKey: envKey,
      keyMask: maskApiKey(envKey),
      status: 'CONFIGURED',
      lastTestedAt: null,
      lastErrorMessage: null
    };
  }

  return {
    apiKey: '',
    keyMask: '',
    status: 'NOT_CONFIGURED',
    lastTestedAt: null,
    lastErrorMessage: null
  };
}

/**
 * Returns safe view data for Admin UI without revealing plaintext API keys.
 */
export async function getAdminAIViewData(): Promise<AIAdminViewData> {
  const config = await getActiveAIConfig();
  const credInfo = await prisma.aIProviderCredential.findUnique({
    where: { provider: config.provider }
  });

  let hasKey = false;
  let keyMask = '';
  let status = 'NOT_CONFIGURED';
  let lastTestedAt: string | null = null;
  let lastErrorMessage: string | null = null;

  if (credInfo) {
    hasKey = Boolean(credInfo.encryptedApiKey);
    keyMask = credInfo.keyMask;
    status = credInfo.status;
    lastTestedAt = credInfo.lastTestedAt ? credInfo.lastTestedAt.toISOString() : null;
    lastErrorMessage = credInfo.lastErrorMessage;
  } else {
    // Check environment fallback
    const envKey = config.provider === 'NVIDIA' ? process.env.NVIDIA_API_KEY : '';
    if (envKey) {
      hasKey = true;
      keyMask = maskApiKey(envKey);
      status = 'CONFIGURED';
    }
  }

  return {
    config,
    credential: {
      provider: config.provider,
      hasKey,
      keyMask,
      status,
      lastTestedAt,
      lastErrorMessage
    },
    supportedProviders: SUPPORTED_PROVIDERS
  };
}

/**
 * Saves AI model and behavior configuration.
 */
export async function saveAIConfiguration(
  input: {
    provider?: string;
    modelId?: string;
    baseUrl?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    timeout?: number;
    streamingEnabled?: boolean;
    isEnabled?: boolean;
    systemPrompt?: string;
    assistantName?: string;
    assistantDescription?: string;
    responseLanguage?: string;
    useKnowledgeBase?: boolean;
    useDatabaseStats?: boolean;
    fallbackMessage?: string;
  },
  adminUserId: string
): Promise<AIConfigData> {
  // 1. Validation
  const provider = (input.provider || 'NVIDIA').toUpperCase();
  const modelId = (input.modelId || DEFAULT_AI_CONFIG.modelId).trim();
  const baseUrl = (input.baseUrl || DEFAULT_AI_CONFIG.baseUrl).trim();

  let temperature = Number(input.temperature ?? DEFAULT_AI_CONFIG.temperature);
  if (isNaN(temperature) || temperature < 0) temperature = 0.0;
  if (temperature > 2.0) temperature = 2.0;

  let topP = Number(input.topP ?? DEFAULT_AI_CONFIG.topP);
  if (isNaN(topP) || topP < 0) topP = 0.0;
  if (topP > 1.0) topP = 1.0;

  let maxTokens = Number(input.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens);
  if (isNaN(maxTokens) || maxTokens < 64) maxTokens = 64;
  if (maxTokens > 8192) maxTokens = 8192;

  let timeout = Number(input.timeout ?? DEFAULT_AI_CONFIG.timeout);
  if (isNaN(timeout) || timeout < 1000) timeout = 1000;
  if (timeout > 120000) timeout = 120000;

  const streamingEnabled = input.streamingEnabled !== undefined ? Boolean(input.streamingEnabled) : true;
  const isEnabled = input.isEnabled !== undefined ? Boolean(input.isEnabled) : true;
  const systemPrompt = input.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  const assistantName = input.assistantName?.trim() || DEFAULT_AI_CONFIG.assistantName;
  const assistantDescription = input.assistantDescription?.trim() || DEFAULT_AI_CONFIG.assistantDescription;
  const responseLanguage = input.responseLanguage?.trim() || DEFAULT_AI_CONFIG.responseLanguage;
  const useKnowledgeBase = input.useKnowledgeBase !== undefined ? Boolean(input.useKnowledgeBase) : true;
  const useDatabaseStats = input.useDatabaseStats !== undefined ? Boolean(input.useDatabaseStats) : true;
  const fallbackMessage = input.fallbackMessage?.trim() || DEFAULT_AI_CONFIG.fallbackMessage;

  // Database-Only Mode is strictly mandated and cannot be disabled
  const databaseOnlyMode = true;

  // 2. Fetch existing config or create new
  const existing = await prisma.aIConfiguration.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  let saved;
  if (existing) {
    saved = await prisma.aIConfiguration.update({
      where: { id: existing.id },
      data: {
        provider,
        modelId,
        baseUrl,
        temperature,
        topP,
        maxTokens,
        timeout,
        streamingEnabled,
        isEnabled,
        systemPrompt,
        assistantName,
        assistantDescription,
        responseLanguage,
        databaseOnlyMode,
        useKnowledgeBase,
        useDatabaseStats,
        fallbackMessage,
        updatedBy: adminUserId
      }
    });
  } else {
    saved = await prisma.aIConfiguration.create({
      data: {
        provider,
        modelId,
        baseUrl,
        temperature,
        topP,
        maxTokens,
        timeout,
        streamingEnabled,
        isEnabled,
        systemPrompt,
        assistantName,
        assistantDescription,
        responseLanguage,
        databaseOnlyMode,
        useKnowledgeBase,
        useDatabaseStats,
        fallbackMessage,
        updatedBy: adminUserId
      }
    });
  }

  // 3. Record AuditLog
  let validUserId: string | null = null;
  if (adminUserId) {
    const userExists = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { id: true }
    });
    if (userExists) validUserId = userExists.id;
  }

  await prisma.auditLog.create({
    data: {
      userId: validUserId,
      action: 'UPDATE_AI_CONFIGURATION',
      entityType: 'AIConfiguration',
      entityId: saved.id,
      details: JSON.stringify({
        provider,
        modelId,
        baseUrl,
        temperature,
        topP,
        maxTokens,
        timeout,
        streamingEnabled,
        isEnabled,
        assistantName,
        databaseOnlyMode,
        actor: validUserId ? undefined : adminUserId
      })
    }
  });

  return saved;
}

/**
 * Saves or updates encrypted API key credential for a provider.
 */
export async function saveProviderCredential(
  provider: string,
  apiKey: string,
  adminUserId: string
): Promise<{ success: boolean; keyMask: string }> {
  const normalized = (provider || 'NVIDIA').toUpperCase();
  const trimmedKey = apiKey.trim();

  if (!trimmedKey) {
    throw new Error('API Key tidak boleh kosong');
  }

  const encrypted = encryptApiKey(trimmedKey);
  const mask = maskApiKey(trimmedKey);

  const cred = await prisma.aIProviderCredential.upsert({
    where: { provider: normalized },
    update: {
      encryptedApiKey: encrypted,
      keyMask: mask,
      status: 'CONFIGURED',
      lastErrorMessage: null
    },
    create: {
      provider: normalized,
      encryptedApiKey: encrypted,
      keyMask: mask,
      status: 'CONFIGURED'
    }
  });

  // Audit Log (mask only, no plaintext key)
  let validUserId: string | null = null;
  if (adminUserId) {
    const userExists = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { id: true }
    });
    if (userExists) validUserId = userExists.id;
  }

  await prisma.auditLog.create({
    data: {
      userId: validUserId,
      action: 'UPDATE_AI_CREDENTIALS',
      entityType: 'AIProviderCredential',
      entityId: cred.id,
      details: JSON.stringify({
        provider: normalized,
        keyMask: mask,
        actor: validUserId ? undefined : adminUserId
      })
    }
  });

  return { success: true, keyMask: mask };
}

/**
 * Performs a safe connection test to the AI provider.
 */
export async function testProviderConnection(params: {
  provider: string;
  modelId: string;
  baseUrl: string;
  customApiKey?: string;
  adminUserId?: string;
}): Promise<ConnectionTestResult> {
  const normalized = (params.provider || 'NVIDIA').toUpperCase();
  const adapter = getProviderAdapter(normalized);

  // If custom API key provided in form, use that; otherwise retrieve saved decrypted key
  let apiKeyToUse = params.customApiKey?.trim() || '';
  if (!apiKeyToUse) {
    const cred = await getProviderCredential(normalized);
    apiKeyToUse = cred.apiKey;
  }

  if (!apiKeyToUse) {
    return {
      success: false,
      message: `API Key untuk provider '${normalized}' belum dikonfigurasi. Silakan masukkan API Key terlebih dahulu.`,
      provider: normalized,
      modelId: params.modelId
    };
  }

  const result = await adapter.testConnection({
    provider: normalized,
    modelId: params.modelId,
    baseUrl: params.baseUrl,
    apiKey: apiKeyToUse,
    temperature: 0.1,
    topP: 0.8,
    maxTokens: 16,
    timeout: 15000,
    streamingEnabled: false
  });

  // Update credential status in DB
  try {
    await prisma.aIProviderCredential.updateMany({
      where: { provider: normalized },
      data: {
        status: result.success ? 'TEST_SUCCESS' : 'TEST_FAILED',
        lastTestedAt: new Date(),
        lastErrorMessage: result.success ? null : result.message
      }
    });

    if (params.adminUserId) {
      let validUserId: string | null = null;
      const userExists = await prisma.user.findUnique({
        where: { id: params.adminUserId },
        select: { id: true }
      });
      if (userExists) validUserId = userExists.id;

      await prisma.auditLog.create({
        data: {
          userId: validUserId,
          action: 'TEST_AI_CONNECTION',
          entityType: 'AIProviderCredential',
          details: JSON.stringify({
            provider: normalized,
            modelId: params.modelId,
            success: result.success,
            latencyMs: result.latencyMs,
            actor: validUserId ? undefined : params.adminUserId
          })
        }
      });
    }
  } catch (err) {
    console.error('Failed to update credential test status in DB:', err);
  }

  return result;
}
