export interface LLMResponse {
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  }>;
}

export async function callLLM(
  messages: any[],
  tools: any[],
  opts?: { model?: string; system?: string }
): Promise<LLMResponse> {
  const url = '/api/llm';

  const executeCall = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          tools,
          model: opts?.model,
          system: opts?.system,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      if (response.status === 500 && data.error === 'server-key-missing') {
        throw new Error('server-key-missing');
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      return data as LLMResponse;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    return await executeCall();
  } catch (err: any) {
    // Retry on network/timeout errors, but NOT on server-key-missing or HTTP 4xx/5xx errors
    if (
      err.message === 'server-key-missing' ||
      (err.message && err.message.startsWith('HTTP error'))
    ) {
      throw err;
    }
    // If it's a DOMException abort or network error, retry once
    return await executeCall();
  }
}
