import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Paintbrush, Eraser, Undo2, Redo2, 
  Upload, FileUp, Trash2, FlipHorizontal, Eye, EyeOff, 
  ArrowLeft, Sparkles, Sliders, AlertCircle, Maximize2, Minimize2, Info
} from 'lucide-react';
import { OBJECT_REMOVAL_PRESETS } from '../../utils/editIntent';

interface InpaintCanvasProps {
  initialImage?: string | null;
  onMaskReady?: (baseDataUrl: string, maskDataUrl: string, width: number, height: number, growMaskBy?: number) => void;
  onBack?: () => void;
  onInpaint?: (prompt?: string) => void;
  isGenerating?: boolean;
  prompt?: string;
  setPrompt?: (p: string) => void;
  negativePrompt?: string;
  setNegativePrompt?: (p: string) => void;
  denoise?: number;
  setDenoise?: (d: number) => void;
  growMaskBy?: number;
  setGrowMaskBy?: (g: number) => void;
}

export const InpaintCanvas: React.FC<InpaintCanvasProps> = ({
  initialImage,
  onMaskReady,
  onBack,
  onInpaint,
  isGenerating = false,
  prompt: externalPrompt = '',
  setPrompt: externalSetPrompt,
  negativePrompt = '',
  setNegativePrompt,
  denoise = 0.85,
  setDenoise,
  growMaskBy: externalGrowMaskBy = 6,
  setGrowMaskBy: externalSetGrowMaskBy,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);

  // Drawing state
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState<number>(40);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const isDrawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastCoordsRef = useRef<{ x: number; y: number } | null>(null);

  const [hasBaseImage, setHasBaseImage] = useState<boolean>(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 1024, height: 1024 });
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [maskVisible, setMaskVisible] = useState<boolean>(true);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [localGrowMaskBy, setLocalGrowMaskBy] = useState<number>(externalGrowMaskBy);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showRemovalGuide, setShowRemovalGuide] = useState<boolean>(true);
  const localGrowMaskByRef = useRef(localGrowMaskBy);
  useEffect(() => {
    localGrowMaskByRef.current = localGrowMaskBy;
  }, [localGrowMaskBy]);

  const lastLoadedImageRef = useRef<string | null>(null);
  const onMaskReadyRef = useRef(onMaskReady);
  useEffect(() => {
    onMaskReadyRef.current = onMaskReady;
  }, [onMaskReady]);

  // Synchronized prompt state
  const [localPrompt, setLocalPrompt] = useState<string>(externalPrompt);

  useEffect(() => {
    setLocalPrompt(externalPrompt);
  }, [externalPrompt]);

  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalPrompt(val);
    if (externalSetPrompt) externalSetPrompt(val);
    if (promptError) setPromptError(null);
  };

  // History stack for Undo / Redo
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Dynamic container sizing to perfectly preserve aspect ratio without letterbox displacement
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };
    updateSize();
    const ro = new ResizeObserver(() => updateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const canvasDisplaySize = React.useMemo(() => {
    if (containerSize.width <= 0 || containerSize.height <= 0) {
      return { width: '100%', height: '100%' };
    }
    const pad = 32;
    const availW = Math.max(100, containerSize.width - pad);
    const availH = Math.max(100, containerSize.height - pad);
    const scale = Math.min(availW / imageDimensions.width, availH / imageDimensions.height, 1);
    return {
      width: `${Math.max(100, Math.round(imageDimensions.width * scale))}px`,
      height: `${Math.max(100, Math.round(imageDimensions.height * scale))}px`,
    };
  }, [containerSize, imageDimensions]);

  // Export mask layer as dual-channel PNG data URL for ComfyUI / Inpaint pipeline
  const exportMaskData = useCallback((w?: number, h?: number, growBy?: number) => {
    const baseCanvas = baseCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!baseCanvas || !maskCanvas || !onMaskReadyRef.current) return;

    const width = w ?? maskCanvas.width;
    const height = h ?? maskCanvas.height;
    if (width <= 0 || height <= 0) return;

    const baseDataUrl = baseCanvas.toDataURL('image/png');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return;

    // Fill background solid black
    tCtx.fillStyle = 'black';
    tCtx.fillRect(0, 0, width, height);

    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    const maskImgData = maskCtx.getImageData(0, 0, width, height);
    const maskData = maskImgData.data;

    const targetImgData = tCtx.getImageData(0, 0, width, height);
    const targetData = targetImgData.data;

    for (let i = 0; i < maskData.length; i += 4) {
      if (maskData[i + 3] > 10) {
        // Masked area: White RGB, Alpha 255 (solid white for inpaint area)
        targetData[i] = 255;
        targetData[i + 1] = 255;
        targetData[i + 2] = 255;
        targetData[i + 3] = 255;
      } else {
        // Unmasked area: Black RGB, Alpha 255 (solid black for keep area)
        targetData[i] = 0;
        targetData[i + 1] = 0;
        targetData[i + 2] = 0;
        targetData[i + 3] = 255;
      }
    }
    tCtx.putImageData(targetImgData, 0, 0);
    const maskDataUrl = tempCanvas.toDataURL('image/png');

    onMaskReadyRef.current(baseDataUrl, maskDataUrl, width, height, growBy ?? localGrowMaskByRef.current);
  }, []);

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

  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      const emptyState = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      setHistory([emptyState]);
      setHistoryIndex(0);
      exportMaskData();
    }
  }, [exportMaskData]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const maskCanvas = maskCanvasRef.current;
      const ctx = maskCanvas?.getContext('2d');
      if (ctx && history[newIndex]) {
        ctx.putImageData(history[newIndex], 0, 0);
        setHistoryIndex(newIndex);
        exportMaskData();
      }
    } else if (historyIndex === 0) {
      clearMask();
    }
  }, [historyIndex, history, exportMaskData, clearMask]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const maskCanvas = maskCanvasRef.current;
      const ctx = maskCanvas?.getContext('2d');
      if (ctx && history[newIndex]) {
        ctx.putImageData(history[newIndex], 0, 0);
        setHistoryIndex(newIndex);
        exportMaskData();
      }
    }
  }, [historyIndex, history, exportMaskData]);

  const invertMask = useCallback(() => {
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
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    saveHistoryState();
    exportMaskData();
  }, [saveHistoryState, exportMaskData]);

  // Expand drawn mask boundary outwards (dilation) to ensure edges/frames are covered
  const growMask = useCallback((pixels: number = 6) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    const w = maskCanvas.width;
    const h = maskCanvas.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return;
    tCtx.drawImage(maskCanvas, 0, 0);

    ctx.globalCompositeOperation = 'source-over';
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const angle = (i * 2 * Math.PI) / steps;
      const dx = Math.round(Math.cos(angle) * pixels);
      const dy = Math.round(Math.sin(angle) * pixels);
      ctx.drawImage(tempCanvas, dx, dy);
    }
    for (let i = 0; i < steps; i++) {
      const angle = (i * 2 * Math.PI) / steps;
      const dx = Math.round(Math.cos(angle) * (pixels / 2));
      const dy = Math.round(Math.sin(angle) * (pixels / 2));
      ctx.drawImage(tempCanvas, dx, dy);
    }
    saveHistoryState();
    exportMaskData();
  }, [saveHistoryState, exportMaskData]);

  // Shrink drawn mask boundary inwards (erosion)
  const shrinkMask = useCallback((pixels: number = 6) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    const w = maskCanvas.width;
    const h = maskCanvas.height;

    const invCanvas = document.createElement('canvas');
    invCanvas.width = w;
    invCanvas.height = h;
    const invCtx = invCanvas.getContext('2d');
    if (!invCtx) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const invData = invCtx.createImageData(w, h);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) {
        invData.data[i + 3] = 0;
      } else {
        invData.data[i] = 255;
        invData.data[i + 1] = 255;
        invData.data[i + 2] = 255;
        invData.data[i + 3] = 255;
      }
    }
    invCtx.putImageData(invData, 0, 0);

    const dilatedInv = document.createElement('canvas');
    dilatedInv.width = w;
    dilatedInv.height = h;
    const dCtx = dilatedInv.getContext('2d');
    if (!dCtx) return;
    dCtx.drawImage(invCanvas, 0, 0);

    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const angle = (i * 2 * Math.PI) / steps;
      const dx = Math.round(Math.cos(angle) * pixels);
      const dy = Math.round(Math.sin(angle) * pixels);
      dCtx.drawImage(invCanvas, dx, dy);
    }

    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(dilatedInv, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    saveHistoryState();
    exportMaskData();
  }, [saveHistoryState, exportMaskData]);

  // Load an image onto baseCanvas with guaranteed initialization
  const loadImageToCanvas = useCallback((src: string) => {
    lastLoadedImageRef.current = src;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const width = img.naturalWidth || 1024;
      const height = img.naturalHeight || 1024;
      setImageDimensions({ width, height });
      setHasBaseImage(true);

      const baseCanvas = baseCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const cursorCanvas = cursorCanvasRef.current;

      if (baseCanvas) {
        baseCanvas.width = width;
        baseCanvas.height = height;
        const baseCtx = baseCanvas.getContext('2d');
        if (baseCtx) {
          baseCtx.clearRect(0, 0, width, height);
          baseCtx.drawImage(img, 0, 0, width, height);
        }
      }

      if (maskCanvas) {
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          maskCtx.clearRect(0, 0, width, height);
          const emptyState = maskCtx.getImageData(0, 0, width, height);
          setHistory([emptyState]);
          setHistoryIndex(0);
        }
      }

      if (cursorCanvas) {
        cursorCanvas.width = width;
        cursorCanvas.height = height;
        const cursorCtx = cursorCanvas.getContext('2d');
        if (cursorCtx) {
          cursorCtx.clearRect(0, 0, width, height);
        }
      }

      exportMaskData(width, height);
    };

    img.onerror = () => {
      // Fallback without crossOrigin if CORS header is omitted
      if (img.crossOrigin) {
        const fallback = new Image();
        fallback.onload = () => {
          const width = fallback.naturalWidth || 1024;
          const height = fallback.naturalHeight || 1024;
          setImageDimensions({ width, height });
          setHasBaseImage(true);

          const baseCanvas = baseCanvasRef.current;
          const maskCanvas = maskCanvasRef.current;
          const cursorCanvas = cursorCanvasRef.current;

          if (baseCanvas) {
            baseCanvas.width = width;
            baseCanvas.height = height;
            const baseCtx = baseCanvas.getContext('2d');
            if (baseCtx) {
              baseCtx.clearRect(0, 0, width, height);
              baseCtx.drawImage(fallback, 0, 0, width, height);
            }
          }

          if (maskCanvas) {
            maskCanvas.width = width;
            maskCanvas.height = height;
            const maskCtx = maskCanvas.getContext('2d');
            if (maskCtx) {
              maskCtx.clearRect(0, 0, width, height);
              const emptyState = maskCtx.getImageData(0, 0, width, height);
              setHistory([emptyState]);
              setHistoryIndex(0);
            }
          }

          if (cursorCanvas) {
            cursorCanvas.width = width;
            cursorCanvas.height = height;
            const cursorCtx = cursorCanvas.getContext('2d');
            if (cursorCtx) cursorCtx.clearRect(0, 0, width, height);
          }

          exportMaskData(width, height);
        };
        fallback.src = src;
      }
    };

    img.src = src;
  }, [exportMaskData]);

  // Create an empty blank canvas (1024x1024) to paint masks from scratch
  const handleCreateBlankCanvas = useCallback(() => {
    const width = 1024;
    const height = 1024;
    setImageDimensions({ width, height });
    setHasBaseImage(true);
    lastLoadedImageRef.current = 'blank-canvas';

    const baseCanvas = baseCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;

    if (baseCanvas) {
      baseCanvas.width = width;
      baseCanvas.height = height;
      const baseCtx = baseCanvas.getContext('2d');
      if (baseCtx) {
        baseCtx.fillStyle = '#1e293b';
        baseCtx.fillRect(0, 0, width, height);
      }
    }

    if (maskCanvas) {
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        maskCtx.clearRect(0, 0, width, height);
        const emptyState = maskCtx.getImageData(0, 0, width, height);
        setHistory([emptyState]);
        setHistoryIndex(0);
      }
    }

    if (cursorCanvas) {
      cursorCanvas.width = width;
      cursorCanvas.height = height;
      const cursorCtx = cursorCanvas.getContext('2d');
      if (cursorCtx) cursorCtx.clearRect(0, 0, width, height);
    }

    exportMaskData(width, height);
  }, [exportMaskData]);

  useEffect(() => {
    if (initialImage && initialImage !== lastLoadedImageRef.current) {
      loadImageToCanvas(initialImage);
    }
  }, [initialImage, loadImageToCanvas]);

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
    e.target.value = '';
  };

  const handleMaskUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !hasBaseImage) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) return;
      const maskImg = new Image();
      maskImg.crossOrigin = 'anonymous';
      maskImg.onload = () => {
        const maskCanvas = maskCanvasRef.current;
        if (!maskCanvas) return;
        const ctx = maskCanvas.getContext('2d');
        if (!ctx) return;

        const temp = document.createElement('canvas');
        temp.width = maskCanvas.width;
        temp.height = maskCanvas.height;
        const tempCtx = temp.getContext('2d');
        if (!tempCtx) return;
        tempCtx.drawImage(maskImg, 0, 0, maskCanvas.width, maskCanvas.height);
        const imgData = tempCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const data = imgData.data;

        ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        const targetImgData = ctx.createImageData(maskCanvas.width, maskCanvas.height);
        const targetData = targetImgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          const isMasked = a > 20 && (r > 80 || g > 80 || b > 80 || (r === 0 && g === 0 && b === 0 && a > 128));
          if (isMasked) {
            targetData[i] = 239;
            targetData[i + 1] = 68;
            targetData[i + 2] = 68;
            targetData[i + 3] = 200;
          }
        }
        ctx.putImageData(targetImgData, 0, 0);
        saveHistoryState();
        exportMaskData();
      };
      maskImg.src = event.target.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Convert client pointer coordinates strictly to mask canvas coordinates
  const getCanvasCoords = (e: React.PointerEvent<HTMLDivElement>) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return { x: 0, y: 0 };
    const rect = maskCanvas.getBoundingClientRect();
    const scaleX = maskCanvas.width / (rect.width || 1);
    const scaleY = maskCanvas.height / (rect.height || 1);
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;
    return {
      x: Math.max(0, Math.min(maskCanvas.width, rawX)),
      y: Math.max(0, Math.min(maskCanvas.height, rawY)),
    };
  };

  const drawCursor = useCallback((x: number, y: number) => {
    lastCoordsRef.current = { x, y };
    const cursorCanvas = cursorCanvasRef.current;
    if (!cursorCanvas) return;
    const ctx = cursorCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = tool === 'brush' ? '#f43f5e' : '#38bdf8';
    const scale = cursorCanvas.width / (cursorCanvas.clientWidth || cursorCanvas.width);
    ctx.lineWidth = Math.max(2, 2 * scale);
    ctx.stroke();
  }, [brushSize, tool]);

  // Re-render cursor when brushSize or tool changes
  useEffect(() => {
    if (lastCoordsRef.current) {
      drawCursor(lastCoordsRef.current.x, lastCoordsRef.current.y);
    }
  }, [brushSize, tool, drawCursor]);

  const clearCursor = () => {
    lastCoordsRef.current = null;
    const cursorCanvas = cursorCanvasRef.current;
    if (!cursorCanvas) return;
    const ctx = cursorCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  };

  // Pointer event handlers attached directly to the active canvas wrapper
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasBaseImage || e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    isDrawingRef.current = true;
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    lastPointRef.current = { x, y };

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(239, 68, 68, 1)';
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      ctx.fill();
    }
    drawCursor(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasBaseImage) return;
    const { x, y } = getCanvasCoords(e);
    drawCursor(x, y);

    if (isDrawingRef.current && lastPointRef.current) {
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;
      const ctx = maskCanvas.getContext('2d');
      if (!ctx) return;

      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (tool === 'brush') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(239, 68, 68, 1)';
      } else {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
      }

      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      lastPointRef.current = { x, y };
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      isDrawingRef.current = false;
      setIsDrawing(false);
      lastPointRef.current = null;
      saveHistoryState();
      exportMaskData();
    }
  };

  const handlePointerLeave = () => {
    clearCursor();
  };

  // Handle trigger inpaint with validation
  const handleTriggerInpaint = () => {
    const promptToRun = localPrompt.trim();
    if (!promptToRun) {
      setPromptError('Please enter a prompt describing what to paint into the masked area.');
      promptInputRef.current?.focus();
      return;
    }
    setPromptError(null);
    if (onInpaint) {
      onInpaint(promptToRun);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'b' || e.key === 'B') {
        setTool('brush');
      } else if (e.key === 'e' || e.key === 'E') {
        setTool('eraser');
      } else if (e.key === '[') {
        setBrushSize((s) => Math.max(5, s - 10));
      } else if (e.key === ']') {
        setBrushSize((s) => Math.min(200, s + 10));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div className="flex flex-col h-full bg-surface-panel border border-surface-border rounded-xl overflow-hidden shadow-2xl font-mono text-xs select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-surface-subpanel/90 border-b border-surface-border gap-2 z-20">
        {/* Left Section: Back button + Drawing Tools */}
        <div className="flex items-center space-x-1.5 flex-wrap">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-surface-card hover:bg-surface-hover text-on-surface border border-surface-border transition shadow-sm active:scale-95"
              title="Return to Studio Timeline"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-primary" />
              <span>Back to Studio</span>
            </button>
          )}

          {onBack && <div className="h-4 w-px bg-surface-border mx-1" />}

          {/* Tool Selectors */}
          <button
            onClick={() => setTool('brush')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition active:scale-95 ${
              tool === 'brush'
                ? 'bg-primary text-on-primary shadow-sm font-semibold'
                : 'bg-surface-panel text-slate-300 hover:text-white border border-surface-border'
            }`}
            title="Paint mask (Hotkey: B)"
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Brush</span>
          </button>

          <button
            onClick={() => setTool('eraser')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition active:scale-95 ${
              tool === 'eraser'
                ? 'bg-primary text-on-primary shadow-sm font-semibold'
                : 'bg-surface-panel text-slate-300 hover:text-white border border-surface-border'
            }`}
            title="Erase mask (Hotkey: E)"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>

          <div className="h-4 w-px bg-surface-border mx-1" />

          {/* Brush size slider */}
          <div className="flex items-center space-x-2 bg-surface-base px-2.5 py-1 rounded-lg border border-surface-border">
            <span className="text-[10px] text-slate-400">Size:</span>
            <input
              type="range"
              min="5"
              max="200"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20 cursor-pointer h-1.5 bg-surface-subpanel rounded-lg accent-primary"
              title="Adjust brush size (Hotkeys: [ and ])"
            />
            <span className="text-[11px] text-primary w-8 text-right font-semibold">{brushSize}px</span>
          </div>

          {/* Mask visibility toggle */}
          <button
            onClick={() => setMaskVisible(!maskVisible)}
            className="p-1.5 rounded-lg bg-surface-panel text-slate-300 hover:text-white border border-surface-border transition active:scale-95"
            title={maskVisible ? 'Hide Mask Overlay' : 'Show Mask Overlay'}
          >
            {maskVisible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>

        {/* Right Section: Action Controls & Upload */}
        <div className="flex items-center space-x-1.5 flex-wrap">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg bg-surface-panel text-slate-300 hover:text-white border border-surface-border disabled:opacity-30 disabled:cursor-not-allowed transition active:scale-95"
            title="Undo Mask Stroke (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg bg-surface-panel text-slate-300 hover:text-white border border-surface-border disabled:opacity-30 disabled:cursor-not-allowed transition active:scale-95"
            title="Redo Mask Stroke (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-surface-border mx-1" />

          <button
            onClick={invertMask}
            disabled={!hasBaseImage}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] bg-surface-panel text-slate-300 hover:text-white border border-surface-border disabled:opacity-30 transition active:scale-95"
            title="Invert Inpaint Mask"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>Invert</span>
          </button>

          <button
            onClick={() => growMask(6)}
            disabled={!hasBaseImage}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] bg-surface-panel text-slate-300 hover:text-white border border-surface-border disabled:opacity-30 transition active:scale-95"
            title="Grow Mask (+6px): Expands mask boundary to guarantee object edges and frames are covered"
          >
            <Maximize2 className="w-3.5 h-3.5 text-primary" />
            <span>Grow +6px</span>
          </button>

          <button
            onClick={() => shrinkMask(6)}
            disabled={!hasBaseImage}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] bg-surface-panel text-slate-300 hover:text-white border border-surface-border disabled:opacity-30 transition active:scale-95"
            title="Shrink Mask (-6px): Contracts mask boundary inward"
          >
            <Minimize2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Shrink -6px</span>
          </button>

          <button
            onClick={clearMask}
            disabled={!hasBaseImage}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] bg-surface-panel text-rose-400 hover:bg-rose-950/30 border border-surface-border disabled:opacity-30 transition active:scale-95"
            title="Clear Mask"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <div className="h-4 w-px bg-surface-border mx-1" />

          {/* Upload Image Button */}
          <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-surface-card hover:bg-surface-hover text-on-surface border border-surface-border cursor-pointer transition shadow-sm active:scale-95" title="Upload or replace base image">
            <Upload className="w-3.5 h-3.5 text-primary" />
            <span>Upload Image</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>

          {/* Upload Mask Button */}
          <label className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-surface-border transition shadow-sm active:scale-95 ${
            !hasBaseImage
              ? 'opacity-30 cursor-not-allowed bg-surface-panel text-slate-500'
              : 'bg-surface-card hover:bg-surface-hover text-on-surface cursor-pointer'
          }`} title={hasBaseImage ? "Upload an inpaint mask file" : "Upload an image first to add a mask"}>
            <FileUp className="w-3.5 h-3.5 text-tertiary" />
            <span>Upload Mask</span>
            <input type="file" accept="image/*" disabled={!hasBaseImage} onChange={handleMaskUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div 
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center p-4 bg-[#07080a] bg-[radial-gradient(#141822_1px,transparent_1px)] [background-size:20px_20px] overflow-hidden min-h-[360px]"
      >
        {/* Dropzone prompt displayed when no base image is loaded */}
        {!hasBaseImage && (
          <div className="flex flex-col items-center justify-center border border-dashed border-surface-borderLight rounded-2xl p-10 max-w-md text-center bg-surface-panel/80 backdrop-blur-sm shadow-xl z-10 animate-fade-in">
            {onBack && (
              <button
                onClick={onBack}
                className="mb-4 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-card hover:bg-surface-hover text-slate-300 border border-surface-border transition"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-primary" />
                <span>Back to Studio</span>
              </button>
            )}
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-3 shadow-lg">
              <Paintbrush className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-semibold tracking-wide text-slate-100 mb-1">Inpaint Canvas Studio</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed font-sans max-w-sm">
              Paint a mask over the area you want to replace or enhance. Select a base image to start or create a blank canvas to begin painting immediately.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <label className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary text-on-primary hover:bg-primary-fixed-dim cursor-pointer shadow-md transition flex items-center justify-center space-x-2 active:scale-95">
                <Upload className="w-4 h-4" />
                <span>Select Base Image</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
              <button
                onClick={handleCreateBlankCanvas}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-surface-card hover:bg-surface-hover text-on-surface border border-surface-border cursor-pointer shadow-sm transition flex items-center justify-center space-x-2 active:scale-95"
                title="Create a new 1024x1024 blank canvas"
              >
                <Paintbrush className="w-4 h-4 text-tertiary" />
                <span>Blank Canvas (1024×1024)</span>
              </button>
            </div>
          </div>
        )}

        {/* Canvases permanently mounted so refs are always available */}
        <div 
          ref={canvasWrapperRef}
          className={`${hasBaseImage ? 'relative shadow-2xl rounded-xl overflow-hidden border border-surface-border bg-black select-none touch-none cursor-crosshair' : 'hidden'}`}
          style={{ 
            width: canvasDisplaySize.width,
            height: canvasDisplaySize.height,
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        >
          {/* Layer 1: Base Image Canvas */}
          <canvas ref={baseCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

          {/* Layer 2: Inpaint Mask Layer */}
          <canvas
            ref={maskCanvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-150 ${
              maskVisible ? 'opacity-80' : 'opacity-0'
            }`}
          />

          {/* Layer 3: Interactive Cursor Tracker */}
          <canvas
            ref={cursorCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        </div>
      </div>

      {/* Integrated In-Canvas Prompt Bar */}
      {hasBaseImage && (
        <div className="p-3 bg-surface-subpanel/95 border-t border-surface-border flex flex-col gap-2.5 z-20 shadow-lg">
          {/* Object Removal Guidance Banner */}
          {showRemovalGuide && (
            <div className="flex items-start justify-between p-2.5 rounded-xl bg-surface-base border border-primary/30 text-[11px] text-slate-300">
              <div className="flex items-start space-x-2">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex flex-col space-y-0.5">
                  <span className="font-semibold text-slate-100">
                    Object Removal Rule: Describe What REPLACES the Masked Area
                  </span>
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                    Tightly mask the unwanted object. <strong>Do NOT prompt &quot;remove glasses&quot; or &quot;remove hat&quot;</strong> — diffusion cross-attention will regenerate it! Instead, describe the replacement (e.g. <em>&quot;natural clear eyes, bare skin&quot;</em>) and place unwanted items in the Avoid/Negative box. High denoise (0.85) synthesizes clean replacement latents while <code>VAEEncodeForInpaint</code> preserves 100% of all unmasked areas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRemovalGuide(false)}
                className="text-slate-500 hover:text-slate-300 p-0.5 ml-2 font-bold"
                title="Dismiss guide"
              >
                &times;
              </button>
            </div>
          )}

          {/* Quick Object Removal Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider pr-1">
              Object Removal Presets:
            </span>
            {Object.entries(OBJECT_REMOVAL_PRESETS).map(([key, preset]) => {
              const icon = key === 'glasses' ? '👓' : key === 'hat' ? '🧢' : key === 'facial_hair' ? '🧔' : key === 'jewelry' ? '💎' : '🌲';
              const isSelected = activePreset === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActivePreset(key);
                    setLocalPrompt(preset.replacementPrompt);
                    if (externalSetPrompt) externalSetPrompt(preset.replacementPrompt);
                    if (setNegativePrompt) setNegativePrompt(preset.negativePrompt);
                    if (setDenoise) setDenoise(0.85);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition active:scale-95 flex items-center space-x-1 ${
                    isSelected
                      ? 'bg-primary text-on-primary font-semibold shadow-sm'
                      : 'bg-surface-base hover:bg-surface-hover text-slate-300 border border-surface-border'
                  }`}
                  title={preset.guidance}
                >
                  <span>{icon}</span>
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Preset Masking Guidance Tip */}
          {activePreset && OBJECT_REMOVAL_PRESETS[activePreset] && (
            <div className="text-[10px] text-primary/90 bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1 font-sans">
              <strong>Tip for {OBJECT_REMOVAL_PRESETS[activePreset].label}:</strong> {OBJECT_REMOVAL_PRESETS[activePreset].guidance}
            </div>
          )}

          {/* Prompt Error Banner if user tries to run empty prompt */}
          {promptError && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
              <span>{promptError}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Prompt Input */}
            <div className="relative flex-1">
              <input
                ref={promptInputRef}
                type="text"
                value={localPrompt}
                onChange={handlePromptChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGenerating) {
                    e.preventDefault();
                    handleTriggerInpaint();
                  }
                }}
                placeholder="Describe what to paint into the masked area... (e.g. natural clear eyes, smooth bare skin)"
                className="w-full bg-surface-base px-3.5 py-2.5 rounded-xl border border-surface-border focus:border-primary focus:ring-1 focus:ring-primary text-xs text-on-surface placeholder:text-slate-500 transition outline-none font-sans"
              />
            </div>

            {/* Denoise Strength Slider */}
            {setDenoise && (
              <div className="flex items-center space-x-2 bg-surface-base px-3 py-2 rounded-xl border border-surface-border" title="Inpaint Denoise Strength: 0.85 - 0.95 is recommended for localized object replacement. Preserves 100% of unmasked areas.">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-400">Denoise:</span>
                <input
                  type="range"
                  min="0.10"
                  max="1.0"
                  step="0.05"
                  value={denoise}
                  onChange={(e) => setDenoise(Number(e.target.value))}
                  className="w-16 cursor-pointer h-1.5 bg-surface-subpanel rounded-lg accent-primary"
                />
                <span className="text-[11px] text-primary w-8 text-right font-semibold">
                  {Math.round(denoise * 100)}%
                </span>
              </div>
            )}

            {/* Feather / Grow Mask Slider */}
            <div className="flex items-center space-x-2 bg-surface-base px-3 py-2 rounded-xl border border-surface-border" title="grow_mask_by: Expands mask boundary in VAEEncodeForInpaint to blend edges naturally into surrounding skin or background">
              <span className="text-[10px] text-slate-400">Feather:</span>
              <input
                type="range"
                min="0"
                max="24"
                step="2"
                value={localGrowMaskBy}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLocalGrowMaskBy(val);
                  if (externalSetGrowMaskBy) externalSetGrowMaskBy(val);
                  exportMaskData(undefined, undefined, val);
                }}
                className="w-14 cursor-pointer h-1.5 bg-surface-subpanel rounded-lg accent-primary"
              />
              <span className="text-[11px] text-primary w-6 text-right font-semibold">
                {localGrowMaskBy}px
              </span>
            </div>

            {/* Inpaint Execution Button */}
            <button
              onClick={handleTriggerInpaint}
              disabled={!hasBaseImage || isGenerating}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-on-primary hover:bg-primary-fixed-dim transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 whitespace-nowrap"
              title="Run Inpainting with current mask and replacement prompt (Enter)"
            >
              <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Inpainting...' : 'Run Inpaint'}</span>
            </button>
          </div>

          {/* Negative Prompt Row */}
          {setNegativePrompt && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider pl-1 w-20 flex-shrink-0">
                Avoid / Remove:
              </span>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="Negative prompt: unwanted items to suppress (e.g. glasses, sunglasses, spectacles, frames, eyewear)..."
                  className="w-full bg-surface-base px-3 py-1.5 rounded-lg border border-surface-border focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/60 text-xs text-on-surface placeholder:text-slate-500 transition outline-none font-sans"
                />
              </div>
            </div>
          )}

          {/* Footer Info & Stats */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1">
            <div className="flex items-center space-x-4">
              <span>Canvas: <strong className="text-slate-200">{imageDimensions.width} × {imageDimensions.height} px</strong></span>
              <span>Tool: <strong className="text-primary capitalize">{tool} ({brushSize}px)</strong></span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-slate-500">Shortcuts: [ / ] size &bull; B brush &bull; E eraser &bull; Ctrl+Z undo</span>
              <div className="flex items-center space-x-1.5 text-emerald-400 font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Mask Ready</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
