import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Paintbrush, Eraser, RotateCcw, Undo2, Redo2, 
  Upload, Trash2, FlipHorizontal, Eye, EyeOff, ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';

interface InpaintCanvasProps {
  initialImage?: string | null;
  onMaskReady?: (baseDataUrl: string, maskDataUrl: string, width: number, height: number) => void;
}

export const InpaintCanvas: React.FC<InpaintCanvasProps> = ({
  initialImage,
  onMaskReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState<number>(40);
  const [brushOpacity, setBrushOpacity] = useState<number>(0.6);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasBaseImage, setHasBaseImage] = useState<boolean>(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 1024, height: 1024 });
  const [maskVisible, setMaskVisible] = useState<boolean>(true);

  // History stack for Undo / Redo
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const saveHistoryState = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    const currentState = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, currentState];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const maskCanvas = maskCanvasRef.current;
      const ctx = maskCanvas?.getContext('2d');
      if (ctx && history[newIndex]) {
        ctx.putImageData(history[newIndex], 0, 0);
        setHistoryIndex(newIndex);
      }
    } else if (historyIndex === 0) {
      clearMask();
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const maskCanvas = maskCanvasRef.current;
      const ctx = maskCanvas?.getContext('2d');
      if (ctx && history[newIndex]) {
        ctx.putImageData(history[newIndex], 0, 0);
        setHistoryIndex(newIndex);
      }
    }
  };

  const loadImageToCanvas = (src: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const width = img.naturalWidth || 1024;
      const height = img.naturalHeight || 1024;
      setImageDimensions({ width, height });
      setHasBaseImage(true);

      [baseCanvasRef.current, maskCanvasRef.current, cursorCanvasRef.current].forEach((c) => {
        if (c) {
          c.width = width;
          c.height = height;
        }
      });

      const baseCtx = baseCanvasRef.current?.getContext('2d');
      if (baseCtx) {
        baseCtx.clearRect(0, 0, width, height);
        baseCtx.drawImage(img, 0, 0, width, height);
      }

      clearMask();
    };
    img.src = src;
  };

  useEffect(() => {
    if (initialImage) {
      loadImageToCanvas(initialImage);
    }
  }, [initialImage]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        loadImageToCanvas(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      const emptyState = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      setHistory([emptyState]);
      setHistoryIndex(0);
    }
  };

  const invertMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 10) {
        data[i + 3] = 0;
      } else {
        data[i] = 239;     // Red tint
        data[i + 1] = 68;
        data[i + 2] = 68;
        data[i + 3] = 200;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    saveHistoryState();
  };

  // Convert canvas mouse coords
  const getCanvasCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return { x: 0, y: 0 };
    const rect = maskCanvas.getBoundingClientRect();
    const scaleX = maskCanvas.width / rect.width;
    const scaleY = maskCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const drawCursor = (x: number, y: number) => {
    const cursorCanvas = cursorCanvasRef.current;
    if (!cursorCanvas) return;
    const ctx = cursorCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = tool === 'brush' ? '#60a5fa' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const startDrawing = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasBaseImage) return;
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    drawStroke(x, y);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistoryState();
      exportMaskData();
    }
  };

  const draw = (e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = getCanvasCoords(e);
    drawCursor(x, y);
    if (isDrawing && hasBaseImage) {
      drawStroke(x, y);
    }
  };

  const drawStroke = (x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);

    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
    }
  };

  // Convert mask layer into grayscale binarized data URL for ComfyUI / Inpaint pipeline
  const exportMaskData = () => {
    const baseCanvas = baseCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!baseCanvas || !maskCanvas || !onMaskReady) return;

    const baseDataUrl = baseCanvas.toDataURL('image/png');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = maskCanvas.width;
    tempCanvas.height = maskCanvas.height;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return;

    tCtx.fillStyle = 'black';
    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;
    const maskImgData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const maskData = maskImgData.data;

    const targetImgData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const targetData = targetImgData.data;

    for (let i = 0; i < maskData.length; i += 4) {
      if (maskData[i + 3] > 10) {
        targetData[i] = 255;
        targetData[i + 1] = 255;
        targetData[i + 2] = 255;
      }
    }
    tCtx.putImageData(targetImgData, 0, 0);
    const maskDataUrl = tempCanvas.toDataURL('image/png');

    onMaskReady(baseDataUrl, maskDataUrl, imageDimensions.width, imageDimensions.height);
  };

  return (
    <div className="flex flex-col h-full bg-surface-panel border border-surface-border rounded-lg overflow-hidden shadow-2xl font-mono text-xs">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-surface-subpanel/70 border-b border-surface-border gap-2">
        {/* Tool Selectors */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setTool('brush')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition ${
              tool === 'brush'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-surface-panel text-slate-400 hover:text-slate-200 border border-surface-border'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Brush</span>
          </button>

          <button
            onClick={() => setTool('eraser')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition ${
              tool === 'eraser'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-surface-panel text-slate-400 hover:text-slate-200 border border-surface-border'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>

          <div className="h-4 w-px bg-surface-border mx-1" />

          {/* Brush size slider */}
          <div className="flex items-center space-x-2 bg-surface-base px-2.5 py-1 rounded-md border border-surface-border">
            <span className="text-[10px] text-slate-400">Size:</span>
            <input
              type="range"
              min="5"
              max="160"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20 cursor-pointer h-1 bg-surface-subpanel rounded-lg"
            />
            <span className="text-[11px] text-brand-400 w-5 text-right font-semibold">{brushSize}</span>
          </div>

          {/* Mask visibility toggle */}
          <button
            onClick={() => setMaskVisible(!maskVisible)}
            className="p-1.5 rounded-md bg-surface-panel text-slate-400 hover:text-slate-200 border border-surface-border transition"
            title={maskVisible ? 'Hide Mask Overlay' : 'Show Mask Overlay'}
          >
            {maskVisible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-md bg-surface-panel text-slate-400 hover:text-slate-200 border border-surface-border disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo Mask Stroke"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-md bg-surface-panel text-slate-400 hover:text-slate-200 border border-surface-border disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo Mask Stroke"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-surface-border mx-1" />

          <button
            onClick={invertMask}
            disabled={!hasBaseImage}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-[11px] bg-surface-panel text-slate-300 hover:text-slate-100 border border-surface-border disabled:opacity-40"
            title="Invert Inpaint Mask"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>Invert</span>
          </button>

          <button
            onClick={clearMask}
            disabled={!hasBaseImage}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-[11px] bg-surface-panel text-rose-400 hover:bg-rose-950/30 border border-surface-border disabled:opacity-40"
            title="Clear Mask"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium bg-brand-600 hover:bg-brand-500 text-white cursor-pointer transition shadow-sm">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div 
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center p-4 bg-[#07080a] bg-[radial-gradient(#141822_1px,transparent_1px)] [background-size:20px_20px] overflow-auto cursor-crosshair min-h-[400px]"
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onMouseMove={draw}
      >
        {!hasBaseImage ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-surface-borderLight rounded-xl p-10 max-w-md text-center bg-surface-panel/60 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 mb-3 shadow-sm">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-100 mb-1">InvokeAI Inpaint Canvas</h3>
            <p className="text-[11px] text-slate-400 mb-5 leading-relaxed font-sans">
              Drop an image here or click below to upload. You can also select "Send to Inpaint" directly from your generated output.
            </p>
            <label className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow transition">
              Select Base Image
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div 
            className="relative shadow-2xl rounded-lg overflow-hidden border border-surface-border bg-black"
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%',
              aspectRatio: `${imageDimensions.width} / ${imageDimensions.height}`
            }}
          >
            {/* Layer 1: Base Image Canvas */}
            <canvas ref={baseCanvasRef} className="block w-full h-full object-contain" />

            {/* Layer 2: Inpaint Mask Layer */}
            <canvas
              ref={maskCanvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-200 ${
                maskVisible ? 'opacity-90' : 'opacity-0'
              }`}
            />

            {/* Layer 3: Interactive Cursor Tracker */}
            <canvas
              ref={cursorCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>
        )}
      </div>

      {/* Footer Info */}
      {hasBaseImage && (
        <div className="flex items-center justify-between px-4 py-2 bg-surface-subpanel/70 border-t border-surface-border text-[10px] text-slate-400">
          <div className="flex items-center space-x-4">
            <span>Canvas: <strong className="text-slate-200">{imageDimensions.width} × {imageDimensions.height} px</strong></span>
            <span>Tool: <strong className="text-brand-400 capitalize">{tool}</strong></span>
          </div>
          <div className="flex items-center space-x-2 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Dual-layer mask active</span>
          </div>
        </div>
      )}
    </div>
  );
};
