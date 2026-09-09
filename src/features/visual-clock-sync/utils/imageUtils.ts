import { NormalizedClockRegion } from '../types';
import { parseClockWithContext, formatMsToClockString, ParseClockContext } from '../../automatic-clock-mapping/utils/clockParser';
import { ParsedClockCandidate } from '../../automatic-clock-mapping/types';

/**
 * Core helper that crops a canvas (source image/frame) using a normalized region
 * with an automatic safety margin (+12%), upscales it (4x), and generates preprocessed
 * high-contrast variants for Tesseract OCR.
 */
export function processCanvasRegion(
  sourceCanvas: HTMLCanvasElement,
  region: NormalizedClockRegion
): { rawUrl: string; processedUrl: string; croppedCanvas: HTMLCanvasElement; variantUrls: string[] } {
  const nativeWidth = sourceCanvas.width;
  const nativeHeight = sourceCanvas.height;

  if (nativeWidth === 0 || nativeHeight === 0) {
    throw new Error("Source canvas dimensions are zero.");
  }

  // 1. Crop exact user-selected normalized region on native image dimensions (1:1 precision)
  const cropX1 = Math.max(0, Math.floor(region.xRatio * nativeWidth));
  const cropY1 = Math.max(0, Math.floor(region.yRatio * nativeHeight));
  const cropX2 = Math.min(nativeWidth, Math.ceil((region.xRatio + region.widthRatio) * nativeWidth));
  const cropY2 = Math.min(nativeHeight, Math.ceil((region.yRatio + region.heightRatio) * nativeHeight));

  const cropW = Math.max(1, cropX2 - cropX1);
  const cropH = Math.max(1, cropY2 - cropY1);

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = cropW;
  croppedCanvas.height = cropH;
  const croppedCtx = croppedCanvas.getContext("2d");
  if (!croppedCtx) {
    throw new Error("Could not get 2D context for cropped canvas");
  }

  croppedCtx.drawImage(
    sourceCanvas,
    cropX1, cropY1, cropW, cropH,
    0, 0, cropW, cropH
  );

  const rawUrl = croppedCanvas.toDataURL("image/png");

  // 2. Preprocess & upscale (4x) with white border padding
  const scale = 4;
  const padding = 30;
  const targetW = cropW * scale + padding * 2;
  const targetH = cropH * scale + padding * 2;

  // Helper to create an upscaled, preprocessed variant canvas
  const createProcessedVariantCanvas = (mode: 'contrast' | 'binary' | 'adaptive' | 'inverted' | 'sharpened') => {
    const cropScaledCanvas = document.createElement("canvas");
    cropScaledCanvas.width = cropW * scale;
    cropScaledCanvas.height = cropH * scale;
    const csCtx = cropScaledCanvas.getContext("2d")!;
    csCtx.imageSmoothingEnabled = true;
    csCtx.imageSmoothingQuality = "high";
    csCtx.drawImage(croppedCanvas, 0, 0, cropW * scale, cropH * scale);

    const imgData = csCtx.getImageData(0, 0, cropW * scale, cropH * scale);
    const data = imgData.data;

    let totalLuminance = 0;
    for (let i = 0; i < data.length; i += 4) {
      totalLuminance += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    const avgLuminance = data.length > 0 ? totalLuminance / (data.length / 4) : 128;
    const isLightTextOnDark = avgLuminance < 160;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;

      if (mode === 'contrast') {
        if (isLightTextOnDark) gray = 255 - gray;
        let val = (gray - 20) * (255 / (235 - 20));
        val = Math.max(0, Math.min(255, val));
        data[i] = data[i + 1] = data[i + 2] = val;
      } else if (mode === 'binary') {
        let val = gray > (isLightTextOnDark ? 110 : 145) ? 255 : 0;
        if (isLightTextOnDark) val = 255 - val;
        data[i] = data[i + 1] = data[i + 2] = val;
      } else if (mode === 'adaptive') {
        const threshold = isLightTextOnDark ? avgLuminance * 0.9 : avgLuminance * 1.1;
        let val = gray > threshold ? 255 : 0;
        if (isLightTextOnDark) val = 255 - val;
        data[i] = data[i + 1] = data[i + 2] = val;
      } else if (mode === 'inverted') {
        let val = isLightTextOnDark ? gray : 255 - gray;
        data[i] = data[i + 1] = data[i + 2] = val;
      } else { // 'sharpened'
        let val = gray > 128 ? 255 : (gray < 70 ? 0 : gray);
        if (isLightTextOnDark) val = 255 - val;
        data[i] = data[i + 1] = data[i + 2] = val;
      }
    }

    csCtx.putImageData(imgData, 0, 0);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const cCtx = canvas.getContext("2d")!;

    cCtx.fillStyle = "#FFFFFF";
    cCtx.fillRect(0, 0, targetW, targetH);
    cCtx.drawImage(cropScaledCanvas, padding, padding);

    return canvas.toDataURL("image/png");
  };

  const variant1Url = createProcessedVariantCanvas('contrast');
  const variant2Url = createProcessedVariantCanvas('binary');
  const variant3Url = createProcessedVariantCanvas('adaptive');
  const variant4Url = createProcessedVariantCanvas('inverted');
  const variant5Url = createProcessedVariantCanvas('sharpened');

  return {
    rawUrl,
    processedUrl: variant1Url,
    croppedCanvas,
    variantUrls: [variant1Url, variant2Url, variant3Url, variant4Url, variant5Url, rawUrl]
  };
}

/**
 * Captures a frame from a video element, crops the specified normalized region,
 * upscales it, and preprocesses it with multiple variants for optimal OCR recognition.
 */
export function captureAndCropFrame(
  videoEl: HTMLVideoElement,
  region: NormalizedClockRegion
): { rawUrl: string; processedUrl: string; croppedCanvas: HTMLCanvasElement; variantUrls: string[] } {
  const nativeWidth = videoEl.videoWidth;
  const nativeHeight = videoEl.videoHeight;

  if (nativeWidth === 0 || nativeHeight === 0) {
    throw new Error("Video resolution is zero. Stream might be inactive.");
  }

  const rawCanvas = document.createElement("canvas");
  rawCanvas.width = nativeWidth;
  rawCanvas.height = nativeHeight;
  const ctx = rawCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get 2D context for capture canvas");
  }
  ctx.drawImage(videoEl, 0, 0, nativeWidth, nativeHeight);

  return processCanvasRegion(rawCanvas, region);
}

/**
 * Crops a normalized region from an HTMLImageElement (e.g. screenshot frame) and generates
 * raw & preprocessed variants for OCR testing.
 */
export function cropScreenshotRegion(
  imgEl: HTMLImageElement,
  region: NormalizedClockRegion
): { rawUrl: string; processedUrl: string; variantUrls: string[] } {
  const nativeWidth = imgEl.naturalWidth || imgEl.width;
  const nativeHeight = imgEl.naturalHeight || imgEl.height;

  if (nativeWidth === 0 || nativeHeight === 0) {
    throw new Error("Image dimensions unavailable.");
  }

  const rawCanvas = document.createElement("canvas");
  rawCanvas.width = nativeWidth;
  rawCanvas.height = nativeHeight;
  const ctx = rawCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get 2D context.");
  }
  ctx.drawImage(imgEl, 0, 0, nativeWidth, nativeHeight);

  const res = processCanvasRegion(rawCanvas, region);
  return {
    rawUrl: res.rawUrl,
    processedUrl: res.processedUrl,
    variantUrls: res.variantUrls,
  };
}

/**
 * Normalizes common OCR mistakes in clock strings and parses minutes/seconds using context if provided.
 */
export function normalizeClockString(
  raw: string,
  context?: ParseClockContext
): {
  normalized: string | null;
  milliseconds: number | null;
  selectedCandidate?: ParsedClockCandidate | null;
} {
  if (!raw) return { normalized: null, milliseconds: null };

  const result = parseClockWithContext(raw, context);
  if (!result.selectedCandidate || result.selectedCandidate.probability < 0.30) {
    return { normalized: null, milliseconds: null };
  }

  return {
    normalized: result.normalizedText,
    milliseconds: result.gameClockMs,
    selectedCandidate: result.selectedCandidate,
  };
}
