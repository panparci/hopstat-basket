import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Check, RefreshCw, ZoomIn, ZoomOut, Move, Maximize2, Scan, AlertTriangle, Sparkles, RotateCcw } from "lucide-react";
import { NormalizedClockRegion, ClockOCRResult } from "../types";
import { cropScreenshotRegion } from "../utils/imageUtils";
import { performOCR } from "../services/ocrService";

export interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenshotUrl: string; // Base64 raw capture frame
  onConfirm: (
    primaryRegion: NormalizedClockRegion,
    altRegion?: NormalizedClockRegion | null,
    ytTimerRegion?: NormalizedClockRegion | null
  ) => void;
  initialRegion?: NormalizedClockRegion | null;
  initialAltRegion?: NormalizedClockRegion | null;
  initialYtTimerRegion?: NormalizedClockRegion | null;
  calibratingType?: "primary" | "alternative" | "ytTimer";
}

interface BoxRatio {
  xRatio: number;
  yRatio: number;
  wRatio: number;
  hRatio: number;
}

interface OcrTestState {
  isTesting: boolean;
  result: (ClockOCRResult & { rawCropUrl: string; processedCropUrl: string }) | null;
  error: string | null;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  screenshotUrl,
  onConfirm,
  initialRegion,
  initialAltRegion,
  initialYtTimerRegion,
  calibratingType = "primary",
}) => {
  const [activeBoxType, setActiveBoxType] = useState<"primary" | "alt" | "ytTimer">(
    calibratingType === "alternative" ? "alt" : calibratingType === "ytTimer" ? "ytTimer" : "primary"
  );

  const [primaryBox, setPrimaryBox] = useState<BoxRatio | null>(null);
  const [altBox, setAltBox] = useState<BoxRatio | null>(null);
  const [ytTimerBox, setYtTimerBox] = useState<BoxRatio | null>(null);

  const [zoomScale, setZoomScale] = useState<number>(1);
  const [showOcrInspector, setShowOcrInspector] = useState<boolean>(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isMoving, setIsMoving] = useState<"primary" | "alt" | "ytTimer" | null>(null);
  const [isResizing, setIsResizing] = useState<{ type: "primary" | "alt" | "ytTimer"; handle: string } | null>(null);

  const [dragStartMouse, setDragStartMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [originalBoxRatio, setOriginalBoxRatio] = useState<BoxRatio | null>(null);

  const [ocrTest, setOcrTest] = useState<OcrTestState>({
    isTesting: false,
    result: null,
    error: null,
  });

  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Recalculate containerSize so containerRef strictly matches displayed image content
  const recalculateContainerSize = useCallback(() => {
    if (!imgRef.current) return;
    const nativeW = imgRef.current.naturalWidth || 1920;
    const nativeH = imgRef.current.naturalHeight || 1080;
    if (nativeW === 0 || nativeH === 0) return;

    const maxW = Math.max(300, (window.innerWidth - 32) * zoomScale);
    const maxH = Math.max(200, (window.innerHeight - 140) * zoomScale);
    const aspect = nativeW / nativeH;

    let width = maxW;
    let height = width / aspect;

    if (height > maxH) {
      height = maxH;
      width = height * aspect;
    }

    setContainerSize({
      width: Math.round(width),
      height: Math.round(height),
    });
  }, [zoomScale]);

  useEffect(() => {
    if (!isOpen) return;
    recalculateContainerSize();

    const handleResize = () => recalculateContainerSize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, recalculateContainerSize, screenshotUrl, zoomScale]);

  // Sync initial regions when opened
  useEffect(() => {
    if (isOpen) {
      setIsDrawing(false);
      setIsMoving(null);
      setIsResizing(null);
      setZoomScale(1);
      setShowOcrInspector(false);
      setOcrTest({ isTesting: false, result: null, error: null });
      setActiveBoxType(calibratingType === "alternative" ? "alt" : "primary");

      if (initialRegion) {
        setPrimaryBox({
          xRatio: initialRegion.xRatio,
          yRatio: initialRegion.yRatio,
          wRatio: initialRegion.widthRatio,
          hRatio: initialRegion.heightRatio,
        });
      } else {
        setPrimaryBox({
          xRatio: 0.325,
          yRatio: 0.41,
          wRatio: 0.35,
          hRatio: 0.18,
        });
      }

      if (initialAltRegion) {
        setAltBox({
          xRatio: initialAltRegion.xRatio,
          yRatio: initialAltRegion.yRatio,
          wRatio: initialAltRegion.widthRatio,
          hRatio: initialAltRegion.heightRatio,
        });
      } else {
        setAltBox(null);
      }

      if (initialYtTimerRegion) {
        setYtTimerBox({
          xRatio: initialYtTimerRegion.xRatio,
          yRatio: initialYtTimerRegion.yRatio,
          wRatio: initialYtTimerRegion.widthRatio,
          hRatio: initialYtTimerRegion.heightRatio,
        });
      } else {
        setYtTimerBox(null);
      }
    }
  }, [isOpen, initialRegion, initialAltRegion, initialYtTimerRegion, calibratingType, screenshotUrl]);

  // Synchronize magnified preview canvas with 1:1 raw crop
  useEffect(() => {
    if (!isOpen || !imgRef.current || !previewCanvasRef.current) return;
    const activeBox = activeBoxType === "primary" ? primaryBox : activeBoxType === "alt" ? altBox : ytTimerBox;
    if (!activeBox || activeBox.wRatio <= 0.005 || activeBox.hRatio <= 0.005) return;

    try {
      const region: NormalizedClockRegion = {
        xRatio: activeBox.xRatio,
        yRatio: activeBox.yRatio,
        widthRatio: activeBox.wRatio,
        heightRatio: activeBox.hRatio,
      };

      const cropRes = cropScreenshotRegion(imgRef.current, region);
      const canvas = previewCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx && cropRes.rawUrl) {
        const pImg = new Image();
        pImg.onload = () => {
          canvas.width = pImg.width;
          canvas.height = pImg.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(pImg, 0, 0);
        };
        pImg.src = cropRes.rawUrl;
      }
    } catch (e) {
      console.warn("Preview render error:", e);
    }
  }, [isOpen, activeBoxType, primaryBox, altBox, ytTimerBox, screenshotUrl]);

  // Mouse drag / resize / move handlers
  useEffect(() => {
    if (!isDrawing && !isMoving && !isResizing) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !containerSize) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cW = rect.width;
      const cH = rect.height;
      if (cW <= 0 || cH <= 0) return;

      if (isDrawing) {
        const startX = dragStartMouse.x - rect.left;
        const startY = dragStartMouse.y - rect.top;
        const currentX = Math.max(0, Math.min(cW, e.clientX - rect.left));
        const currentY = Math.max(0, Math.min(cH, e.clientY - rect.top));

        const newX = Math.min(startX, currentX);
        const newY = Math.min(startY, currentY);
        const newW = Math.abs(currentX - startX);
        const newH = Math.abs(currentY - startY);

        const newBoxRatio: BoxRatio = {
          xRatio: newX / cW,
          yRatio: newY / cH,
          wRatio: newW / cW,
          hRatio: newH / cH,
        };

        if (activeBoxType === "primary") {
          setPrimaryBox(newBoxRatio);
        } else if (activeBoxType === "alt") {
          setAltBox(newBoxRatio);
        } else {
          setYtTimerBox(newBoxRatio);
        }
      } else if (isMoving && originalBoxRatio) {
        const targetType = isMoving;
        const dx = e.clientX - dragStartMouse.x;
        const dy = e.clientY - dragStartMouse.y;

        const origX = originalBoxRatio.xRatio * cW;
        const origY = originalBoxRatio.yRatio * cH;
        const origW = originalBoxRatio.wRatio * cW;
        const origH = originalBoxRatio.hRatio * cH;

        const newX = Math.max(0, Math.min(cW - origW, origX + dx));
        const newY = Math.max(0, Math.min(cH - origH, origY + dy));

        const updated: BoxRatio = {
          ...originalBoxRatio,
          xRatio: newX / cW,
          yRatio: newY / cH,
        };

        if (targetType === "primary") {
          setPrimaryBox(updated);
        } else if (targetType === "alt") {
          setAltBox(updated);
        } else {
          setYtTimerBox(updated);
        }
      } else if (isResizing && originalBoxRatio) {
        const { type: targetType, handle } = isResizing;
        const dx = e.clientX - dragStartMouse.x;
        const dy = e.clientY - dragStartMouse.y;

        const origX = originalBoxRatio.xRatio * cW;
        const origY = originalBoxRatio.yRatio * cH;
        const origW = originalBoxRatio.wRatio * cW;
        const origH = originalBoxRatio.hRatio * cH;

        let nx = origX;
        let ny = origY;
        let nw = origW;
        let nh = origH;

        if (handle.includes("l")) {
          nx = Math.max(0, Math.min(origX + origW - 10, origX + dx));
          nw = origW + (origX - nx);
        }
        if (handle.includes("r")) {
          nw = Math.max(10, Math.min(cW - origX, origW + dx));
        }
        if (handle.includes("t")) {
          ny = Math.max(0, Math.min(origY + origH - 10, origY + dy));
          nh = origH + (origY - ny);
        }
        if (handle.includes("b")) {
          nh = Math.max(10, Math.min(cH - origY, origH + dy));
        }

        const updated: BoxRatio = {
          xRatio: nx / cW,
          yRatio: ny / cH,
          wRatio: nw / cW,
          hRatio: nh / cH,
        };

        if (targetType === "primary") {
          setPrimaryBox(updated);
        } else if (targetType === "alt") {
          setAltBox(updated);
        } else {
          setYtTimerBox(updated);
        }
      }
    };

    const handleWindowMouseUp = () => {
      setIsDrawing(false);
      setIsMoving(null);
      setIsResizing(null);
      setOriginalBoxRatio(null);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDrawing, isMoving, isResizing, dragStartMouse, originalBoxRatio, activeBoxType, containerSize]);

  // Start Move
  const handleStartMove = (type: "primary" | "alt" | "ytTimer", e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveBoxType(type);
    const box = type === "primary" ? primaryBox : type === "alt" ? altBox : ytTimerBox;
    if (!box) return;
    setIsMoving(type);
    setDragStartMouse({ x: e.clientX, y: e.clientY });
    setOriginalBoxRatio({ ...box });
  };

  // Start Resize
  const handleStartResize = (type: "primary" | "alt" | "ytTimer", handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveBoxType(type);
    const box = type === "primary" ? primaryBox : type === "alt" ? altBox : ytTimerBox;
    if (!box) return;
    setIsResizing({ type, handle });
    setDragStartMouse({ x: e.clientX, y: e.clientY });
    setOriginalBoxRatio({ ...box });
  };

  // Canvas Mouse Down to draw new box
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) return;

    setIsDrawing(true);
    setDragStartMouse({ x: e.clientX, y: e.clientY });

    const newBox: BoxRatio = {
      xRatio: clickX / rect.width,
      yRatio: clickY / rect.height,
      wRatio: 0,
      hRatio: 0,
    };

    if (activeBoxType === "primary") {
      setPrimaryBox(newBox);
    } else if (activeBoxType === "alt") {
      setAltBox(newBox);
    } else {
      setYtTimerBox(newBox);
    }
  };

  const handleConfirmClick = () => {
    if (!primaryBox || primaryBox.wRatio <= 0.01 || primaryBox.hRatio <= 0.01) return;

    const primaryNormalized: NormalizedClockRegion = {
      xRatio: primaryBox.xRatio,
      yRatio: primaryBox.yRatio,
      widthRatio: primaryBox.wRatio,
      heightRatio: primaryBox.hRatio,
    };

    const altNormalized: NormalizedClockRegion | null = altBox && altBox.wRatio > 0.01 && altBox.hRatio > 0.01
      ? {
          xRatio: altBox.xRatio,
          yRatio: altBox.yRatio,
          widthRatio: altBox.wRatio,
          heightRatio: altBox.hRatio,
        }
      : null;

    const ytTimerNormalized: NormalizedClockRegion | null = ytTimerBox && ytTimerBox.wRatio > 0.01 && ytTimerBox.hRatio > 0.01
      ? {
          xRatio: ytTimerBox.xRatio,
          yRatio: ytTimerBox.yRatio,
          widthRatio: ytTimerBox.wRatio,
          heightRatio: ytTimerBox.hRatio,
        }
      : null;

    onConfirm(primaryNormalized, altNormalized, ytTimerNormalized);
  };

  const handleResetActiveBox = () => {
    if (activeBoxType === "primary") {
      setPrimaryBox({
        xRatio: 0.325,
        yRatio: 0.41,
        wRatio: 0.35,
        hRatio: 0.18,
      });
    } else if (activeBoxType === "alt") {
      setAltBox(null);
    } else {
      setYtTimerBox(null);
    }
  };

  // Run Test OCR scan on active selection
  const handleRunOcrTest = async () => {
    const activeBox = activeBoxType === "primary" ? primaryBox : activeBoxType === "alt" ? altBox : ytTimerBox;
    if (!activeBox || activeBox.wRatio <= 0.005 || activeBox.hRatio <= 0.005 || !imgRef.current) return;

    setOcrTest({ isTesting: true, result: null, error: null });

    try {
      const region: NormalizedClockRegion = {
        xRatio: activeBox.xRatio,
        yRatio: activeBox.yRatio,
        widthRatio: activeBox.wRatio,
        heightRatio: activeBox.hRatio,
      };

      const cropRes = cropScreenshotRegion(imgRef.current, region);
      const ocrRes = await performOCR(cropRes.variantUrls);

      setOcrTest({
        isTesting: false,
        result: {
          ...ocrRes,
          rawCropUrl: cropRes.rawUrl,
          processedCropUrl: cropRes.processedUrl,
        },
        error: null,
      });
    } catch (err: any) {
      setOcrTest({
        isTesting: false,
        result: null,
        error: err?.message || "OCR test scan failed.",
      });
    }
  };

  if (!isOpen) return null;

  const activeBox = activeBoxType === "primary" ? primaryBox : activeBoxType === "alt" ? altBox : ytTimerBox;

  const renderResizeHandles = (type: "primary" | "alt" | "ytTimer") => {
    const colorClass = type === "primary" ? "bg-amber-400 ring-amber-500/50" : type === "alt" ? "bg-cyan-400 ring-cyan-500/50" : "bg-purple-400 ring-purple-500/50";
    return (
      <>
        {/* Top-Left */}
        <div 
          onMouseDown={(e) => handleStartResize(type, "tl", e)}
          className="absolute -top-3.5 -left-3.5 w-7 h-7 flex items-center justify-center cursor-nwse-resize z-20"
        >
          <div className={`w-3.5 h-3.5 ${colorClass} border-2 border-white rounded-full shadow-lg hover:scale-125 transition-transform ring-2`} />
        </div>
        {/* Top-Center */}
        <div 
          onMouseDown={(e) => handleStartResize(type, "t", e)}
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 flex items-center justify-center cursor-ns-resize z-20"
        >
          <div className={`w-3.5 h-3.5 ${colorClass} border-2 border-white rounded-full shadow-lg hover:scale-125 transition-transform ring-2`} />
        </div>
        {/* Top-Right */}
        <div 
          onMouseDown={(e) => handleStartResize(type, "tr", e)}
          className="absolute -top-3.5 -right-3.5 w-7 h-7 flex items-center justify-center cursor-nesw-resize z-20"
        >
          <div className={`w-3.5 h-3.5 ${colorClass} border-2 border-white rounded-full shadow-lg hover:scale-125 transition-transform ring-2`} />
        </div>
        {/* Right-Center */}
        <div 
          onMouseDown={(e) => handleStartResize(type, "r", e)}
          className="absolute top-1/2 -right-3.5 -translate-y-1/2 w-7 h-7 flex items-center justify-center cursor-ew-resize z-20"
        >
          <div className={`w-3.5 h-3.5 ${colorClass} border-2 border-white rounded-full shadow-lg hover:scale-125 transition-transform ring-2`} />
        </div>
        {/* Bottom-Right */}
        <div 
          onMouseDown={(e) => handleStartResize(type, "br", e)}
          className="absolute -bottom-3.5 -right-3.5 w-7 h-7 flex items-center justify-center cursor-nwse-resize z-20"
        >
          <div className={`w-3.5 h-3.5 ${colorClass} border-2 border-white rounded-full shadow-lg hover:scale-125 transition-transform ring-2`} />
        </div>
        {/* Bottom-Center */}
        <div 
          onMouseDown={(e) => handleStartResize(type, "b", e)}
          className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 flex items-center justify-center cursor-ns-resize z-20"
        >
          <div className={`w-3.5 h-3.5 ${colorClass} border-2 border-white rounded-full shadow-lg hover:scale-125 transition-transform ring-2`} />
        </div>
        {/* Bottom-Left */}
        <div 
          onMouseDown={(e) => handleStartResize(type, "bl", e)}
          className="absolute -bottom-3.5 -left-3.5 w-7 h-7 flex items-center justify-center cursor-nesw-resize z-20"
        >
          <div className={`w-3.5 h-3.5 ${colorClass} border-2 border-white rounded-full shadow-lg hover:scale-125 transition-transform ring-2`} />
        </div>
        {/* Left-Center */}
        <div 
          onMouseDown={(e) => handleStartResize(type, "l", e)}
          className="absolute top-1/2 -left-3.5 -translate-y-1/2 w-7 h-7 flex items-center justify-center cursor-ew-resize z-20"
        >
          <div className={`w-3.5 h-3.5 ${colorClass} border-2 border-white rounded-full shadow-lg hover:scale-125 transition-transform ring-2`} />
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] bg-zinc-950/90 flex flex-col select-none overflow-hidden animate-in fade-in duration-200">
      
      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-3 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between text-white shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/40 text-amber-400">
            <Maximize2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-display font-black italic uppercase tracking-wide text-white">
                OVERLAY LAYAR UTAMA (DEFINE AREA OF OCR)
              </h3>
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Layar Komputer Langsung
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">
              Geser & atur ukuran kotak referensi OCR secara presisi 1:1 di atas tampilan layar
            </p>
          </div>
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-3">
          
          {/* Toggle Primary / Alt / YT Timer Box selection */}
          <div className="flex items-center gap-1 p-1 bg-zinc-800 rounded-xl border border-zinc-700">
            <button
              onClick={() => setActiveBoxType("primary")}
              className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-1.5 ${
                activeBoxType === "primary"
                  ? "bg-amber-500 text-black font-extrabold shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🟡 Area Utama
            </button>
            <button
              onClick={() => setActiveBoxType("alt")}
              className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-1.5 ${
                activeBoxType === "alt"
                  ? "bg-cyan-500 text-black font-extrabold shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🔵 Area Alternatif
            </button>
            <button
              onClick={() => setActiveBoxType("ytTimer")}
              className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-1.5 ${
                activeBoxType === "ytTimer"
                  ? "bg-purple-500 text-white font-extrabold shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🟣 Timer YT
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 p-1 bg-zinc-800/80 rounded-xl border border-zinc-700">
            <button
              onClick={() => setZoomScale((prev) => Math.max(1, parseFloat((prev - 0.5).toFixed(1))))}
              disabled={zoomScale <= 1}
              className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <span className="text-xs font-mono font-bold text-amber-300 px-2 min-w-[40px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((prev) => Math.min(3, parseFloat((prev + 0.5).toFixed(1))))}
              disabled={zoomScale >= 3}
              className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={15} />
            </button>
          </div>

          {/* Toggle OCR Inspector */}
          <button
            onClick={() => setShowOcrInspector(!showOcrInspector)}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-xl transition-all border flex items-center gap-1.5 ${
              showOcrInspector
                ? "bg-amber-500 text-white border-amber-400"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
            }`}
          >
            <Sparkles size={14} />
            Inspector OCR
          </button>

          {/* Reset Box */}
          <button
            onClick={handleResetActiveBox}
            className="px-3 py-1.5 text-xs font-bold uppercase rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            Reset Box
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
            title="Tutup & Batal"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Main Canvas Overlay */}
      <main className="fixed inset-0 w-full h-full pt-16 pb-20 overflow-auto flex items-center justify-center bg-black select-none p-2 sm:p-4">
        {containerSize ? (
          <div 
            ref={containerRef}
            onMouseDown={handleCanvasMouseDown}
            className="relative select-none shrink-0 overflow-hidden"
            style={{
              width: `${containerSize.width}px`,
              height: `${containerSize.height}px`,
              cursor: 'crosshair',
            }}
          >
            <img
              ref={imgRef}
              src={screenshotUrl}
              alt="Overlay Screen Stream"
              draggable={false}
              className="w-full h-full block select-none pointer-events-none object-fill"
              onLoad={recalculateContainerSize}
            />

            {/* Primary Box Overlay (Amber) */}
            {primaryBox && (
              <div
                onMouseDown={(e) => handleStartMove("primary", e)}
                className={`absolute border-2 transition-shadow select-none cursor-move group rounded-sm ${
                  activeBoxType === "primary"
                    ? "border-amber-400 bg-amber-500/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.60)] ring-2 ring-amber-400/50 z-30"
                    : "border-amber-500/80 bg-amber-500/10 z-20 hover:border-amber-400"
                }`}
                style={{
                  left: `${primaryBox.xRatio * 100}%`,
                  top: `${primaryBox.yRatio * 100}%`,
                  width: `${primaryBox.wRatio * 100}%`,
                  height: `${primaryBox.hRatio * 100}%`,
                }}
              >
                <div className="absolute -top-6 left-0 bg-amber-500 text-black text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded shadow flex items-center gap-1 z-10 whitespace-nowrap">
                  <span>🟡 PRIMARY CLOCK</span>
                  <span>X:{Math.round(primaryBox.xRatio * 100)}% Y:{Math.round(primaryBox.yRatio * 100)}% W:{Math.round(primaryBox.wRatio * 100)}%</span>
                </div>

                {activeBoxType === "primary" && renderResizeHandles("primary")}
              </div>
            )}

            {/* Alternative Box Overlay (Cyan) */}
            {altBox && (
              <div
                onMouseDown={(e) => handleStartMove("alt", e)}
                className={`absolute border-2 transition-shadow select-none cursor-move group rounded-sm ${
                  activeBoxType === "alt"
                    ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.60)] ring-2 ring-cyan-400/50 z-30"
                    : "border-cyan-500/80 bg-cyan-500/10 z-20 hover:border-cyan-400"
                }`}
                style={{
                  left: `${altBox.xRatio * 100}%`,
                  top: `${altBox.yRatio * 100}%`,
                  width: `${altBox.wRatio * 100}%`,
                  height: `${altBox.hRatio * 100}%`,
                }}
              >
                <div className="absolute -top-6 left-0 bg-cyan-500 text-black text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded shadow flex items-center gap-1 z-10 whitespace-nowrap">
                  <span>🔵 ALT CLOCK</span>
                  <span>X:{Math.round(altBox.xRatio * 100)}% Y:{Math.round(altBox.yRatio * 100)}% W:{Math.round(altBox.wRatio * 100)}%</span>
                </div>

                {activeBoxType === "alt" && renderResizeHandles("alt")}
              </div>
            )}

            {/* YT Timer Box Overlay (Purple) */}
            {ytTimerBox && (
              <div
                onMouseDown={(e) => handleStartMove("ytTimer", e)}
                className={`absolute border-2 transition-shadow select-none cursor-move group rounded-sm ${
                  activeBoxType === "ytTimer"
                    ? "border-purple-400 bg-purple-500/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.60)] ring-2 ring-purple-400/50 z-30"
                    : "border-purple-500/80 bg-purple-500/10 z-20 hover:border-purple-400"
                }`}
                style={{
                  left: `${ytTimerBox.xRatio * 100}%`,
                  top: `${ytTimerBox.yRatio * 100}%`,
                  width: `${ytTimerBox.wRatio * 100}%`,
                  height: `${ytTimerBox.hRatio * 100}%`,
                }}
              >
                <div className="absolute -top-6 left-0 bg-purple-500 text-white text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded shadow flex items-center gap-1 z-10 whitespace-nowrap">
                  <span>🟣 YT TIMER (CROSS-CHECK)</span>
                  <span>X:{Math.round(ytTimerBox.xRatio * 100)}% Y:{Math.round(ytTimerBox.yRatio * 100)}% W:{Math.round(ytTimerBox.wRatio * 100)}%</span>
                </div>

                {activeBoxType === "ytTimer" && renderResizeHandles("ytTimer")}
              </div>
            )}
          </div>
        ) : (
          <img
            ref={imgRef}
            src={screenshotUrl}
            alt="Loading..."
            className="max-w-full max-h-[calc(100vh-140px)] object-contain opacity-0"
            onLoad={recalculateContainerSize}
          />
        )}
      </main>

      {/* Inspector OCR Panel */}
      {showOcrInspector && (
        <aside className="fixed top-20 right-6 z-50 w-80 bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-zinc-700 shadow-2xl p-4 flex flex-col gap-4 animate-in slide-in-from-right duration-200 text-white">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
              <Sparkles size={15} /> Inspector OCR ({activeBoxType === "primary" ? "Primary" : activeBoxType === "alt" ? "Alt" : "YT Timer"})
            </span>
            <button 
              onClick={() => setShowOcrInspector(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 p-3 bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-xl w-full">
            <canvas
              ref={previewCanvasRef}
              className="max-w-full max-h-36 object-contain rounded shadow [image-rendering:pixelated]"
            />
          </div>

          <button
            onClick={handleRunOcrTest}
            disabled={ocrTest.isTesting || !activeBox || activeBox.wRatio <= 0.005}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {ocrTest.isTesting ? (
              <>
                <RefreshCw size={15} className="animate-spin text-white" />
                Scanning OCR...
              </>
            ) : (
              <>
                <Scan size={15} />
                Test Scan Selected Box
              </>
            )}
          </button>

          {ocrTest.result && (
            <div className="flex flex-col gap-2 p-3 bg-black/60 rounded-xl border border-zinc-700 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Status OCR</span>
                {ocrTest.result.isValid ? (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
                    <Check size={11} /> VALID CLOCK
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full flex items-center gap-1">
                    <AlertTriangle size={11} /> UNREADABLE
                  </span>
                )}
              </div>
              <div className="text-center py-1">
                <span className={`text-2xl font-mono font-black ${ocrTest.result.isValid ? "text-emerald-400" : "text-rose-400"}`}>
                  {ocrTest.result.normalizedText || "--:--"}
                </span>
                <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  Akurasi: {Math.round(ocrTest.result.confidence)}%
                </div>
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Floating Bottom Footer Bar */}
      <footer className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-6 py-3 bg-zinc-900/95 border border-zinc-700/80 rounded-2xl shadow-2xl backdrop-blur-md text-white max-w-[90vw]">
        <div className="hidden md:flex items-center gap-2 text-xs text-zinc-300 pr-2 border-r border-zinc-700">
          <span className="p-1 bg-amber-500/20 text-amber-400 rounded">💡</span>
          <span>Geser / atur kotak referensi OCR (Kuning/Biru) langsung di atas layar, lalu klik Simpan.</span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleConfirmClick}
            disabled={!primaryBox || primaryBox.wRatio <= 0.01 || primaryBox.hRatio <= 0.01}
            className="px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center gap-2"
          >
            <Check size={16} strokeWidth={2.5} />
            Simpan Referensi Area OCR
          </button>
        </div>
      </footer>

    </div>
  );
};
