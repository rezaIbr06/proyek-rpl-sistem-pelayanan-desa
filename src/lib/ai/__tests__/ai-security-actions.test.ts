import {
  getAIConfigAdminAction,
  saveAIConfigAction,
  saveAICredentialAction,
  testAIConnectionAction,
  resetAISystemPromptAction
} from '@/app/actions/ai-config';
import * as sessionModule from '@/lib/session';

// Mock session module
jest.mock('@/lib/session', () => ({
  verifySession: jest.fn(),
}));

describe('F. Keamanan dan Role-Based Access Control (RBAC)', () => {
  const verifySessionMock = sessionModule.verifySession as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('TEST 19: Unauthenticated user (no session) is rejected from reading config', async () => {
    verifySessionMock.mockResolvedValue(null);
    const result = await getAIConfigAdminAction();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Hanya Administrator Sistem');
  });

  test('TEST 20: Non-admin roles (CITIZEN, WARGA, STAF, SUPERVISOR) are rejected from reading config', async () => {
    const nonAdminRoles = ['CITIZEN', 'WARGA', 'STAF', 'SUPERVISOR'];

    for (const role of nonAdminRoles) {
      verifySessionMock.mockResolvedValue({
        isAuth: true,
        userId: `user-${role.toLowerCase()}`,
        role,
        name: `User ${role}`
      });

      const result = await getAIConfigAdminAction();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Hanya Administrator Sistem');
    }
  });

  test('TEST 21: Non-admin cannot save AI configuration', async () => {
    verifySessionMock.mockResolvedValue({
      isAuth: true,
      userId: 'user-warga-1',
      role: 'WARGA',
      name: 'Warga Biasa'
    });

    const result = await saveAIConfigAction({
      provider: 'NVIDIA',
      modelId: 'meta/llama-3.2-11b-vision-instruct',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      temperature: 0.2,
      topP: 0.8,
      maxTokens: 1024,
      timeout: 30000,
      streamingEnabled: true,
      isEnabled: true,
      systemPrompt: 'Hacked prompt',
      assistantName: 'Asisten Hacked',
      assistantDescription: 'Hacked',
      responseLanguage: 'Indonesia',
      useKnowledgeBase: true,
      useDatabaseStats: true,
      fallbackMessage: 'Fallback'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Hanya Administrator Sistem');
  });

  test('TEST 22: Non-admin cannot save credentials or test connection', async () => {
    verifySessionMock.mockResolvedValue({
      isAuth: true,
      userId: 'user-staf-1',
      role: 'STAF',
      name: 'Staf Pelayanan'
    });

    const credResult = await saveAICredentialAction('NVIDIA', 'nvapi-fake');
    expect(credResult.success).toBe(false);
    expect(credResult.error).toContain('Hanya Administrator Sistem');

    const testConnResult = await testAIConnectionAction({
      provider: 'NVIDIA',
      modelId: 'meta/llama-3.2-11b-vision-instruct',
      baseUrl: 'https://integrate.api.nvidia.com/v1'
    });
    expect(testConnResult.success).toBe(false);
    expect(testConnResult.message).toContain('Hanya Administrator Sistem');
  });

  test('TEST 23: Admin role has full authorized access to view and reset config', async () => {
    verifySessionMock.mockResolvedValue({
      isAuth: true,
      userId: 'admin-user-id',
      role: 'ADMIN',
      name: 'Administrator'
    });

    const viewData = await getAIConfigAdminAction();
    expect(viewData.success).toBe(true);
    expect(viewData.data).toBeDefined();
    expect(viewData.data?.config.provider).toBeDefined();

    const resetPrompt = await resetAISystemPromptAction();
    expect(resetPrompt.success).toBe(true);
    expect(resetPrompt.defaultPrompt).toContain('Kamu adalah Asisten Desa AI');
  });
});

