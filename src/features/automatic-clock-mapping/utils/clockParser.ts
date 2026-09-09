/**
 * Utility functions for parsing and formatting basketball game clock strings.
 */

import {
  ClockFormatState,
  ClockFormatCandidateType,
  ParsedClockCandidate,
  QuarterMarker,
} from "../types";

export type ParseClockContext = {
  previousValidGameClockMs?: number | null;
  quarterMarker?: QuarterMarker;
  currentVideoTimeSeconds?: number;
  formatState?: ClockFormatState;
  isUnderOneMinuteContext?: boolean;
  maxDurationMs?: number;
};

export type ContextualParseResult = {
  selectedCandidate: ParsedClockCandidate | null;
  candidates: ParsedClockCandidate[];
  formatState: ClockFormatState;
  gameClockMs: number | null;
  normalizedText: string | null;
};

export function formatMsToClockString(ms: number | null): string {
  if (ms === null || ms < 0) return "--:--";

  const totalSeconds = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);

  // Under 1 minute, format as SS.T or SS.0
  if (totalSeconds < 60) {
    const s = totalSeconds.toString().padStart(2, "0");
    if (tenths > 0 || ms % 1000 !== 0) {
      return `${s}.${tenths}`;
    }
  }

  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Context-aware parser that generates candidates for an OCR result string,
 * evaluates probabilities based on surrounding timeline context, and selects
 * the most probable Game Clock value.
 */
export function parseClockWithContext(
  str: string,
  context: ParseClockContext = {}
): ContextualParseResult {
  const fallbackState: ClockFormatState = context.formatState || "UNKNOWN";

  if (!str) {
    return {
      selectedCandidate: null,
      candidates: [],
      formatState: fallbackState,
      gameClockMs: null,
      normalizedText: null,
    };
  }

  // 1. Common character mapping for OCR digit confusion
  const cleanOcrChars = (s: string) => {
    // Remove surrounding noise characters like brackets, quotes, braces, tildes, dashes
    let cleaned = s.replace(/[\{\}\[\]\(\)'"`~\—|\\;,\=_]/g, " ");
    // Collapse single spaced digits (e.g., "0 8 : 3 2" -> "08:32")
    cleaned = cleaned.replace(/(\b\d)\s+(\d\b)/g, "$1$2").replace(/(\b\d)\s+(\d\b)/g, "$1$2");
    
    // Replace OCR character confusions
    return cleaned
      .replace(/[Oo]/g, "0")
      .replace(/B/g, "8")
      .replace(/[Ss]/g, "5")
      .replace(/G/g, "6")
      .replace(/[zZ]/g, "2")
      .replace(/[Il|i\]]/g, "1")
      .replace(/E/g, "3")
      .replace(/A/g, "4")
      .replace(/T/g, "7")
      .replace(/q/g, "9");
  };

  let raw = str.trim();
  let cleaned = cleanOcrChars(raw);

  const prevMs = context.previousValidGameClockMs ?? null;

  // Determine whether timeline context indicates under-1-minute state
  const isNearQuarterEnd =
    context.quarterMarker != null &&
    context.currentVideoTimeSeconds != null &&
    context.quarterMarker.videoEndSeconds - context.currentVideoTimeSeconds <= 90;

  const isUnder1MinContext =
    context.isUnderOneMinuteContext === true ||
    context.formatState === "UNDER_ONE_MINUTE_DECIMAL" ||
    (prevMs !== null && prevMs <= 60000) ||
    isNearQuarterEnd;

  const candidates: ParsedClockCandidate[] = [];

  // Helper to test a pair of minute/second or second/decimal strings
  const evaluateTimePair = (minsStr: string, secsStr: string, sourcePattern: string) => {
    let num1 = parseInt(minsStr, 10);
    let num2 = parseInt(secsStr, 10);
    if (isNaN(num1) || isNaN(num2)) return;

    // Standard MM:SS (e.g. 09:32, 01:46)
    if (num1 < 60 && num2 < 60) {
      let ms = (num1 * 60 + num2) * 1000;
      let prob = 0.94; // Strong base probability for explicit MM:SS clock format
      const flags: string[] = [`PATTERN_${sourcePattern}`];

      if (isUnder1MinContext) {
        if (num1 > 0) {
          prob *= 0.15; // In under 1 minute context, multi-minute clock is highly unlikely
          flags.push("UNDER_ONE_MINUTE_TIMELINE_CONTEXT_PENALTY");
        } else {
          prob *= 0.90;
          flags.push("UNDER_ONE_MINUTE_MMSS_ZERO_MINS");
        }
      }

      if (prevMs !== null) {
        if (prevMs <= 60000 && num1 > 0) {
          prob *= 0.10;
          flags.push("PREVIOUS_CLOCK_BELOW_1MIN");
        } else if (prevMs > 60000 && prevMs - ms <= 60000 && ms <= prevMs) {
          prob += 0.05;
          flags.push("LOGICAL_COUNTDOWN_MMSS");
        }
      }

      if (context.maxDurationMs && ms > context.maxDurationMs + 60000) {
        prob *= 0.10;
        flags.push("EXCEEDS_MAX_DURATION");
      }

      candidates.push({
        gameClockMs: ms,
        format: "MM_SS",
        probability: Math.max(0.05, Math.min(0.99, prob)),
        reasoningFlags: flags,
      });

      // --- DIGIT CONFUSION GUESSING RELATIVE TO PREVIOUS CLOCK ---
      if (prevMs !== null && prevMs > 60000) {
        const estimatedDiff = Math.abs(prevMs - ms);
        if (estimatedDiff > 45000) {
          const swapMap: Record<string, string[]> = {
            "5": ["8", "2", "3"],
            "8": ["5", "3", "0"],
            "0": ["8", "9", "6"],
            "1": ["7"],
            "7": ["1"],
            "2": ["5", "3"],
            "3": ["8", "5"],
          };

          const minsChars = minsStr.padStart(2, "0").split("");
          for (let pos = 0; pos < minsChars.length; pos++) {
            const origDigit = minsChars[pos];
            const alternates = swapMap[origDigit] || [];
            for (const altDigit of alternates) {
              const swappedChars = [...minsChars];
              swappedChars[pos] = altDigit;
              const swappedMins = parseInt(swappedChars.join(""), 10);
              if (swappedMins < 60) {
                const swappedMs = (swappedMins * 60 + num2) * 1000;
                if (Math.abs(prevMs - swappedMs) <= 45000) {
                  candidates.push({
                    gameClockMs: swappedMs,
                    format: "MM_SS",
                    probability: 0.90,
                    reasoningFlags: [`OCR_DIGIT_SWAP_${origDigit}_TO_${altDigit}`],
                  });
                }
              }
            }
          }
        }
      }
    }

    // SS_T / SS_TT Subsecond / Decimal interpretation (e.g., 45.8s, 08.2s, or SS:TT under 1 min)
    if (num1 < 60) {
      let decimalMs = secsStr.length === 1 ? num1 * 1000 + num2 * 100 : num1 * 1000 + num2 * 10;
      let prob = 0.30; // Low base probability for isolated decimals when not in under-1-min context
      const flags: string[] = ["SS_T_DECIMAL"];

      // Under 1 minute context or num1 === 0 (e.g. 00:45.8) strongly boosts decimal subseconds
      if (isUnder1MinContext || (prevMs !== null && prevMs <= 60000) || num1 === 0) {
        prob = 0.92;
        flags.push("UNDER_ONE_MINUTE_DECIMAL_BOOST");
        if (prevMs !== null && Math.abs(prevMs - decimalMs) <= 20000) {
          prob += 0.05;
          flags.push("LOGICAL_SUBSECOND_COUNTDOWN");
        }
      } else {
        // In standard time context (e.g. 9 mins in quarter), isolated decimals like 43.8 are likely shot clock / score noise
        if (secsStr.length === 2 && num2 < 60) {
          prob -= 0.15;
        }
      }

      candidates.push({
        gameClockMs: decimalMs,
        format: "SS_T",
        probability: Math.max(0.01, Math.min(0.99, prob)),
        reasoningFlags: flags,
      });
    }
  };

  // Match Pattern 1: Find ALL Embedded MM:SS, M:SS or separator-delimited time tokens (accepts :, ., -, ', `, ,, /, or spaces)
  const embeddedClockRegex = /(\d{1,2})\s*[:.\-',`\/ ]\s*(\d{1,2})/g;
  let match: RegExpExecArray | null;
  while ((match = embeddedClockRegex.exec(cleaned)) !== null) {
    evaluateTimePair(match[1], match[2], "EMBEDDED_MMSS");
  }

  // Match Pattern 1b: Decimal tenths clock (e.g., "00:12.4" or "12.4" or "05.8")
  const tenthsClockRegex = /(\d{1,2})\s*[.:]\s*(\d{1,2})\s*[.:]\s*(\d)/g;
  while ((match = tenthsClockRegex.exec(cleaned)) !== null) {
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const tenths = parseInt(match[3], 10);
    if (!isNaN(mins) && !isNaN(secs) && !isNaN(tenths) && secs < 60) {
      const ms = (mins * 60 + secs) * 1000 + tenths * 100;
      candidates.push({
        gameClockMs: ms,
        format: "SS_T",
        probability: 0.95,
        reasoningFlags: ["EXACT_TENTHS_MATCH"],
      });
    }
  }

  // Match Pattern 2: Digits only without separator (e.g., "0810" -> "08", "10")
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly.length === 3 || digitsOnly.length === 4) {
    const minsStr = digitsOnly.slice(0, digitsOnly.length - 2);
    const secsStr = digitsOnly.slice(digitsOnly.length - 2);
    evaluateTimePair(minsStr, secsStr, "DIGITS_ONLY");
  }

  // Match Pattern 3: Loose match if no candidate generated yet (e.g. "07:5" or "7.2")
  if (candidates.length === 0) {
    const looseMatch = cleaned.match(/(\d{1,2})\s*[:.\-',`\/ ]\s*(\d{1,2})/);
    if (looseMatch) {
      evaluateTimePair(looseMatch[1], looseMatch[2], "LOOSE_PAIR");
    }
  }

  // Filter out candidates with probability <= 0
  const validCandidates = candidates
    .filter((c) => c.probability > 0)
    .sort((a, b) => b.probability - a.probability);

  if (validCandidates.length === 0) {
    return {
      selectedCandidate: null,
      candidates: [],
      formatState: fallbackState,
      gameClockMs: null,
      normalizedText: null,
    };
  }

  const selected = validCandidates[0];
  const updatedFormatState: ClockFormatState =
    selected.format === "SS_T" || selected.format === "SS"
      ? "UNDER_ONE_MINUTE_DECIMAL"
      : selected.format === "MM_SS"
      ? "STANDARD_MINUTES_SECONDS"
      : fallbackState;

  const formattedText = formatMsToClockString(selected.gameClockMs);

  return {
    selectedCandidate: selected,
    candidates: validCandidates,
    formatState: updatedFormatState,
    gameClockMs: selected.gameClockMs,
    normalizedText: formattedText,
  };
}

export function parseClockStringToMs(
  str: string,
  maxDurationMs: number = 720000,
  context: ParseClockContext = {}
): number | null {
  const result = parseClockWithContext(str, { ...context, maxDurationMs });
  if (result.selectedCandidate && result.gameClockMs !== null) {
    return result.gameClockMs;
  }
  return null;
}

export function formatSecondsToTimecode(totalSecs: number): string {
  if (isNaN(totalSecs) || totalSecs < 0) return "00:00:00";
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);

  const mStr = m.toString().padStart(2, "0");
  const sStr = s.toString().padStart(2, "0");

  if (h > 0) {
    const hStr = h.toString().padStart(2, "0");
    return `${hStr}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

export function parseYtTimeSeconds(str: string): number | null {
  if (!str) return null;
  const cleaned = str
    .replace(/[Oo]/g, "0")
    .replace(/B/g, "8")
    .replace(/[Ss]/g, "5")
    .replace(/G/g, "6")
    .replace(/[zZ]/g, "2")
    .replace(/[Il|i\]]/g, "1")
    .replace(/E/g, "3")
    .replace(/A/g, "4")
    .replace(/T/g, "7")
    .replace(/q/g, "9")
    .trim();

  // Match HH:MM:SS or MM:SS
  const matchHms = cleaned.match(/(\d{1,2})[:.\s]+(\d{1,2})[:.\s]+(\d{1,2})/);
  if (matchHms) {
    const h = parseInt(matchHms[1], 10);
    const m = parseInt(matchHms[2], 10);
    const s = parseInt(matchHms[3], 10);
    if (m < 60 && s < 60) {
      return h * 3600 + m * 60 + s;
    }
  }

  const matchMs = cleaned.match(/(\d{1,3})[:.\s]+(\d{1,2})/);
  if (matchMs) {
    const m = parseInt(matchMs[1], 10);
    const s = parseInt(matchMs[2], 10);
    if (s < 60) {
      return m * 60 + s;
    }
  }

  return null;
}

export function formatSecondsToMMSS(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || isNaN(sec) || sec < 0) return "--:--";
  return formatSecondsToTimecode(sec);
}
