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

  const startDrawing = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasBaseImage) return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistoryState();
      exportDataUrls();
    }
  };

  const draw = (e: React.MouseEvent<HTMLDivElement>) => {
    const maskCanvas = maskCanvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    if (!maskCanvas || !cursorCanvas) return;

    const { x, y } = getCanvasCoords(e);

    // Update cursor overlay
    const curCtx = cursorCanvas.getContext('2d');
    if (curCtx) {
      curCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
      curCtx.beginPath();
      curCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      curCtx.strokeStyle = tool === 'brush' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.8)';
      curCtx.lineWidth = 2;
      curCtx.stroke();
    }

    if (!isDrawing) return;

    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    }

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Export Base Image and Binary Mask
  const exportDataUrls = () => {
    if (!baseCanvasRef.current || !maskCanvasRef.current || !onMaskReady) return;

    const baseDataUrl = baseCanvasRef.current.toDataURL('image/png');

    // Generate strict binary mask for ComfyUI VAEEncodeForInpaint:
    // White (#FFFFFF) for inpaint target, Black (#000000) for unmasked
    const maskCanvas = maskCanvasRef.current;
    const binaryCanvas = document.createElement('canvas');
    binaryCanvas.width = maskCanvas.width;
    binaryCanvas.height = maskCanvas.height;
    const bCtx = binaryCanvas.getContext('2d');
    if (!bCtx) return;

    // Fill completely black
    bCtx.fillStyle = '#000000';
    bCtx.fillRect(0, 0, binaryCanvas.width, binaryCanvas.height);

    // Read drawn mask
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      const srcData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const binData = bCtx.getImageData(0, 0, binaryCanvas.width, binaryCanvas.height);
      for (let i = 0; i < srcData.data.length; i += 4) {
        if (srcData.data[i + 3] > 20) {
          binData.data[i] = 255;
          binData.data[i + 1] = 255;
          binData.data[i + 2] = 255;
          binData.data[i + 3] = 255;
        }
      }
      bCtx.putImageData(binData, 0, 0);
    }

    const binaryMaskUrl = binaryCanvas.toDataURL('image/png');
    onMaskReady(baseDataUrl, binaryMaskUrl, maskCanvas.width, maskCanvas.height);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d121f] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#131b2e] border-b border-slate-800 gap-2">
        <div className="flex items-center space-x-2">
          {/* Tool selectors */}
          <button
            onClick={() => setTool('brush')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              tool === 'brush'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Brush Mask</span>
          </button>

          <button
            onClick={() => setTool('eraser')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              tool === 'eraser'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Brush size slider */}
          <div className="flex items-center space-x-2 bg-slate-900/70 px-3 py-1 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 font-mono">Size:</span>
            <input
              type="range"
              min="5"
              max="160"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <span className="text-xs text-indigo-400 font-mono w-6 text-right">{brushSize}</span>
          </div>

          {/* Mask visibility toggle */}
          <button
            onClick={() => setMaskVisible(!maskVisible)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            title={maskVisible ? 'Hide Mask Overlay' : 'Show Mask Overlay'}
          >
            {maskVisible ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo Mask Stroke"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo Mask Stroke"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <button
            onClick={invertMask}
            disabled={!hasBaseImage}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            title="Invert Inpaint Mask"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>Invert</span>
          </button>

          <button
            onClick={clearMask}
            disabled={!hasBaseImage}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 text-rose-400 hover:bg-rose-950/40 disabled:opacity-40"
            title="Clear Mask"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition shadow-sm">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Base Image</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div 
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center p-4 bg-[#0a0e1a] overflow-auto cursor-crosshair min-h-[480px]"
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onMouseMove={draw}
      >
        {!hasBaseImage ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-2xl p-12 max-w-md text-center bg-slate-900/40 backdrop-blur-sm">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 mb-4 ring-1 ring-indigo-500/20">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">InvokeAI Production Inpaint Canvas</h3>
            <p className="text-xs text-slate-400 mb-6">
              Drop an image here or click below to upload. You can also select "Send to Canvas" from the image gallery.
            </p>
            <label className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-lg shadow-indigo-600/30 transition">
              Select Base Image
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div 
            className="relative shadow-2xl rounded-lg overflow-hidden border border-slate-800"
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
        <div className="flex items-center justify-between px-4 py-2 bg-[#101728] border-t border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center space-x-4">
            <span>Canvas: <strong className="text-slate-200">{imageDimensions.width} × {imageDimensions.height} px</strong></span>
            <span>Tool: <strong className="text-indigo-400 capitalize">{tool}</strong></span>
          </div>
          <div className="flex items-center space-x-2 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Mask sync active (White = Inpaint target)</span>
          </div>
        </div>
      )}
    </div>
  );
};
