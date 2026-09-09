import { initDB } from "../../../lib/db";

export interface AiTokenLogEntry {
  id: string;
  timestamp: number;
  model: string;
  action: string;
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  costUSD: number;
  costIDR: number;
  itemCount: number;
}

export interface TokenUsageSummary {
  totalCalls: number;
  totalPromptTokens: number;
  totalCandidatesTokens: number;
  totalTokens: number;
  totalCostUSD: number;
  totalCostIDR: number;
}

const STORE_NAME = "token_logs";
const USD_TO_IDR_RATE = 18000;

const INPUT_COST_PER_TOKEN = 0.00000010;
const OUTPUT_COST_PER_TOKEN = 0.00000040;

export class TokenLogger {
  public static calculateCost(promptTokens: number, candidatesTokens: number): { costUSD: number; costIDR: number } {
    const costUSD = promptTokens * INPUT_COST_PER_TOKEN + candidatesTokens * OUTPUT_COST_PER_TOKEN;
    const costIDR = costUSD * USD_TO_IDR_RATE;
    return { costUSD, costIDR };
  }

  public static async log(entry: {
    model?: string;
    action: string;
    promptTokenCount: number;
    candidatesTokenCount: number;
    itemCount?: number;
  }): Promise<AiTokenLogEntry> {
    const model = entry.model || "gemini-3.6-flash";
    const totalTokenCount = entry.promptTokenCount + entry.candidatesTokenCount;
    const { costUSD, costIDR } = this.calculateCost(entry.promptTokenCount, entry.candidatesTokenCount);

    const logItem: AiTokenLogEntry = {
      id: `token-log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      model,
      action: entry.action,
      promptTokenCount: entry.promptTokenCount,
      candidatesTokenCount: entry.candidatesTokenCount,
      totalTokenCount,
      costUSD,
      costIDR,
      itemCount: entry.itemCount || 1,
    };

    try {
      const db = await initDB();
      await db.put(STORE_NAME, logItem);
    } catch (err) {
      console.warn("Failed to store AI token log:", err);
    }

    return logItem;
  }

  public static async getAllLogs(): Promise<AiTokenLogEntry[]> {
    try {
      const db = await initDB();
      const logs = await db.getAllFromIndex(STORE_NAME, "by-timestamp");
      return [...logs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } catch {
      return [];
    }
  }

  public static async getSummary(): Promise<TokenUsageSummary> {
    const logs = await this.getAllLogs();
    return logs.reduce<TokenUsageSummary>(
      (acc, log) => {
        acc.totalCalls += 1;
        acc.totalPromptTokens += log.promptTokenCount;
        acc.totalCandidatesTokens += log.candidatesTokenCount;
        acc.totalTokens += log.totalTokenCount;
        acc.totalCostUSD += log.costUSD;
        acc.totalCostIDR += log.costIDR;
        return acc;
      },
      {
        totalCalls: 0,
        totalPromptTokens: 0,
        totalCandidatesTokens: 0,
        totalTokens: 0,
        totalCostUSD: 0,
        totalCostIDR: 0,
      }
    );
  }

  public static async clearLogs(): Promise<void> {
    try {
      const db = await initDB();
      await db.clear(STORE_NAME);
    } catch {
      // ignore
    }
  }
}
