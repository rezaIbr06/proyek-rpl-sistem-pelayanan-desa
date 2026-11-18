import { AIProviderAdapter } from '../types';
import { NvidiaProviderAdapter } from './nvidia';
import { OpenAIProviderAdapter } from './openai';
import { GeminiProviderAdapter } from './gemini';

const adapters: Record<string, AIProviderAdapter> = {
  NVIDIA: new NvidiaProviderAdapter(),
  OPENAI: new OpenAIProviderAdapter(),
  GEMINI: new GeminiProviderAdapter()
};

export function getProviderAdapter(provider: string): AIProviderAdapter {
  const normalized = (provider || 'NVIDIA').toUpperCase();
  const adapter = adapters[normalized];
  if (!adapter) {
    throw new Error(`AI Provider '${provider}' is not supported. Supported providers: ${Object.keys(adapters).join(', ')}`);
  }
  return adapter;
}

export { NvidiaProviderAdapter, OpenAIProviderAdapter, GeminiProviderAdapter };

