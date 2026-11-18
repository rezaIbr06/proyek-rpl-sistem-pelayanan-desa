import { AIProviderAdapter, AIProviderConfig, ChatMessage, ConnectionTestResult } from '../types';

export class OpenAIProviderAdapter implements AIProviderAdapter {
  readonly providerName = 'OPENAI';

  private resolveEndpoint(baseUrl: string): string {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    if (cleanUrl.endsWith('/chat/completions')) {
      return cleanUrl;
    }
    return `${cleanUrl}/chat/completions`;
  }

  async testConnection(config: AIProviderConfig): Promise<ConnectionTestResult> {
    const endpoint = this.resolveEndpoint(config.baseUrl);
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutMs = Math.min(config.timeout || 15000, 15000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (!config.apiKey) {
        return {
          success: false,
          message: 'API Key OpenAI belum diisi.',
          provider: this.providerName,
          modelId: config.modelId
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.modelId,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 16
        }),
        signal: controller.signal
      });

      const latencyMs = Date.now() - startTime;
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `OpenAI Error (HTTP ${response.status}): ${errorText}`,
          latencyMs,
          provider: this.providerName,
          modelId: config.modelId
        };
      }

      return {
        success: true,
        message: `Koneksi ke OpenAI API berhasil (${latencyMs} ms).`,
        latencyMs,
        provider: this.providerName,
        modelId: config.modelId
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Gagal menghubungi endpoint OpenAI: ${errMsg || 'Network error'}`,
        latencyMs,
        provider: this.providerName,
        modelId: config.modelId
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateChatStream(config: AIProviderConfig, messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
    const endpoint = this.resolveEndpoint(config.baseUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.modelId,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: config.temperature,
        top_p: config.topP,
        max_tokens: config.maxTokens,
        stream: true
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      clearTimeout(timeoutId);
      const errText = await response.text();
      throw new Error(`OpenAI API HTTP ${response.status}: ${errText}`);
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      throw new Error('OpenAI API returned empty body');
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
              if (!trimmed || trimmed === 'data: [DONE]') continue;
              if (trimmed.startsWith('data: ')) {
                try {
                  const data = JSON.parse(trimmed.slice(6));
                  const content = data.choices?.[0]?.delta?.content;
                  if (content) {
                    streamController.enqueue(new TextEncoder().encode('0:' + JSON.stringify(content) + '\n'));
                  }
                } catch {
                  // Ignore parse error
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
    const endpoint = this.resolveEndpoint(config.baseUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.modelId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: config.temperature,
          top_p: config.topP,
          max_tokens: config.maxTokens,
          stream: false
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
