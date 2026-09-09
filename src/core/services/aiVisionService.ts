import { geminiGenerate } from "../../lib/gemini";
import { Player } from "../types/stats";

const lineupSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      jersey: { type: "STRING" },
      name: { type: "STRING" },
    },
    required: ["jersey", "name"],
  },
};

function mediaPart(dataUrl: string, mimeType: string) {
  return {
    inline_data: {
      mime_type: mimeType,
      data: dataUrl.split(",")[1] || dataUrl,
    },
  };
}

async function extract(contents: unknown): Promise<Partial<Player>[]> {
  const response = await geminiGenerate({
    model: "gemini-3.5-flash",
    contents,
    config: { responseMimeType: "application/json", responseSchema: lineupSchema },
  });
  return JSON.parse(response.text || "[]");
}

export const aiVisionService = {
  async extractLineupFromImage(base64Image: string, mimeType: string): Promise<Partial<Player>[]> {
    try {
      return await extract({
        parts: [
          mediaPart(base64Image, mimeType),
          { text: "Extract the basketball players' jersey numbers and names from this image. Return a JSON array of objects with 'jersey' (string) and 'name' (string) properties. If a name is not visible, leave it empty or guess based on the text on the jersey." },
        ],
      });
    } catch (error) {
      console.error("Error extracting lineup from image:", error);
      return [];
    }
  },

  async extractLineupFromAudio(base64Audio: string, mimeType: string): Promise<Partial<Player>[]> {
    try {
      return await extract({
        parts: [
          mediaPart(base64Audio, mimeType),
          { text: "Extract the basketball lineup (jersey numbers and names) from this audio recording. Return a JSON array of objects with 'jersey' (string) and 'name' (string) properties. If only numbers are mentioned, leave the name empty." },
        ],
      });
    } catch (error) {
      console.error("Error extracting lineup from audio:", error);
      return [];
    }
  },

  async extractLineupFromText(textInput: string): Promise<Partial<Player>[]> {
    try {
      return await extract(
        `Extract the basketball lineup (jersey numbers and names) from this text: "${textInput}". Return a JSON array of objects with 'jersey' (string) and 'name' (string) properties. If only numbers are provided, leave the name empty.`
      );
    } catch (error) {
      console.error("Error extracting lineup from text:", error);
      return [];
    }
  },
};
