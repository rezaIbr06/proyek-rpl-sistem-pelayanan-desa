import { AIProviderAdapter, AIProviderConfig, ChatMessage, ConnectionTestResult } from '../types';

export class NvidiaProviderAdapter implements AIProviderAdapter {
  readonly providerName = 'NVIDIA';

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
    const timeoutMs = Math.min(config.timeout || 15000, 15000); // 15s max for quick test
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (!config.apiKey) {
        return {
          success: false,
          message: 'API Key NVIDIA belum diisi atau tidak tersedia.',
          provider: this.providerName,
          modelId: config.modelId
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: config.modelId,
          messages: [
            {
              role: 'user',
              content: 'Pengujian koneksi sistem desa. Balas dengan kata: KONEKSI_BERHASIL.'
            }
          ],
          temperature: 0.1,
          max_tokens: 32,
          stream: false
        }),
        signal: controller.signal
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errorJson = await response.json();
          errorDetail = errorJson.message || errorJson.error?.message || JSON.stringify(errorJson);
        } catch {
          errorDetail = await response.text();
        }

        if (response.status === 401) {
          return {
            success: false,
            message: `Autentikasi gagal (HTTP 401): API Key NVIDIA tidak valid.`,
            latencyMs,
            provider: this.providerName,
            modelId: config.modelId
          };
        }

        if (response.status === 404) {
          return {
            success: false,
            message: `Model tidak ditemukan (HTTP 404): Model '${config.modelId}' tidak tersedia di endpoint NVIDIA.`,
            latencyMs,
            provider: this.providerName,
            modelId: config.modelId
          };
        }

        return {
          success: false,
          message: `NVIDIA API Error (HTTP ${response.status}): ${errorDetail || response.statusText}`,
          latencyMs,
          provider: this.providerName,
          modelId: config.modelId
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim() || '';

      return {
        success: true,
        message: `Koneksi ke NVIDIA API berhasil! Respons model: "${content || 'OK'}" (${latencyMs} ms)`,
        latencyMs,
        provider: this.providerName,
        modelId: config.modelId
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const errMsg = err instanceof Error ? err.message : String(err);
      if (isAbort) {
        return {
          success: false,
          message: `Batas waktu pengujian koneksi terlampaui (${timeoutMs} ms). Periksa Base URL atau koneksi jaringan server.`,
          latencyMs,
          provider: this.providerName,
          modelId: config.modelId
        };
      }
      return {
        success: false,
        message: `Gagal menghubungi endpoint NVIDIA: ${errMsg || 'Network error'}`,
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

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
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
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      throw fetchErr;
    }

    if (!response.ok) {
      clearTimeout(timeoutId);
      let errorDetail = '';
      try {
        const errJson = await response.json();
        errorDetail = errJson.message || errJson.error?.message || JSON.stringify(errJson);
      } catch {
        errorDetail = await response.text();
      }
      throw new Error(`NVIDIA API HTTP ${response.status}: ${errorDetail || response.statusText}`);
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      throw new Error('NVIDIA API returned an empty response body.');
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
                    // Encode to Vercel AI SDK data stream format
                    streamController.enqueue(new TextEncoder().encode('0:' + JSON.stringify(content) + '\n'));
                  }
                } catch {
                  // Ignore partial JSON chunks
                }
              }
            }
          }
        } catch (streamErr) {
          streamController.error(streamErr);
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
          'Content-Type': 'application/json',
          'Accept': 'application/json'
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
        throw new Error(`NVIDIA API HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
