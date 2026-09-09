export async function geminiGenerate(opts: {
  model?: string;
  contents: unknown;
  config?: {
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: unknown;
  };
}): Promise<{
  text: string;
  usage: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
}> {
  const res = await fetch('/api/gemini/generate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Gemini request failed');
  }
  return {
    text: data.text || '',
    usage: data.usage || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
  };
}
