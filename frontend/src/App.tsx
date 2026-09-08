import React, { useState, useEffect } from 'react';
import { Header, WorkspaceTab } from './components/common/Header';
import { InpaintCanvas } from './components/canvas/InpaintCanvas';
import { GalleryView } from './components/gallery/GalleryView';
import { DagPipelineView } from './components/dag/DagPipelineView';
import { StylePicker } from './components/prompt/StylePicker';
import { MetadataModal } from './components/common/MetadataModal';
import { SettingsModal } from './components/common/SettingsModal';
import { api } from './services/api';
import { ProgressWebSocket } from './services/websocket';
import { 
  StylePreset, ResolutionPreset, ModelInfo, Board, 
  ImageAsset, TaskProgress 
} from './types';
import { 
  Play, Square, Sparkles, Wand2, X, Plus, RotateCcw, 
  Maximize2, Paintbrush, Copy, Check, Download, Info, 
  ChevronDown, Layers, Loader2, Sliders 
} from 'lucide-react';

const SAMPLERS = [
  'dpmpp_2m', 'dpmpp_2m_sde', 'euler', 'euler_ancestral', 
  'uni_pc', 'heun', 'dpm_2', 'ddim'
];

const SCHEDULERS = [
  'karras', 'exponential', 'sgm_uniform', 'normal', 'simple'
];

const ASPECT_RATIOS = [
  { label: '1 : 1', sub: '1024×1024', w: 1024, h: 1024 },
  { label: '16 : 9', sub: '1344×768', w: 1344, h: 768 },
  { label: '9 : 16', sub: '768×1344', w: 768, h: 1344 },
  { label: '21 : 9', sub: '1536×640', w: 1536, h: 640 },
];

export const App: React.FC = () => {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('studio');

  // Metadata & Engine Data
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [styles, setStyles] = useState<StylePreset[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionPreset[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageAsset | null>(null);
  const [comfyOnline, setComfyOnline] = useState<boolean>(false);

  // Generation Parameters
  const [prompt, setPrompt] = useState<string>(
    'Vichea, architectural interior of brutalist sanctuary, (ornate brass geometric relief partition:1.25), linen king platform bed, dramatic natural rim-lighting, morning volumetric rays, muted color grading, <lora:offset_light_xl:0.75>, high visual coherence'
  );
  const [negativePrompt, setNegativePrompt] = useState<string>(
    'low quality, artifacts, blurry, bad anatomy, blown out contrast, chromatic aberration, cartoon, oversaturated'
  );
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['Fooocus V2 Architecture', 'SDXL Film Grain v1']);
  const [autoExpand, setAutoExpand] = useState<boolean>(true);
  const [expansionLevel, setExpansionLevel] = useState<string>('medium');

  const [selectedModel, setSelectedModel] = useState<string>('sd_xl_base_1.0.safetensors');
  const [width, setWidth] = useState<number>(1024);
  const [height, setHeight] = useState<number>(1024);
  const [steps, setSteps] = useState<number>(30);
  const [cfgScale, setCfgScale] = useState<number>(7.0);
  const [sampler, setSampler] = useState<string>('dpmpp_2m');
  const [scheduler, setScheduler] = useState<string>('karras');
  const [seed, setSeed] = useState<number>(-1);
  const [denoise, setDenoise] = useState<number>(0.85);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);

  // Canvas / Inpaint state
  const [canvasBaseImage, setCanvasBaseImage] = useState<string | null>(null);
  const [inpaintData, setInpaintData] = useState<{
    baseDataUrl: string;
    maskDataUrl: string;
    width: number;
    height: number;
  } | null>(null);

  // Execution & WebSocket Progress
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [currentProgress, setCurrentProgress] = useState<TaskProgress | null>(null);
  const [activeWs, setActiveWs] = useState<ProgressWebSocket | null>(null);
  const [jobId, setJobId] = useState<string>('84920-A');
  const [timingSeconds, setTimingSeconds] = useState<number | null>(7.42);
  const [itPerSec, setItPerSec] = useState<number | null>(2.41);

  // Modals & UI States
  const [showStylePicker, setShowStylePicker] = useState<boolean>(false);
  const [showMetadataModal, setShowMetadataModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showFullScreen, setShowFullScreen] = useState<boolean>(false);
  const [copiedMetadata, setCopiedMetadata] = useState<boolean>(false);

  // Initial Data Fetching
  useEffect(() => {
    const initData = async () => {
      try {
        const [mList, sList, rList, bList, imgList, status] = await Promise.all([
          api.getModels(),
          api.getStyles(),
          api.getResolutions(),
          api.getBoards(),
          api.getImages(),
          api.getSystemStatus(),
        ]);

        setModels(mList);
        if (mList.length > 0) setSelectedModel(mList[0].name);

        setStyles(sList);
        setResolutions(rList);
        setBoards(bList);
        setImages(imgList);
        if (imgList.length > 0) {
          setSelectedImage(imgList[0]);
        }
        setComfyOnline(status.comfyui_online);
      } catch (err) {
        console.error('Failed to load suite data', err);
      }
    };
    initData();
  }, []);

  const refreshGallery = async () => {
    try {
      const [imgList, bList] = await Promise.all([api.getImages(), api.getBoards()]);
      setImages(imgList);
      setBoards(bList);
      if (imgList.length > 0 && !selectedImage) {
        setSelectedImage(imgList[0]);
      }
    } catch (err) {
      console.error('Failed to refresh gallery', err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setCurrentProgress(null);
    const newJobId = Math.floor(10000 + Math.random() * 90000).toString() + '-A';
    setJobId(newJobId);
    const startTime = Date.now();

    try {
      let task_id: string;

      if (activeTab === 'canvas' && inpaintData) {
        const res = await api.inpaint({
          prompt,
          negative_prompt: negativePrompt,
          styles: selectedStyles,
          auto_expand: autoExpand,
          base_image: inpaintData.baseDataUrl,
          mask_image: inpaintData.maskDataUrl,
          denoise,
          width: inpaintData.width,
          height: inpaintData.height,
          model_name: selectedModel,
          sampler,
          scheduler,
          steps,
          cfg_scale: cfgScale,
          seed,
          board_id: selectedBoardId,
        });
        task_id = res.task_id;
      } else {
        const res = await api.generate({
          prompt,
          negative_prompt: negativePrompt,
          styles: selectedStyles,
          auto_expand: autoExpand,
          expansion_level: expansionLevel,
          width,
          height,
          model_name: selectedModel,
          sampler,
          scheduler,
          steps,
          cfg_scale: cfgScale,
          seed,
          board_id: selectedBoardId,
        });
        task_id = res.task_id;
      }

      // Connect WebSocket progress listener
      const ws = new ProgressWebSocket(
        task_id,
        (progress) => {
          setCurrentProgress(progress);
          const elapsed = (Date.now() - startTime) / 1000;
          setTimingSeconds(Number(elapsed.toFixed(2)));
          if (elapsed > 0 && (progress.current_step || 0) > 0) {
            setItPerSec(Number(((progress.current_step || 1) / elapsed).toFixed(2)));
          }
        },
        async () => {
          setIsGenerating(false);
          const elapsed = (Date.now() - startTime) / 1000;
          setTimingSeconds(Number(elapsed.toFixed(2)));
          const updatedImages = await api.getImages();
          setImages(updatedImages);
          if (updatedImages.length > 0) {
            setSelectedImage(updatedImages[0]);
          }
        },
        (err) => {
          console.error('WebSocket error:', err);
          setIsGenerating(false);
        }
      );
      setActiveWs(ws);
    } catch (err) {
      console.error('Generation request failed:', err);
      setIsGenerating(false);
    }
  };

  const handleInterrupt = async () => {
    try {
      await api.interrupt();
    } catch (e) {
      console.error('Failed to interrupt:', e);
    } finally {
      if (activeWs) activeWs.close();
      setIsGenerating(false);
    }
  };

  const handleSendToCanvas = (imageUrl: string) => {
    setCanvasBaseImage(imageUrl);
    setActiveTab('canvas');
  };

  const handleReuseSettings = (image: ImageAsset) => {
    setPrompt(image.prompt);
    if (image.negative_prompt) setNegativePrompt(image.negative_prompt);
    if (image.styles_applied?.length) setSelectedStyles(image.styles_applied);
    setWidth(image.width);
    setHeight(image.height);
    setSteps(image.steps);
    setCfgScale(image.cfg_scale);
    setSeed(image.seed);
    setSampler(image.sampler);
    setScheduler(image.scheduler);
    setSelectedModel(image.model_name);
    setActiveTab('studio');
  };

  const handleDeleteImage = async (id: number) => {
    await api.deleteImage(id);
    await refreshGallery();
  };

  const handleCreateBoard = async (name: string, description?: string) => {
    await api.createBoard(name, description);
    await refreshGallery();
  };

  const handleAssignBoard = async (imageId: number, boardId: number | null) => {
    await api.assignImageBoard(imageId, boardId);
    await refreshGallery();
  };

  const handleExportPng = () => {
    if (!selectedImage) return;
    const a = document.createElement('a');
    a.href = selectedImage.url;
    a.download = selectedImage.filename || 'antigravity_output.png';
    a.click();
  };

  const handleCopyMetadata = (text?: string) => {
    if (!selectedImage) return;
    const data = text || JSON.stringify({
      prompt: selectedImage.prompt,
      negative_prompt: selectedImage.negative_prompt,
      model: selectedImage.model_name,
      dimensions: `${selectedImage.width}x${selectedImage.height}`,
      steps: selectedImage.steps,
      cfg_scale: selectedImage.cfg_scale,
      sampler: selectedImage.sampler,
      scheduler: selectedImage.scheduler,
      seed: selectedImage.seed
    }, null, 2);
    navigator.clipboard.writeText(data);
    setCopiedMetadata(true);
    setTimeout(() => setCopiedMetadata(false), 2000);
  };

  const randomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 2147483647));
  };

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to queue inference
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!isGenerating && prompt.trim()) {
        handleGenerate();
      }
    }
  };

  // Approximate token calculation
  const tokenCount = Math.min(75, Math.ceil(prompt.trim().split(/\s+/).filter(Boolean).length * 1.3));
  const heuristicsCount = negativePrompt ? negativePrompt.split(',').filter(Boolean).length : 0;

  return (
    <div className="h-screen flex flex-col bg-[#090b0e] text-[#cfd4dc] font-sans antialiased flex flex-col select-none overflow-hidden text-xs">
      {/* Global Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        comfyOnline={comfyOnline}
        isGenerating={isGenerating}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Gallery Tab */}
        {activeTab === 'gallery' && (
          <div className="flex-1 overflow-hidden">
            <GalleryView
              images={images}
              boards={boards}
              selectedBoardId={selectedBoardId}
              setSelectedBoardId={setSelectedBoardId}
              onCreateBoard={handleCreateBoard}
              onSendToCanvas={handleSendToCanvas}
              onReuseSettings={handleReuseSettings}
              onDeleteImage={handleDeleteImage}
              onAssignBoard={handleAssignBoard}
            />
          </div>
        )}

        {/* DAG Pipeline Tab */}
        {activeTab === 'dag' && (
          <div className="flex-1 overflow-hidden">
            <DagPipelineView
              selectedModel={selectedModel}
              width={width}
              height={height}
              steps={steps}
              cfgScale={cfgScale}
              sampler={sampler}
              scheduler={scheduler}
              seed={seed}
              prompt={prompt}
              negativePrompt={negativePrompt}
              selectedStyles={selectedStyles}
              comfyOnline={comfyOnline}
              isGenerating={isGenerating}
            />
          </div>
        )}

        {/* Studio & Canvas Workstation Layout (Left Panel + Right Viewport) */}
        {(activeTab === 'studio' || activeTab === 'canvas') && (
          <>
            {/* Left Generation Panel */}
            <section className="w-[480px] lg:w-[500px] border-r border-surface-border bg-[#0b0d12] flex flex-col overflow-y-auto flex-shrink-0" data-purpose="generation-controls">
              <div className="p-5 lg:p-6 space-y-5">
                {/* Prompt Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-medium">
                      Conditioning Prompt
                    </label>
                    <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-500">
                      <span>Tokens: <span className="text-brand-400 font-semibold">{tokenCount}</span> / 75</span>
                      <button
                        onClick={() => setPrompt('')}
                        className="hover:text-slate-300 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Clean Prompt Textarea */}
                  <div className="rounded-lg border border-surface-border bg-surface-panel p-3 focus-within:border-brand-500/60 focus-within:ring-1 focus-within:ring-brand-500/30 transition-all">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Describe your scene with precision, lighting, atmosphere..."
                      className="w-full bg-transparent font-mono text-xs leading-relaxed min-h-[64px] text-slate-200 outline-none resize-none placeholder-slate-600 select-text"
                    />

                    {/* LoRA / Style Tags Bar */}
                    <div className="mt-2.5 pt-2 border-t border-surface-border flex items-center justify-between flex-wrap gap-1.5">
                      <div className="flex items-center flex-wrap gap-1.5">
                        {selectedStyles.map((style) => (
                          <span
                            key={style}
                            className="inline-flex items-center px-2 py-0.5 rounded bg-surface-subpanel text-[10px] font-mono text-slate-300 border border-surface-border/60 space-x-1"
                          >
                            <span className="truncate max-w-[140px]">{style}</span>
                            <button
                              onClick={() => setSelectedStyles((prev) => prev.filter((s) => s !== style))}
                              className="text-slate-500 hover:text-slate-300 ml-1 font-bold"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={() => setShowStylePicker(true)}
                          className="text-[10px] font-mono text-brand-400 hover:text-brand-300 px-1.5 py-0.5 rounded hover:bg-brand-500/10 transition-colors flex items-center space-x-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Style</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setAutoExpand(!autoExpand)}
                        className={`text-[10px] font-mono transition-colors flex items-center space-x-1 ${
                          autoExpand ? 'text-amber-400 font-medium' : 'text-slate-500 hover:text-slate-400'
                        }`}
                        title="Fooocus rule-based scene expansion"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Auto-Expand</span>
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Negative Conditioning Area */}
                  <details className="group rounded-md border border-surface-border/80 bg-surface-panel/50">
                    <summary className="px-3 py-2 cursor-pointer flex items-center justify-between text-[11px] font-mono text-slate-400 hover:text-slate-300 list-none select-none">
                      <span className="flex items-center space-x-2">
                        <ChevronDown className="w-3 h-3 transform -rotate-90 group-open:rotate-0 transition-transform text-slate-500" />
                        <span>Negative Prompt Filters</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {heuristicsCount} heuristics active
                      </span>
                    </summary>
                    <div className="px-3 pb-3 pt-1 border-t border-surface-border/40">
                      <textarea
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        placeholder="Negative tokens..."
                        className="w-full bg-surface-base border border-surface-border rounded-md p-2.5 text-xs font-mono text-slate-400 focus:outline-none focus:border-brand-500/50 resize-none h-14"
                      />
                    </div>
                  </details>
                </div>

                {/* Section Divider */}
                <div className="h-px bg-surface-border" />

                {/* Inference Core Parameters */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-slate-300">
                      Inference Core
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">SDXL LatentDiffusion</span>
                  </div>

                  {/* Base Model Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                      Base Model
                    </label>
                    <div className="relative">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-surface-panel border border-surface-border hover:border-surface-borderLight rounded-md px-3 py-2 text-xs font-mono text-slate-200 appearance-none focus:border-brand-500 focus:outline-none transition-colors"
                      >
                        {models.length > 0 ? (
                          models.map((m) => (
                            <option key={m.name} value={m.name}>
                              {m.name} [{m.type.toUpperCase()} • FP16 • {m.size_gb} GB]
                            </option>
                          ))
                        ) : (
                          <option value="sd_xl_base_1.0.safetensors">
                            sd_xl_base_1.0.safetensors [SDXL • FP16 • 6.46 GB]
                          </option>
                        )}
                      </select>
                      <div className="absolute right-3 top-2.5 pointer-events-none text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Resolution & Aspect Ratio: Sleek Modern Segmented Control */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <label className="text-slate-400 uppercase tracking-wide">Aspect Ratio &amp; Canvas</label>
                      <span className="text-brand-400 font-medium">
                        {width} × {height} ({width === height ? '1:1 Native' : `${width}:${height}`})
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 font-mono text-center">
                      {ASPECT_RATIOS.map((ar) => {
                        const isSelected = width === ar.w && height === ar.h;
                        return (
                          <button
                            key={ar.label}
                            onClick={() => {
                              setWidth(ar.w);
                              setHeight(ar.h);
                            }}
                            className={`p-2 rounded flex flex-col items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-brand-500/10 border border-brand-500/50 text-slate-100'
                                : 'bg-surface-panel border border-surface-border hover:border-surface-borderLight text-slate-300'
                            }`}
                          >
                            <span className="font-semibold text-xs">{ar.label}</span>
                            <span className={`text-[9px] ${isSelected ? 'text-brand-300/80' : 'text-slate-500'}`}>
                              {ar.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Steps & CFG Guidance Sliders */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400 uppercase">Steps</span>
                        <span className="text-slate-200 font-semibold">{steps}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={steps}
                        onChange={(e) => setSteps(Number(e.target.value))}
                        className="w-full h-1 bg-surface-subpanel rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400 uppercase">CFG Scale</span>
                        <span className="text-slate-200 font-semibold">{cfgScale.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="0.5"
                        value={cfgScale}
                        onChange={(e) => setCfgScale(Number(e.target.value))}
                        className="w-full h-1 bg-surface-subpanel rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* If in Canvas mode, show Inpainting Denoise Slider */}
                  {activeTab === 'canvas' && (
                    <div className="space-y-2 pt-1 border-t border-surface-border">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-brand-400 uppercase font-semibold">Inpaint Denoising Strength</span>
                        <span className="text-slate-200 font-semibold">{denoise.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={denoise}
                        onChange={(e) => setDenoise(Number(e.target.value))}
                        className="w-full h-1 bg-surface-subpanel rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Sampler & Scheduler Curve */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-400 uppercase">Sampler</label>
                      <div className="relative">
                        <select
                          value={sampler}
                          onChange={(e) => setSampler(e.target.value)}
                          className="w-full bg-surface-panel border border-surface-border rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-200 appearance-none focus:border-brand-500 focus:outline-none"
                        >
                          {SAMPLERS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <div className="absolute right-2 top-2.5 pointer-events-none text-slate-400">
                          <ChevronDown className="w-3 h-3" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-400 uppercase">Scheduler</label>
                      <div className="relative">
                        <select
                          value={scheduler}
                          onChange={(e) => setScheduler(e.target.value)}
                          className="w-full bg-surface-panel border border-surface-border rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-200 appearance-none focus:border-brand-500 focus:outline-none"
                        >
                          {SCHEDULERS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <div className="absolute right-2 top-2.5 pointer-events-none text-slate-400">
                          <ChevronDown className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seed Precision Input */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400 uppercase">Latent Seed</span>
                      <span className="text-slate-500">{seed === -1 ? '-1 (Random)' : seed}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={seed}
                          onChange={(e) => setSeed(Number(e.target.value) || -1)}
                          className="w-full bg-surface-panel border border-surface-border rounded-md px-3 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <button
                        onClick={randomizeSeed}
                        className="px-3 py-1.5 bg-surface-panel border border-surface-border hover:bg-surface-hover rounded-md text-slate-300 font-mono text-xs flex items-center space-x-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span>Randomize</span>
                      </button>
                    </div>
                  </div>

                  {/* Target Bucket / Board */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-mono text-slate-400 uppercase">Destination Board</label>
                    <div className="relative">
                      <select
                        value={selectedBoardId || ''}
                        onChange={(e) => setSelectedBoardId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-surface-panel border border-surface-border rounded-md px-3 py-1.5 text-xs font-mono text-slate-300 appearance-none focus:border-brand-500 focus:outline-none"
                      >
                        <option value="">Unassigned (Working Memory)</option>
                        {boards.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.image_count} images)
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-2.5 pointer-events-none text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Execution Button */}
                <div className="pt-2">
                  {isGenerating ? (
                    <div className="flex items-center space-x-2">
                      <button
                        disabled
                        className="flex-1 h-10 bg-brand-600/80 text-white font-medium rounded-md flex items-center justify-center space-x-2 shadow-sm cursor-wait"
                      >
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span className="tracking-wide text-xs font-semibold uppercase">
                          Sampling Step {currentProgress?.current_step || 0}/{currentProgress?.total_steps || steps}
                        </span>
                      </button>
                      <button
                        onClick={handleInterrupt}
                        className="h-10 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-md text-xs uppercase transition shadow-sm"
                        title="Interrupt Inference"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      className="w-full h-10 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-medium rounded-md flex items-center justify-center space-x-2 shadow-sm transition-all duration-150 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span className="tracking-wide text-xs font-semibold uppercase">Queue Inference</span>
                      <span className="text-[10px] font-mono text-blue-200/80 ml-1">⌘Enter</span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Right Viewport Panel */}
            <section className="flex-1 bg-[#07080a] flex flex-col justify-between overflow-hidden" data-purpose="viewport-inspector">
              {/* Viewport Header Toolbar */}
              <div className="h-11 border-b border-surface-border px-4 bg-surface-panel/70 backdrop-blur flex items-center justify-between flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                    <span className="font-mono text-[11px] font-medium text-slate-200">JOB #{jobId}</span>
                  </div>
                  <span className="text-slate-600">•</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {timingSeconds ? `${timingSeconds}s` : '0.00s'} &nbsp;({itPerSec ? `${itPerSec} it/s` : 'idle'})
                  </span>
                </div>

                {/* Canvas Inspection Utilities */}
                <div className="flex items-center space-x-1 font-mono text-[11px]">
                  <button
                    onClick={() => {}}
                    className="px-2 py-1 rounded hover:bg-surface-hover text-slate-400 hover:text-slate-200 transition-colors"
                    title="100% Zoom"
                  >
                    100%
                  </button>
                  <button
                    onClick={() => {}}
                    className="p-1.5 rounded hover:bg-surface-hover text-slate-400 hover:text-slate-200 transition-colors"
                    title="Fit to Viewport"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="h-3.5 w-px bg-surface-border mx-1" />
                  <button
                    onClick={() => setShowMetadataModal(true)}
                    className="p-1.5 rounded hover:bg-surface-hover text-slate-400 hover:text-slate-200 transition-colors"
                    title="Metadata Details"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Main Rendered Canvas Viewport */}
              <div className="flex-1 overflow-hidden p-4 lg:p-6 flex items-center justify-center relative bg-[radial-gradient(#141822_1px,transparent_1px)] [background-size:20px_20px]">
                {activeTab === 'canvas' ? (
                  <div className="w-full h-full max-w-5xl">
                    <InpaintCanvas
                      initialImage={canvasBaseImage || selectedImage?.url}
                      onMaskReady={(baseDataUrl, maskDataUrl, w, h) => {
                        setInpaintData({ baseDataUrl, maskDataUrl, width: w, height: h });
                      }}
                    />
                  </div>
                ) : isGenerating ? (
                  /* Live Progress & Latent Frame */
                  <div className="relative h-full max-h-[82vh] aspect-square rounded-lg border border-surface-border bg-black shadow-2xl overflow-hidden flex flex-col items-center justify-center p-4">
                    {currentProgress?.preview_base64 ? (
                      <div className="w-full h-full relative overflow-hidden bg-[#0d1017] flex items-center justify-center">
                        <img
                          src={currentProgress.preview_base64}
                          alt="Live Latent Preview"
                          className="w-full h-full object-contain filter blur-[0.5px]"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
                        <span className="font-mono text-xs text-slate-300">
                          Dispatched to Headless ComfyUI...
                        </span>
                      </div>
                    )}

                    {/* Live Progress Tag Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md px-4 py-2.5 rounded-md border border-white/10 font-mono text-[11px] space-y-1.5 shadow-xl">
                      <div className="flex items-center justify-between text-slate-200">
                        <span className="flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          <span>Sampling Latents (Step {currentProgress?.current_step || 0}/{currentProgress?.total_steps || steps})</span>
                        </span>
                        <span className="text-brand-400 font-bold">
                          {(currentProgress?.progress || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-surface-subpanel h-1.5 rounded-full overflow-hidden border border-surface-border">
                        <div
                          className="bg-gradient-to-r from-brand-600 to-brand-400 h-full rounded-full transition-all duration-200"
                          style={{ width: `${currentProgress?.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : selectedImage ? (
                  /* Precision Viewport Frame & Image */
                  <div className="relative h-full max-h-[82vh] aspect-square rounded-lg border border-surface-border bg-black shadow-2xl overflow-hidden group flex items-center justify-center">
                    <div className="w-full h-full relative overflow-hidden bg-[#0d1017]">
                      <img
                        src={selectedImage.url}
                        alt={selectedImage.prompt}
                        className="w-full h-full object-cover select-none transition-transform duration-300 group-hover:scale-[1.01]"
                      />
                    </div>

                    {/* Sleek Overlay Tag */}
                    <div className="absolute top-3.5 left-3.5 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/10 font-mono text-[10px] space-y-0.5 pointer-events-none opacity-90 transition-opacity group-hover:opacity-100 shadow-lg">
                      <div className="text-slate-200 font-medium flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>{selectedImage.width} × {selectedImage.height} • RGB • FP16</span>
                      </div>
                      <div className="text-slate-400">
                        Seed: <span className="text-slate-200 font-semibold">{selectedImage.seed}</span> • CFG {selectedImage.cfg_scale}
                      </div>
                    </div>

                    {/* Floating Inpaint / Full Screen quick button on hover */}
                    <div className="absolute top-3.5 right-3.5 flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleSendToCanvas(selectedImage.url)}
                        className="p-2 rounded-md bg-black/75 backdrop-blur text-slate-200 hover:text-white border border-white/10 shadow hover:bg-black/90 transition-all"
                        title="Send to Inpaint"
                      >
                        <Paintbrush className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setShowFullScreen(true)}
                        className="p-2 rounded-md bg-black/75 backdrop-blur text-slate-200 hover:text-white border border-white/10 shadow hover:bg-black/90 transition-all"
                        title="Full Screen View"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center p-8 border border-surface-border rounded-xl bg-surface-panel/50 text-center space-y-3 max-w-sm">
                    <div className="w-12 h-12 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 shadow-sm">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="font-mono font-semibold text-slate-200 uppercase tracking-wide text-xs">
                      Ready for Synthesis
                    </h3>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                      Enter your conditioning prompt on the left and click "Queue Inference" (⌘Enter) to generate SDXL imagery.
                    </p>
                  </div>
                )}
              </div>

              {/* Action & Export Toolbar */}
              <div className="h-12 border-t border-surface-border bg-surface-panel/90 backdrop-blur px-5 flex items-center justify-between flex-shrink-0">
                {/* History Strip / Mini Batch Reel */}
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Queue</span>
                  <div className="flex items-center space-x-2 overflow-x-auto max-w-md py-1">
                    {images.slice(0, 7).map((img, idx) => {
                      const isCur = selectedImage?.id === img.id;
                      return (
                        <div
                          key={img.id}
                          onClick={() => setSelectedImage(img)}
                          className={`w-7 h-7 rounded overflow-hidden cursor-pointer flex items-center justify-center relative shadow-sm transition-all flex-shrink-0 ${
                            isCur
                              ? 'border-2 border-brand-500 ring-1 ring-brand-500/40 bg-surface-card'
                              : 'border border-surface-border bg-surface-subpanel/50 hover:border-surface-borderLight opacity-70 hover:opacity-100'
                          }`}
                          title={`Image #${img.id}: ${img.prompt.slice(0, 40)}...`}
                        >
                          <img
                            src={img.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Export & Workflow Handoff Utilities */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCopyMetadata()}
                    disabled={!selectedImage}
                    className="px-3 py-1.5 rounded-md border border-surface-border hover:bg-surface-hover text-slate-300 font-mono text-[11px] flex items-center space-x-1.5 transition-colors disabled:opacity-40"
                    title="Copy prompt and generation settings"
                  >
                    {copiedMetadata ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedMetadata ? 'Copied' : 'Copy Metadata'}</span>
                  </button>

                  <button
                    onClick={handleExportPng}
                    disabled={!selectedImage}
                    className="px-3 py-1.5 rounded-md border border-surface-border hover:bg-surface-hover text-slate-300 font-mono text-[11px] flex items-center space-x-1.5 transition-colors disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Export PNG</span>
                  </button>

                  <button
                    onClick={() => selectedImage && handleSendToCanvas(selectedImage.url)}
                    disabled={!selectedImage}
                    className="px-3.5 py-1.5 rounded-md bg-surface-card hover:bg-surface-hover text-slate-100 font-mono text-[11px] font-medium border border-surface-borderLight/70 flex items-center space-x-1.5 shadow-sm transition-colors disabled:opacity-40"
                  >
                    <Paintbrush className="w-3.5 h-3.5 text-brand-400" />
                    <span>Send to Inpaint</span>
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Style Picker Modal */}
      {showStylePicker && (
        <StylePicker
          styles={styles}
          selectedStyles={selectedStyles}
          onToggleStyle={(sName) => {
            setSelectedStyles((prev) =>
              prev.includes(sName) ? prev.filter((s) => s !== sName) : [...prev, sName]
            );
          }}
          onClose={() => setShowStylePicker(false)}
        />
      )}

      {/* Metadata Modal */}
      {showMetadataModal && selectedImage && (
        <MetadataModal
          image={selectedImage}
          onClose={() => setShowMetadataModal(false)}
          onCopyPrompt={handleCopyMetadata}
          copied={copiedMetadata}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          comfyOnline={comfyOnline}
        />
      )}

      {/* Full Screen View Modal */}
      {showFullScreen && selectedImage && (
        <div
          onClick={() => setShowFullScreen(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={selectedImage.url}
            alt={selectedImage.prompt}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <button
            onClick={() => setShowFullScreen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
