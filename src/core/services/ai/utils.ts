import { geminiGenerate } from "../../../lib/gemini";
import { AgentInsight, AgentRole } from "./types";

export async function callGemini(systemInstruction: string, dataSummary: string, role: AgentRole): Promise<AgentInsight> {
  const prompt = `
    Berdasarkan data yang diberikan, berikan analisa Anda.
    PENTING: Tulis konten dalam Bahasa Indonesia yang natural, tetapi gunakan istilah bola basket dalam Bahasa Inggris.
    Format respons Anda HARUS persis seperti ini (pertahankan label TITLE, ANALYSIS, ACTION dalam bahasa Inggris agar sistem bisa membacanya):
    TITLE: [Judul menarik untuk insight Anda]
    ANALYSIS: [Analisa detail Anda, maksimal 2-3 paragraf]
    ACTION 1: [Saran tindakan pertama yang konkret]
    ACTION 2: [Saran tindakan kedua yang konkret]
    
    ${dataSummary}
  `;

  const response = await geminiGenerate({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: { systemInstruction, temperature: 0.7 },
  });

  const text = response.text || '';
  
  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const analysisMatch = text.match(/ANALYSIS:\s*([\s\S]*?)(?=ACTION 1:|$)/i);
  const actionMatches = [...text.matchAll(/ACTION \d+:\s*(.+)/gi)];

  return {
    role,
    title: titleMatch ? titleMatch[1].trim() : `Analisa ${role}`,
    content: analysisMatch ? analysisMatch[1].trim() : text,
    actionableAdvice: actionMatches.map(m => m[1].trim())
  };
}

export async function callGeminiRaw(systemInstruction: string, prompt: string): Promise<string> {
  const response = await geminiGenerate({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: { systemInstruction, temperature: 0.3 },
  });
  return response.text || '';
}
