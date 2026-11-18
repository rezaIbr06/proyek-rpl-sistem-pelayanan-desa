import { AIProviderAdapter, AIProviderConfig, ChatMessage, ConnectionTestResult } from '../types';

export class GeminiProviderAdapter implements AIProviderAdapter {
  readonly providerName = 'GEMINI';

  async testConnection(config: AIProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutMs = Math.min(config.timeout || 15000, 15000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (!config.apiKey) {
        return {
          success: false,
          message: 'API Key Google Gemini belum diisi.',
          provider: this.providerName,
          modelId: config.modelId
        };
      }

      const cleanBase = config.baseUrl.replace(/\/+$/, '');
      const url = `${cleanBase}/models/${config.modelId}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping test' }] }],
          generationConfig: { maxOutputTokens: 10 }
        }),
        signal: controller.signal
      });

      const latencyMs = Date.now() - startTime;
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Gemini Error (HTTP ${response.status}): ${errorText}`,
          latencyMs,
          provider: this.providerName,
          modelId: config.modelId
        };
      }

      return {
        success: true,
        message: `Koneksi ke Google Gemini API berhasil (${latencyMs} ms).`,
        latencyMs,
        provider: this.providerName,
        modelId: config.modelId
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Gagal menghubungi endpoint Gemini: ${errMsg || 'Network error'}`,
        latencyMs,
        provider: this.providerName,
        modelId: config.modelId
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateChatStream(config: AIProviderConfig, messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
    const cleanBase = config.baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}/models/${config.modelId}:streamGenerateContent?alt=sse&key=${encodeURIComponent(config.apiKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);

    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const contents = conversationMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const requestBody: {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      generationConfig: {
        temperature: number;
        topP: number;
        maxOutputTokens: number;
      };
      systemInstruction?: {
        parts: Array<{ text: string }>;
      };
    } = {
      contents,
      generationConfig: {
        temperature: config.temperature,
        topP: config.topP,
        maxOutputTokens: config.maxTokens
      }
    };

    if (systemMessage && systemMessage.content) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage.content }]
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) {
      clearTimeout(timeoutId);
      const err = await response.text();
      throw new Error(`Gemini API HTTP ${response.status}: ${err}`);
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      throw new Error('Gemini API returned empty response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return new ReadableStream<Uint8Array>({
      async start(streamController) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                try {
                  const data = JSON.parse(trimmed.slice(6));
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    streamController.enqueue(new TextEncoder().encode('0:' + JSON.stringify(text) + '\n'));
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
        } finally {
          clearTimeout(timeoutId);
          streamController.close();
          reader.releaseLock();
        }
      }
    });
  }

  async generateChatCompletion(config: AIProviderConfig, messages: ChatMessage[]): Promise<string> {
    const cleanBase = config.baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}/models/${config.modelId}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);

    try {
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const contents = conversationMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const requestBody: {
        contents: Array<{ role: string; parts: Array<{ text: string }> }>;
        generationConfig: {
          temperature: number;
          topP: number;
          maxOutputTokens: number;
        };
        systemInstruction?: {
          parts: Array<{ text: string }>;
        };
      } = {
        contents,
        generationConfig: {
          temperature: config.temperature,
          topP: config.topP,
          maxOutputTokens: config.maxTokens
        }
      };

      if (systemMessage && systemMessage.content) {
        requestBody.systemInstruction = {
          parts: [{ text: systemMessage.content }]
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API HTTP ${response.status}: ${err}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
