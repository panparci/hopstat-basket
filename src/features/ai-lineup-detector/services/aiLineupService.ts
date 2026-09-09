import { TokenLogger } from "../../../core/services/ai/tokenLogger";
import { geminiGenerate } from "../../../lib/gemini";
import { QuarterMarker } from "../../automatic-clock-mapping/types";
import { Player, MatchRoster } from "../../../core/types/stats";
import { statsService } from "../../../core/services/statsService";

export interface LineupDetectionResult {
  homeTeam: {
    color: string;
    jerseys: string[];
  };
  awayTeam: {
    color: string;
    jerseys: string[];
  };
  sampleTimestamps: number[];
  tokenUsage: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
    costUSD: number;
    costIDR: number;
  };
  summary: string;
}

/**
 * Calculates sample video timestamps across quarters (higher density for substitution detection)
 */
export function calculateSampleTimestamps(
  quarterMarkers: QuarterMarker[],
  totalVideoDurationSec: number = 3600
): number[] {
  const timestamps: number[] = [];

  if (quarterMarkers && quarterMarkers.length > 0) {
    // Only process valid quarter markers where videoEndSeconds > videoStartSeconds + 10
    const validQuarters = quarterMarkers.filter(
      (q) => q.videoEndSeconds > q.videoStartSeconds + 10
    );

    if (validQuarters.length > 0) {
      // Sort quarters chronologically by videoStartSeconds
      const sortedQuarters = [...validQuarters].sort(
        (a, b) => a.videoStartSeconds - b.videoStartSeconds
      );

      for (const q of sortedQuarters) {
        const start = q.videoStartSeconds;
        const end = q.videoEndSeconds;
        const duration = end - start;

        if (duration <= 60) {
          // Very short quarter, sample once in the middle
          timestamps.push(Math.round(start + duration / 2));
        } else if (duration <= 300) {
          // Short quarter (1-5 mins): sample at 20%, 50%, 80%
          timestamps.push(Math.round(start + duration * 0.2));
          timestamps.push(Math.round(start + duration * 0.5));
          timestamps.push(Math.round(start + duration * 0.8));
        } else {
          // Standard quarter (> 5 mins, e.g. 10-12 min basketball quarter):
          // Take 4-5 sample points inside quarter to catch starting lineups, substitutions & late quarter players
          const p1 = Math.round(start + duration * 0.15);
          const p2 = Math.round(start + duration * 0.35);
          const p3 = Math.round(start + duration * 0.55);
          const p4 = Math.round(start + duration * 0.75);
          const p5 = Math.round(start + duration * 0.90);
          timestamps.push(p1, p2, p3, p4, p5);
        }
      }

      // Deduplicate and return sorted array (max 16 sample frames)
      return Array.from(new Set(timestamps))
        .sort((a, b) => a - b)
        .slice(0, 16);
    }
  }

  // Fallback if no quarter markers exist: Sample every 3 minutes up to 12 frames
  let sec = 120; // 2 min in
  while (sec < totalVideoDurationSec && timestamps.length < 12) {
    timestamps.push(sec);
    sec += 180; // +3 mins
  }
  return timestamps;
}

/**
 * Captures screenshot frame from video element or canvas,
 * cropping to the YouTube video player area to eliminate background UI noise.
 */
export function captureFrameBase64(
  videoEl: HTMLVideoElement | null,
  targetIframeOrEl?: HTMLElement | null
): string | null {
  if (!videoEl || videoEl.readyState < 2) return null;
  try {
    const fullWidth = videoEl.videoWidth || 1280;
    const fullHeight = videoEl.videoHeight || 720;

    // Attempt to locate YouTube video iframe or container element in DOM
    const targetEl =
      targetIframeOrEl ||
      document.querySelector("iframe[src*='youtube']") ||
      document.querySelector("iframe") ||
      document.querySelector(".aspect-video") ||
      document.querySelector("#youtube-player");

    let sx = 0;
    let sy = 0;
    let sWidth = fullWidth;
    let sHeight = fullHeight;

    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const winW = window.innerWidth || 1;
      const winH = window.innerHeight || 1;

      // Compute relative coordinates of the YouTube player inside the browser viewport
      const relX = Math.max(0, rect.left / winW);
      const relY = Math.max(0, rect.top / winH);
      const relW = Math.min(1 - relX, rect.width / winW);
      const relH = Math.min(1 - relY, rect.height / winH);

      if (relW > 0.1 && relH > 0.1) {
        sx = Math.round(relX * fullWidth);
        sy = Math.round(relY * fullHeight);
        sWidth = Math.round(relW * fullWidth);
        sHeight = Math.round(relH * fullHeight);
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = sWidth;
    canvas.height = sHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(videoEl, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch (err) {
    console.warn("[aiLineupService] Canvas frame capture warning:", err);
    return null;
  }
}

/**
 * Analyzes video frame images using Gemini AI (gemini-2.5-flash)
 * Logs usage in TokenLogger
 */
export async function detectPlayerJerseysWithGemini(
  base64Images: string[],
  ourTeamName: string = "Home Team",
  theirTeamName: string = "Away Team"
): Promise<LineupDetectionResult> {
  const imageParts = base64Images.map((img) => ({
    inline_data: {
      mime_type: "image/jpeg",
      data: img.includes(",") ? img.split(",")[1] : img,
    },
  }));

  const promptText = `Anda adalah analis video pertandingan bola basket.
Inspeksi gambar-gambar screenshot pertandingan berikut yang diambil dari video.
Tugas Anda adalah mendeteksi dan mendaftar seluruh nomor punggung pemain (jersey numbers) yang terlihat dari kedua tim (${ourTeamName} vs ${theirTeamName}).
Kelompokkan jersey berdasarkan warna seragam / tim (Home vs Away).

Kembalikan format JSON persis sesuai schema berikut:
- homeTeam: { color: string (deskripsi warna jersey, contoh "Putih/Light"), jerseys: string[] (array nomor punggung unik yang terdeteksi) }
- awayTeam: { color: string (deskripsi warna jersey, contoh "Biru Gelap/Dark"), jerseys: string[] (array nomor punggung unik yang terdeteksi) }
- summary: string (ringkasan singkat hasil deteksi)`;

  const response = await geminiGenerate({
    model: "gemini-2.5-flash",
    contents: { parts: [...imageParts, { text: promptText }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          homeTeam: {
            type: "OBJECT",
            properties: {
              color: { type: "STRING" },
              jerseys: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["color", "jerseys"],
          },
          awayTeam: {
            type: "OBJECT",
            properties: {
              color: { type: "STRING" },
              jerseys: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["color", "jerseys"],
          },
          summary: { type: "STRING" },
        },
        required: ["homeTeam", "awayTeam", "summary"],
      },
    },
  });

  const promptTokens = response.usage.promptTokenCount || 0;
  const candidatesTokens = response.usage.candidatesTokenCount || 0;
  const totalTokens = promptTokens + candidatesTokens;

  // Log in TokenLogger for Token Meter integration
  const logged = await TokenLogger.log({
    model: "gemini-2.5-flash",
    action: "lineup_jersey_detection",
    promptTokenCount: promptTokens,
    candidatesTokenCount: candidatesTokens,
    itemCount: base64Images.length,
  });

  let parsed: any = {};
  try {
    parsed = JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse Gemini response text:", response.text);
  }

  const homeJerseys = Array.from(new Set(parsed.homeTeam?.jerseys || [])).map(String);
  const awayJerseys = Array.from(new Set(parsed.awayTeam?.jerseys || [])).map(String);

  return {
    homeTeam: {
      color: parsed.homeTeam?.color || "Home Jersey",
      jerseys: homeJerseys,
    },
    awayTeam: {
      color: parsed.awayTeam?.color || "Away Jersey",
      jerseys: awayJerseys,
    },
    sampleTimestamps: [],
    tokenUsage: {
      promptTokens,
      candidatesTokens,
      totalTokens,
      costUSD: logged.costUSD,
      costIDR: logged.costIDR,
    },
    summary: parsed.summary || `Berhasil mendeteksi ${homeJerseys.length + awayJerseys.length} nomor punggung dari ${base64Images.length} frame.`,
  };
}

/**
 * Applies detected jersey numbers to match roster in DB.
 * Checks existing team players in DB to match names if available,
 * or creates new placeholder players if not in DB.
 */
export async function applyDetectedJerseysToMatchRoster(
  matchId: string,
  teamId: string,
  detectedJerseys: string[],
  teamName: string
): Promise<{ added: number; matched: number }> {
  if (!matchId || !teamId || detectedJerseys.length === 0) return { added: 0, matched: 0 };

  const currentRosters = await statsService.getMatchRosters(matchId);
  const teamRosters = currentRosters.filter((r) => r.teamId === teamId);
  const existingRosterJerseys = new Map(teamRosters.map((r) => [String(r.jerseyNumber), r]));

  // Get all master players in DB to match names
  const allDbPlayers = await statsService.getPlayers();

  let addedCount = 0;
  let matchedCount = 0;

  for (const jersey of detectedJerseys) {
    const cleanJersey = String(jersey).trim();
    if (!cleanJersey) continue;

    // Check if already in match roster
    if (existingRosterJerseys.has(cleanJersey)) {
      matchedCount++;
      continue;
    }

    // Try to find matching player in master database by jersey number
    const dbMatch = allDbPlayers.find(
      (p) => String(p.jersey).trim() === cleanJersey || String(p.displayName).trim() === `#${cleanJersey}`
    );

    const playerId = dbMatch ? dbMatch.id : `p_detected_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const playerName = dbMatch ? (dbMatch.name || dbMatch.displayName || `Pemain #${cleanJersey}`) : `Pemain #${cleanJersey}`;

    const newRosterEntry: MatchRoster = {
      id: `${matchId}_${playerId}`,
      matchId,
      teamId,
      profileId: playerId,
      name: playerName,
      jerseyNumber: cleanJersey,
      isStarter: false,
      isActive: false, // Added to match roster bench (cadangan), not active on court
    };

    await statsService.addMatchRoster(newRosterEntry);

    if (!dbMatch) {
      // Also save as player entry in master DB
      const newPlayer: Player = {
        id: playerId,
        name: playerName,
        displayName: `#${cleanJersey}`,
        jersey: cleanJersey,
        isActive: true,
      };
      await statsService.addPlayer(newPlayer);
    } else {
      matchedCount++;
    }

    addedCount++;
  }

  return { added: addedCount, matched: matchedCount };
}
