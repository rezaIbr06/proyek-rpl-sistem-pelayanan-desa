export type SupportedProvider = 'NVIDIA' | 'OPENAI' | 'GEMINI';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProviderConfig {
  provider: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  timeout: number;
  streamingEnabled: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  provider: string;
  modelId: string;
}

export interface AIProviderAdapter {
  readonly providerName: string;
  testConnection(config: AIProviderConfig): Promise<ConnectionTestResult>;
  generateChatStream(config: AIProviderConfig, messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>>;
  generateChatCompletion(config: AIProviderConfig, messages: ChatMessage[]): Promise<string>;
}

export interface AIConfigData {
  id?: string;
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
  databaseOnlyMode: boolean;
  useKnowledgeBase: boolean;
  useDatabaseStats: boolean;
  fallbackMessage: string;
  updatedBy?: string | null;
  updatedAt?: Date;
}

export interface AIAdminViewData {
  config: AIConfigData;
  credential: {
    provider: string;
    hasKey: boolean;
    keyMask: string;
    status: string;
    lastTestedAt: string | null;
    lastErrorMessage: string | null;
  };
  supportedProviders: {
    id: string;
    name: string;
    description: string;
    defaultBaseUrl: string;
    defaultModel: string;
    recommendedModels: { id: string; name: string; contextWindow: string; description: string }[];
  }[];
}

