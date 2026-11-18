'use server';

import { verifySession } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import {
  getAdminAIViewData,
  saveAIConfiguration,
  saveProviderCredential,
  testProviderConnection
} from '@/lib/ai/config-service';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/ai/constants';
import { AIAdminViewData, ConnectionTestResult } from '@/lib/ai/types';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Ensures caller is an authenticated ADMIN.
 */
async function checkAdminSession() {
  const session = await verifySession();
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Akses ditolak: Hanya Administrator Sistem yang berwenang mengelola konfigurasi AI.');
  }
  return session;
}

/**
 * Fetch AI configuration data for Admin UI.
 */
export async function getAIConfigAdminAction(): Promise<{
  success: boolean;
  data?: AIAdminViewData;
  error?: string;
}> {
  try {
    await checkAdminSession();
    const data = await getAdminAIViewData();
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) || 'Gagal memuat konfigurasi AI' };
  }
}

/**
 * Save AI Model and Behavior Configuration.
 */
export async function saveAIConfigAction(data: {
  provider: string;
  modelId: string;
  baseUrl: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  timeout: number;
  streamingEnabled: boolean;
  isEnabled: boolean;
  systemPrompt: string;
  assistantName: string;
  assistantDescription: string;
  responseLanguage: string;
  useKnowledgeBase: boolean;
  useDatabaseStats: boolean;
  fallbackMessage: string;
  newApiKey?: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const session = await checkAdminSession();

    // If a new API key was submitted in the form, encrypt and save credential
    if (data.newApiKey && data.newApiKey.trim().length > 0) {
      await saveProviderCredential(data.provider, data.newApiKey.trim(), session.userId);
    }

    await saveAIConfiguration(data, session.userId);

    revalidatePath('/dashboard/admin/konfigurasi-ai');
    revalidatePath('/api/chat');

    return { success: true, message: 'Konfigurasi model AI berhasil disimpan dan diperbarui.' };
  } catch (err: unknown) {
    return { success: false, message: 'Gagal menyimpan konfigurasi', error: getErrorMessage(err) };
  }
}

/**
 * Save or update provider API Key independently.
 */
export async function saveAICredentialAction(
  provider: string,
  apiKey: string
): Promise<{ success: boolean; message: string; keyMask?: string; error?: string }> {
  try {
    const session = await checkAdminSession();
    const res = await saveProviderCredential(provider, apiKey, session.userId);

    revalidatePath('/dashboard/admin/konfigurasi-ai');
    return {
      success: true,
      message: `API Key untuk provider ${provider} berhasil disimpan secara terenkripsi.`,
      keyMask: res.keyMask
    };
  } catch (err: unknown) {
    return { success: false, message: 'Gagal menyimpan API Key', error: getErrorMessage(err) };
  }
}

/**
 * Test AI provider connection.
 */
export async function testAIConnectionAction(params: {
  provider: string;
  modelId: string;
  baseUrl: string;
  customApiKey?: string;
}): Promise<ConnectionTestResult> {
  try {
    const session = await checkAdminSession();
    const result = await testProviderConnection({
      ...params,
      adminUserId: session.userId
    });
    return result;
  } catch (err: unknown) {
    return {
      success: false,
      message: getErrorMessage(err) || 'Pengujian koneksi gagal dijalankan.',
      provider: params.provider,
      modelId: params.modelId
    };
  }
}

/**
 * Resets system prompt to the official default prompt.
 */
export async function resetAISystemPromptAction(): Promise<{
  success: boolean;
  defaultPrompt: string;
}> {
  await checkAdminSession();
  return {
    success: true,
    defaultPrompt: DEFAULT_SYSTEM_PROMPT
  };
}
