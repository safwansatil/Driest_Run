export const config = { runtime: 'edge' };

const rateLimitMap = new Map<string, number[]>();

export default async function handler(request: Request) {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  const hostname = url.hostname;

  // CORS Preflight check
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // CORS check: allow same-origin only in prod; localhost in dev; reject others with 403
  if (origin) {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname;
    const isLocalhost = originHost === 'localhost' || originHost === '127.0.0.1';
    const isDev = hostname === 'localhost' || hostname === '127.0.0.1';

    if (isDev) {
      if (!isLocalhost && originUrl.origin !== url.origin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      if (originUrl.origin !== url.origin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  // Rate limiting: reject if > 30 req/min from same IP
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  let timestamps = rateLimitMap.get(ip) || [];
  timestamps = timestamps.filter((t) => now - t < 60000);
  
  if (timestamps.length >= 30) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*',
      },
    });
  }
  
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*',
      },
    });
  }

  // Read API Key (Accept either OpenAI key or Anthropic key)
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'server-key-missing' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*',
      },
    });
  }

  try {
    const body = await request.json();
    const tools = body.tools || [];
    const messages = body.messages || [];
    const system = body.system;

    // Detect if the provided key is an OpenAI key (starts with sk-proj- or sk- and is not an Anthropic key)
    const isOpenAIKey = apiKey.startsWith('sk-proj-') || (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-ant-'));

    if (isOpenAIKey) {
      // --- OpenAI Adapter Mode ---
      const openAiTools = tools.length > 0 ? tools.map((t: any) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema
        }
      })) : undefined;

      const openAiMessages = messages.map((m: any) => {
        if (Array.isArray(m.content)) {
          // Check if there is a tool result block
          const toolResult = m.content.find((c: any) => c.type === 'tool_result');
          if (toolResult) {
            return {
              role: 'tool',
              tool_call_id: toolResult.tool_use_id,
              content: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content)
            };
          }
          // Check if there is a tool use block
          const toolUseBlock = m.content.find((c: any) => c.type === 'tool_use');
          const textBlock = m.content.find((c: any) => c.type === 'text');
          if (m.role === 'assistant' && toolUseBlock) {
            return {
              role: 'assistant',
              content: textBlock?.text || null,
              tool_calls: [{
                id: toolUseBlock.id,
                type: 'function',
                function: {
                  name: toolUseBlock.name,
                  arguments: JSON.stringify(toolUseBlock.input)
                }
              }]
            };
          }
        }
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        };
      });

      if (system) {
        openAiMessages.unshift({
          role: 'system',
          content: system
        });
      }

      const payload: any = {
        model: 'gpt-4o-mini',
        messages: openAiMessages,
        max_tokens: 1024
      };
      if (openAiTools) {
        payload.tools = openAiTools;
      }

      const upstreamResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const openAiData = await upstreamResponse.json();
      if (!upstreamResponse.ok) {
        return new Response(JSON.stringify({ error: openAiData.error?.message || 'OpenAI API Error' }), {
          status: upstreamResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin || '*'
          }
        });
      }

      const choice = openAiData.choices?.[0];
      const openAiMsg = choice?.message;

      const content: any[] = [];
      if (openAiMsg?.content) {
        content.push({
          type: 'text',
          text: openAiMsg.content
        });
      }
      if (openAiMsg?.tool_calls?.[0]) {
        const tc = openAiMsg.tool_calls[0];
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || '{}')
        });
      }

      return new Response(JSON.stringify({ content }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin || '*'
        }
      });

    } else {
      // --- Standard Anthropic Mode ---
      const model = body.model ?? 'claude-sonnet-4-20250514';
      const max_tokens = 1024;

      const upstreamResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens,
          tools,
          messages,
          system,
        }),
      });

      const data = await upstreamResponse.json();
      return new Response(JSON.stringify(data), {
        status: upstreamResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin || '*',
        },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*',
      },
    });
  }
}
