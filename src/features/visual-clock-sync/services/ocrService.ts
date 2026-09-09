import Tesseract from 'tesseract.js';
import { ClockOCRResult } from '../types';
import { normalizeClockString } from '../utils/imageUtils';
import { ParseClockContext } from '../../automatic-clock-mapping/utils/clockParser';

/**
 * Performs client-side OCR on preprocessed image variant(s) using Tesseract.js.
 * Runs 100% locally in the browser with WebAssembly (no external API calls).
 */
export async function performOCR(
  imageSources: string | string[],
  context?: ParseClockContext
): Promise<ClockOCRResult> {
  const sources = Array.isArray(imageSources) ? imageSources : [imageSources];

  const psmModes = ['7', '8', '6'];

  let bestValidResult: ClockOCRResult | null = null;
  let highestConfidenceRawResult: ClockOCRResult = {
    rawText: '',
    normalizedText: null,
    milliseconds: null,
    confidence: 0,
    isValid: false
  };

  for (const src of sources) {
    if (!src) continue;

    for (const psm of psmModes) {
      try {
        const result = await Tesseract.recognize(
          src,
          'eng',
          {
            // @ts-ignore
            tessedit_char_whitelist: '0123456789:.',
            tessedit_pageseg_mode: psm,
          }
        );

        const rawText = result.data.text || '';
        const confidence = result.data.confidence || 0;
        const { normalized, milliseconds, selectedCandidate } = normalizeClockString(rawText, context);

        if (normalized !== null && milliseconds !== null) {
          const currentRes: ClockOCRResult = {
            rawText,
            normalizedText: normalized,
            milliseconds,
            confidence,
            isValid: true,
            selectedCandidate
          };

          if (!bestValidResult || confidence > bestValidResult.confidence) {
            bestValidResult = currentRes;
          }

          // If high confidence valid result, return immediately
          if (confidence >= 80) {
            return bestValidResult;
          }
        }

        if (confidence > highestConfidenceRawResult.confidence) {
          highestConfidenceRawResult = {
            rawText,
            normalizedText: normalized,
            milliseconds,
            confidence,
            isValid: milliseconds !== null
          };
        }
      } catch (err) {
        console.warn(`Tesseract OCR attempt failed for PSM ${psm}:`, err);
      }
    }
  }

  return bestValidResult || highestConfidenceRawResult;
}

