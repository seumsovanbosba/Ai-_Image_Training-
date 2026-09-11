import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StudioSidebar } from './components/layout/StudioSidebar';
import { StudioTopBar } from './components/layout/StudioTopBar';
import { ConversationTimeline } from './components/studio/ConversationTimeline';
import { PromptDock } from './components/studio/PromptDock';
import { AdvancedDrawer } from './components/studio/AdvancedDrawer';
import { InpaintCanvas } from './components/canvas/InpaintCanvas';
import { GalleryView } from './components/gallery/GalleryView';
import { DagPipelineView } from './components/dag/DagPipelineView';
import { StylePicker } from './components/prompt/StylePicker';
import { MetadataModal } from './components/common/MetadataModal';
import { SettingsModal } from './components/common/SettingsModal';
import { api } from './services/api';
import { ProgressWebSocket } from './services/websocket';
import { urlToDataUrl } from './utils/image';
import { looksLikeEdit, isTextRemoval, isObjectRemoval, getObjectRemovalPreset, OBJECT_REMOVAL_PRESETS } from './utils/editIntent';
import {
  StylePreset, ResolutionPreset, ModelInfo, LoraInfo, Board,
  ImageAsset, TaskProgress, WorkspaceTab, ChatTurn, RecentChat,
  ImageReference
} from './types';
import { ImageReferenceModal } from './components/studio/ImageReferenceModal';
import { ParticleField } from './components/fx/ParticleField';
import { X } from 'lucide-react';

const chatTitle = (prompt: string) => {
  const first = prompt.split(',')[0].trim();
  return first.slice(0, 42) || 'Untitled generation';
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('studio');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [freshSession, setFreshSession] = useState(false);
  const [activeRecentId, setActiveRecentId] = useState<string | null>(null);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loras, setLoras] = useState<LoraInfo[]>([]);
  const [styles, setStyles] = useState<StylePreset[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionPreset[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageAsset | null>(null);
  const [comfyOnline, setComfyOnline] = useState(false);
  const [engineStarting, setEngineStarting] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(
    'low quality, artifacts, blurry, bad anatomy, blown out contrast, chromatic aberration, cartoon, oversaturated'
  );
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [autoExpand, setAutoExpand] = useState(false);
  const [expansionLevel, setExpansionLevel] = useState('medium');
  const [selectedModel, setSelectedModel] = useState('sd_xl_base_1.0.safetensors');
  const [selectedLora, setSelectedLora] = useState<string | null>(null);
  const [loraEnabled, setLoraEnabled] = useState(true);
  const [loraStrength, setLoraStrength] = useState(0.8);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(30);
  const [cfgScale, setCfgScale] = useState(7.0);
  const [sampler, setSampler] = useState('dpmpp_2m');
  const [scheduler, setScheduler] = useState('karras');
  const [seed, setSeed] = useState(-1);
  const [denoise, setDenoise] = useState(0.85);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);

  const [canvasBaseImage, setCanvasBaseImage] = useState<string | null>(null);
  const [inpaintData, setInpaintData] = useState<{
    baseDataUrl: string;
    maskDataUrl: string;
    width: number;
    height: number;
    growMaskBy?: number;
  } | null>(null);

  const [imageReference, setImageReference] = useState<ImageReference | null>(null);
  const [showReferenceModal, setShowReferenceModal] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<TaskProgress | null>(null);
  const [activeWs, setActiveWs] = useState<ProgressWebSocket | null>(null);
  const [pendingTurn, setPendingTurn] = useState<ChatTurn | null>(null);

  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedMetadata, setCopiedMetadata] = useState(false);

  const loraPayload = (selectedLora && loraEnabled)
    ? { lora_name: selectedLora, lora_strength: loraStrength }
    : { lora_name: null, lora_strength: loraStrength };

  useEffect(() => {
    const initData = async () => {
      try {
        const [mList, lList, sList, rList, bList, imgList, status] = await Promise.all([
          api.getModels(),
          api.getLoras(),
          api.getStyles(),
          api.getResolutions(),
          api.getBoards(),
          api.getImages(),
          api.getSystemStatus(),
        ]);
        setModels(mList);
        if (mList.length > 0) setSelectedModel(mList[0].name);
        setLoras(lList);
        setStyles(sList);
        setResolutions(rList);
        setBoards(bList);
        setImages(imgList);
        if (imgList.length > 0) setSelectedImage(imgList[0]);
        setComfyOnline(status.comfyui_online);
        setEngineStarting(Boolean(status.engine_starting));
      } catch (err) {
        console.error('Failed to load suite data', err);
      }
    };
    initData();

    const pollInterval = setInterval(async () => {
      try {
        const status = await api.getSystemStatus();
        setComfyOnline(status.comfyui_online);
        setEngineStarting(Boolean(status.engine_starting));
      } catch (err) {
        setComfyOnline(false);
        setEngineStarting(false);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewGeneration();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const recents: RecentChat[] = useMemo(() => {
    const seen = new Set<string>();
    const items: RecentChat[] = [];
    for (const img of images) {
      const title = chatTitle(img.prompt);
      const key = title.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ id: String(img.id), title, prompt: img.prompt });
      }
    }
    return items;
  }, [images]);

  const historyTurns: ChatTurn[] = useMemo(() => {
    if (freshSession && !pendingTurn) return [];
    let pool = [...images].reverse();
    if (activeRecentId) {
      const recent = recents.find((r) => r.id === activeRecentId);
      if (recent) {
        const key = chatTitle(recent.prompt).toLowerCase();
        pool = pool.filter((img) => chatTitle(img.prompt).toLowerCase() === key);
      }
    } else {
      pool = pool.slice(-4);
    }
    return pool.map((img) => ({
      id: `img-${img.id}`,
      prompt: img.prompt,
      createdAt: img.created_at,
      image: img,
    }));
  }, [images, freshSession, pendingTurn, activeRecentId, recents]);

  const turns: ChatTurn[] = useMemo(() => {
    if (pendingTurn) return [...historyTurns.filter((t) => t.id !== pendingTurn.id), pendingTurn];
    return historyTurns;
  }, [historyTurns, pendingTurn]);

  const refreshGallery = async () => {
    try {
      const [imgList, bList] = await Promise.all([api.getImages(), api.getBoards()]);
      setImages(imgList);
      setBoards(bList);
      if (imgList.length > 0) setSelectedImage(imgList[0]);
    } catch (err) {
      console.error('Failed to refresh gallery', err);
    }
  };

  const handleNewGeneration = () => {
    setFreshSession(true);
    setActiveRecentId(null);
    setPendingTurn(null);
    setPrompt('');
    setImageReference(null);
    setActiveTab('studio');
  };

  const handleSelectRecent = (recent: RecentChat) => {
    setFreshSession(false);
    setActiveRecentId(recent.id);
    setPrompt(recent.prompt);
    setActiveTab('studio');
  };

  const startGeneration = useCallback(async (override?: {
    prompt?: string;
    width?: number;
    height?: number;
    seed?: number;
    mode?: 'txt2img' | 'img2img' | 'vary';
    baseImage?: string;
    fidelity?: number;
    autoExpand?: boolean;
  }) => {
    const nextPrompt = (override?.prompt ?? prompt).trim();
    if (!nextPrompt || isGenerating) return;

    const runWidth = override?.width ?? width;
    const runHeight = override?.height ?? height;
    const runSeed = override?.seed ?? seed;
    const runAutoExpand = override?.autoExpand ?? autoExpand;
    const editIntent = looksLikeEdit(nextPrompt);
    const textEdit = isTextRemoval(nextPrompt);
    const objectEdit = isObjectRemoval(nextPrompt);
    const fallbackSource = selectedImage?.url || images[0]?.url || null;
    const sourceImage =
      override?.baseImage ||
      imageReference?.dataUrl ||
      (editIntent ? fallbackSource : null);

    // If user has a source image and requests object removal while in Studio mode,
    // redirect them to the surgical Inpaint Canvas where they can brush a mask over
    // the target object (glasses, hat, beard, etc.) and execute replacement inpainting
    // with 100% boundary preservation.
    if (activeTab !== 'canvas' && objectEdit && sourceImage && override?.mode !== 'txt2img') {
      setCanvasBaseImage(sourceImage);
      const preset = getObjectRemovalPreset(nextPrompt);
      if (preset) {
        setPrompt(preset.replacementPrompt);
        setNegativePrompt((prev) => {
          const items = prev.split(',').map((s) => s.trim()).filter(Boolean);
          const newItems = preset.negativePrompt.split(',').map((s) => s.trim()).filter(Boolean);
          for (const item of newItems) {
            if (!items.includes(item)) items.push(item);
          }
          return items.join(', ');
        });
      }
      setActiveTab('canvas');
      return;
    }

    setIsGenerating(true);
    setCurrentProgress(null);
    setFreshSession(false);
    setActiveTab(activeTab === 'canvas' ? 'canvas' : 'studio');
    const startTime = Date.now();
    const turnId = `gen-${Date.now()}`;
    setPendingTurn({
      id: turnId,
      prompt: nextPrompt,
      createdAt: new Date().toISOString(),
      generating: true,
      progress: null,
      elapsedSeconds: 0,
    });

    try {
      let task_id: string;
      if (activeTab === 'canvas' && inpaintData && override?.mode !== 'img2img' && override?.mode !== 'vary') {
        const res = await api.inpaint({
          prompt: nextPrompt,
          negative_prompt: negativePrompt,
          styles: selectedStyles,
          auto_expand: false,
          base_image: inpaintData.baseDataUrl,
          mask_image: inpaintData.maskDataUrl,
          denoise,
          width: inpaintData.width,
          height: inpaintData.height,
          grow_mask_by: inpaintData.growMaskBy ?? 6,
          model_name: selectedModel,
          sampler,
          scheduler,
          steps,
          cfg_scale: cfgScale,
          seed: runSeed,
          board_id: selectedBoardId,
          ...loraPayload,
        });
        task_id = res.task_id;
      } else if (activeTab === 'canvas') {
        setIsGenerating(false);
        setPendingTurn(null);
        return;
      } else if (sourceImage) {
        const fidelity = override?.fidelity
          ?? (textEdit ? 0.60 : (imageReference?.fidelity ?? 0.65));
        const res = await api.img2img({
          prompt: nextPrompt,
          negative_prompt: negativePrompt,
          styles: selectedStyles,
          auto_expand: editIntent ? false : runAutoExpand,
          expansion_level: expansionLevel,
          image: sourceImage,
          fidelity,
          width: runWidth,
          height: runHeight,
          model_name: selectedModel,
          sampler,
          scheduler,
          steps,
          cfg_scale: cfgScale,
          seed: runSeed,
          board_id: selectedBoardId,
          ...loraPayload,
        });
        task_id = res.task_id;
      } else {
        const res = await api.generate({
          prompt: nextPrompt,
          negative_prompt: negativePrompt,
          styles: selectedStyles,
          auto_expand: runAutoExpand,
          expansion_level: expansionLevel,
          width: runWidth,
          height: runHeight,
          model_name: selectedModel,
          sampler,
          scheduler,
          steps,
          cfg_scale: cfgScale,
          seed: runSeed,
          board_id: selectedBoardId,
          ...loraPayload,
        });
        task_id = res.task_id;
      }

      const ws = new ProgressWebSocket(
        task_id,
        (progress) => {
          setCurrentProgress(progress);
          const elapsed = (Date.now() - startTime) / 1000;
          if (progress.type === 'failed' || progress.status === 'failed') {
            setIsGenerating(false);
            setPendingTurn((prev) => prev ? {
              ...prev,
              generating: false,
              progress,
              elapsedSeconds: Number(elapsed.toFixed(2)),
            } : prev);
            return;
          }
          if (progress.type === 'interrupted' || progress.status === 'interrupted') {
            setIsGenerating(false);
            setPendingTurn(null);
            return;
          }
          setPendingTurn((prev) => prev ? {
            ...prev,
            generating: true,
            progress,
            elapsedSeconds: Number(elapsed.toFixed(2)),
          } : prev);
        },
        async () => {
          setIsGenerating(false);
          const elapsed = (Date.now() - startTime) / 1000;
          const updatedImages = await api.getImages();
          setImages(updatedImages);
          const latest = updatedImages[0];
          if (latest) {
            setSelectedImage(latest);
            if (activeTab === 'canvas') {
              setCanvasBaseImage(latest.url);
            }
          }
          setPendingTurn((prev) => prev && latest && prev.progress?.type !== 'failed' && prev.progress?.status !== 'failed' ? {
            ...prev,
            generating: false,
            image: latest,
            elapsedSeconds: Number(elapsed.toFixed(2)),
          } : prev);
          setTimeout(() => {
            setPendingTurn((prev) => (prev?.progress?.type === 'failed' || prev?.progress?.status === 'failed' ? prev : null));
          }, 100);
        },
        (err) => {
          console.error('WebSocket error:', err);
          setIsGenerating(false);
        }
      );
      setActiveWs(ws);
    } catch (err: any) {
      console.error('Generation request failed:', err);
      setIsGenerating(false);
      const errMsg = err?.message || 'Generation request failed';
      setPendingTurn((prev) => prev ? {
        ...prev,
        generating: false,
        progress: {
          task_id: '',
          status: 'failed',
          type: 'failed',
          error: errMsg,
        },
      } : null);
    }
  }, [
    prompt, isGenerating, activeTab, inpaintData, imageReference, negativePrompt, selectedStyles,
    autoExpand, expansionLevel, width, height, selectedModel, sampler, scheduler,
    steps, cfgScale, seed, selectedBoardId, denoise, selectedImage, images,
    selectedLora, loraStrength, loraEnabled,
  ]);

  const handleInterrupt = async () => {
    try {
      await api.interrupt();
    } catch (e) {
      console.error('Failed to interrupt:', e);
    } finally {
      if (activeWs) activeWs.close();
      setIsGenerating(false);
      setPendingTurn(null);
    }
  };

  const handleUpscale = useCallback(async (image: ImageAsset) => {
    if (isGenerating) return;

    setIsGenerating(true);
    setCurrentProgress(null);
    setFreshSession(false);
    setActiveTab('studio');
    const startTime = Date.now();
    const turnId = `upscale-${Date.now()}`;
    const cleanPrompt = image.prompt.replace(/^\[Upscaled \d+x\]\s*/i, '');
    const upscalePrompt = `[Upscaled 2x] ${cleanPrompt}`;

    setPendingTurn({
      id: turnId,
      prompt: upscalePrompt,
      createdAt: new Date().toISOString(),
      generating: true,
      progress: null,
      elapsedSeconds: 0,
    });

    try {
      const res = await api.upscale({
        image_id: image.id,
        prompt: cleanPrompt,
        scale_factor: 2.0,
        denoise: 0,
        model_name: image.model_name,
        sampler: image.sampler,
        scheduler: image.scheduler,
        ...loraPayload,
      });

      const ws = new ProgressWebSocket(
        res.task_id,
        (progress) => {
          setCurrentProgress(progress);
          const elapsed = (Date.now() - startTime) / 1000;
          if (progress.type === 'failed' || progress.status === 'failed') {
            setIsGenerating(false);
            setPendingTurn((prev) => prev ? {
              ...prev,
              generating: false,
              progress,
              elapsedSeconds: Number(elapsed.toFixed(2)),
            } : prev);
            return;
          }
          setPendingTurn((prev) => prev ? {
            ...prev,
            generating: true,
            progress,
            elapsedSeconds: Number(elapsed.toFixed(2)),
          } : prev);
        },
        async () => {
          setIsGenerating(false);
          const elapsed = (Date.now() - startTime) / 1000;
          const updatedImages = await api.getImages();
          setImages(updatedImages);
          const latest = updatedImages[0];
          if (latest) setSelectedImage(latest);
          setPendingTurn((prev) => prev && latest ? {
            ...prev,
            generating: false,
            image: latest,
            elapsedSeconds: Number(elapsed.toFixed(2)),
          } : null);
          setTimeout(() => setPendingTurn(null), 50);
        },
        (err) => {
          console.error('Upscale WebSocket error:', err);
          setIsGenerating(false);
          setPendingTurn(null);
        }
      );
      setActiveWs(ws);
    } catch (err: any) {
      console.error('Upscale request failed:', err);
      setIsGenerating(false);
      setPendingTurn((prev) => prev ? {
        ...prev,
        generating: false,
        progress: {
          task_id: '',
          status: 'failed',
          type: 'failed',
          error: err?.message || 'Upscale failed. Install RealESRGAN with python scripts/download_upscale_model.py',
        },
      } : null);
    }
  }, [isGenerating, selectedLora, loraStrength, loraEnabled]);

  const handleUseAsReference = async (img: ImageAsset) => {
    try {
      const dataUrl = await urlToDataUrl(img.url);
      setImageReference({
        dataUrl,
        name: img.filename || 'generated.png',
        fidelity: 0.65,
        width: img.width,
        height: img.height,
      });
      if (!prompt.trim()) setPrompt(img.prompt.replace(/^\[Upscaled \d+x\]\s*/i, ''));
      setActiveTab('studio');
    } catch (err) {
      console.error('Failed to attach reference', err);
    }
  };

  const handleSendToCanvas = (imageUrl: string, promptText?: string) => {
    setCanvasBaseImage(imageUrl);
    if (promptText) {
      const clean = promptText.replace(/^\[Upscaled \d+x\]\s*/i, '');
      const preset = getObjectRemovalPreset(clean);
      if (preset) {
        setPrompt(preset.replacementPrompt);
        setNegativePrompt((prev) => {
          const items = prev.split(',').map((s) => s.trim()).filter(Boolean);
          const newItems = preset.negativePrompt.split(',').map((s) => s.trim()).filter(Boolean);
          for (const item of newItems) {
            if (!items.includes(item)) items.push(item);
          }
          return items.join(', ');
        });
        setDenoise(0.85);
      } else {
        setPrompt(clean);
      }
    }
    setActiveTab('canvas');
  };

  const handleMaskReady = useCallback((baseDataUrl: string, maskDataUrl: string, width: number, height: number, growMaskBy?: number) => {
    setInpaintData({ baseDataUrl, maskDataUrl, width, height, growMaskBy });
  }, []);

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
    setFreshSession(false);
  };

  const handleDeleteImage = async (id: number) => {
    await api.deleteImage(id);
    await refreshGallery();
  };

  const handleUploadToInpaint = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setCanvasBaseImage(dataUrl);
        setActiveTab('canvas');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteRecent = async (recent: RecentChat) => {
    const key = chatTitle(recent.prompt).toLowerCase();
    const toDelete = images.filter((img) => chatTitle(img.prompt).toLowerCase() === key);
    const toDeleteIds = toDelete.map((img) => img.id);

    // Optimistically update local state immediately
    setImages((prev) => prev.filter((img) => chatTitle(img.prompt).toLowerCase() !== key));

    if (activeRecentId === recent.id) {
      handleNewGeneration();
    }

    try {
      if (toDeleteIds.length > 0) {
        await api.deleteImagesBatch(toDeleteIds);
      }
    } catch (err) {
      console.error('Failed to batch delete images for recent chat', err);
      for (const id of toDeleteIds) {
        try {
          await api.deleteImage(id);
        } catch {}
      }
    } finally {
      await refreshGallery();
    }
  };


  const handleCreateBoard = async (name: string, description?: string) => {
    await api.createBoard(name, description);
    await refreshGallery();
  };

  const handleAssignBoard = async (imageId: number, boardId: number | null) => {
    await api.assignImageBoard(imageId, boardId);
    await refreshGallery();
  };

  const handleExportPng = (image: ImageAsset) => {
    const a = document.createElement('a');
    a.href = image.url;
    a.download = image.filename || 'studio_output.png';
    a.click();
  };

  const handleCopyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
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
      seed: selectedImage.seed,
    }, null, 2);
    navigator.clipboard.writeText(data);
    setCopiedMetadata(true);
    setTimeout(() => setCopiedMetadata(false), 2000);
  };

  const handleStartEngine = async () => {
    setEngineStarting(true);
    try {
      await api.startEngine();
      const status = await api.getSystemStatus();
      setComfyOnline(status.comfyui_online);
      setEngineStarting(Boolean(status.engine_starting));
    } catch (err) {
      console.error('Failed to trigger start engine', err);
    }
  };

  const pad = sidebarCollapsed ? 'pl-14' : 'pl-sidebar';

  return (
    <div className="h-screen bg-background text-on-surface antialiased overflow-hidden">
      <StudioSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        activeTab={activeTab}
        search={search}
        onSearch={setSearch}
        recents={recents}
        activeRecentId={activeRecentId}
        imageCount={images.length}
        onNewGeneration={handleNewGeneration}
        onOpenGallery={() => setActiveTab('gallery')}
        onOpenCanvas={() => setActiveTab('canvas')}
        onSelectRecent={handleSelectRecent}
        onDeleteRecent={handleDeleteRecent}
      />

      <div className={`${pad} min-h-screen flex flex-col h-full`}>
        <StudioTopBar
          sidebarCollapsed={sidebarCollapsed}
          activeTab={activeTab}
          comfyOnline={comfyOnline}
          engineStarting={engineStarting}
          onStartEngine={handleStartEngine}
          onOpenSettings={() => setShowSettingsModal(true)}
          onBackToStudio={() => setActiveTab('studio')}
        />

        <main className="w-full pt-16 bg-surface-dim flex-1 flex flex-col min-h-0 relative">
          <ParticleField />
          {activeTab === 'gallery' && (
            <div className="flex-1 overflow-hidden p-4 relative z-10">
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
                onUpscale={handleUpscale}
              />
            </div>
          )}

          {activeTab === 'dag' && (
            <div className="flex-1 overflow-hidden relative z-10">
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

          {activeTab === 'canvas' && (
            <div className="flex-1 overflow-hidden p-4 relative z-10 flex flex-col min-h-0">
              <InpaintCanvas
                initialImage={canvasBaseImage || selectedImage?.url}
                onMaskReady={handleMaskReady}
                onBack={() => setActiveTab('studio')}
                onInpaint={(canvasPrompt?: string) => {
                  const runPrompt = (canvasPrompt ?? prompt).trim();
                  if (!runPrompt) return;
                  if (canvasPrompt) setPrompt(canvasPrompt);
                  startGeneration({ prompt: runPrompt });
                }}
                isGenerating={isGenerating}
                prompt={prompt}
                setPrompt={setPrompt}
                negativePrompt={negativePrompt}
                setNegativePrompt={setNegativePrompt}
                denoise={denoise}
                setDenoise={setDenoise}
              />
            </div>
          )}

          {activeTab === 'studio' && (
            <ConversationTimeline
              turns={turns}
              copiedId={copiedId}
              onCopyPrompt={handleCopyPrompt}
              onDownload={handleExportPng}
              onInpaint={handleSendToCanvas}
              onRemoveObject={(imageUrl, promptText) => {
                handleSendToCanvas(imageUrl, promptText);
              }}
              onOpenCanvas={(url, promptText) => {
                if (url) setCanvasBaseImage(url);
                if (promptText) setPrompt(promptText.replace(/^\[Upscaled \d+x\]\s*/i, ''));
                setActiveTab('canvas');
              }}
              onUploadToInpaint={handleUploadToInpaint}
              onOpenDag={() => setActiveTab('dag')}
              onOpenMetadata={(img) => { setSelectedImage(img); setShowMetadataModal(true); }}
              onFullscreen={(img) => { setSelectedImage(img); setShowFullScreen(true); }}
              onVary={async (img) => {
                try {
                  const dataUrl = await urlToDataUrl(img.url);
                  setPrompt(img.prompt.replace(/^\[Upscaled \d+x\]\s*/i, ''));
                  startGeneration({
                    prompt: img.prompt.replace(/^\[Upscaled \d+x\]\s*/i, ''),
                    width: img.width,
                    height: img.height,
                    seed: Math.floor(Math.random() * 2147483647),
                    mode: 'vary',
                    baseImage: dataUrl,
                    fidelity: 0.72,
                    autoExpand: false,
                  });
                } catch (err) {
                  console.error('Failed to vary image', err);
                }
              }}
              onUpscale={handleUpscale}
              onUseAsReference={handleUseAsReference}
            />
          )}

          {activeTab === 'studio' && (
            <PromptDock
              sidebarCollapsed={sidebarCollapsed}
              prompt={prompt}
              setPrompt={setPrompt}
              models={models}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              loras={loras}
              selectedLora={selectedLora}
              setSelectedLora={setSelectedLora}
              loraEnabled={loraEnabled}
              setLoraEnabled={setLoraEnabled}
              loraStrength={loraStrength}
              setLoraStrength={setLoraStrength}
              width={width}
              height={height}
              setDimensions={(w, h) => { setWidth(w); setHeight(h); }}
              selectedStyles={selectedStyles}
              onRemoveStyle={(name) => setSelectedStyles((prev) => prev.filter((s) => s !== name))}
              isGenerating={isGenerating}
              onGenerate={() => startGeneration()}
              onInterrupt={handleInterrupt}
              onOpenStyles={() => setShowStylePicker(true)}
              onOpenNegative={() => setShowAdvanced(true)}
              onOpenAdvanced={() => setShowAdvanced(true)}
              onAttachImage={() => setShowReferenceModal(true)}
              onUploadToInpaint={handleUploadToInpaint}
              onOpenInpaint={() => setActiveTab('canvas')}
              onEditReferenceInCanvas={(ref) => {
                handleSendToCanvas(ref.dataUrl);
              }}
              onRemoveObjectFromReference={(ref) => {
                handleSendToCanvas(ref.dataUrl);
                const preset = OBJECT_REMOVAL_PRESETS.glasses;
                setPrompt(preset.replacementPrompt);
                setNegativePrompt((prev) => {
                  const items = prev.split(',').map((s) => s.trim()).filter(Boolean);
                  const newItems = preset.negativePrompt.split(',').map((s) => s.trim()).filter(Boolean);
                  for (const item of newItems) {
                    if (!items.includes(item)) items.push(item);
                  }
                  return items.join(', ');
                });
                setDenoise(0.85);
              }}
              imageReference={imageReference}
              onUpdateReferenceFidelity={(fid) => {
                setImageReference((prev) => prev ? { ...prev, fidelity: fid } : prev);
              }}
              onRemoveReference={() => setImageReference(null)}
              autoExpand={autoExpand}
              setAutoExpand={setAutoExpand}
            />
          )}

        </main>
      </div>

      <AdvancedDrawer
        open={showAdvanced}
        onClose={() => setShowAdvanced(false)}
        steps={steps}
        setSteps={setSteps}
        cfgScale={cfgScale}
        setCfgScale={setCfgScale}
        sampler={sampler}
        setSampler={setSampler}
        scheduler={scheduler}
        setScheduler={setScheduler}
        seed={seed}
        setSeed={setSeed}
        denoise={denoise}
        setDenoise={setDenoise}
        showDenoise={activeTab === 'canvas'}
        boards={boards}
        selectedBoardId={selectedBoardId}
        setSelectedBoardId={setSelectedBoardId}
        negativePrompt={negativePrompt}
        setNegativePrompt={setNegativePrompt}
        onOpenDag={() => { setShowAdvanced(false); setActiveTab('dag'); }}
        autoExpand={autoExpand}
        setAutoExpand={setAutoExpand}
        expansionLevel={expansionLevel}
        setExpansionLevel={setExpansionLevel}
      />

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

      {showMetadataModal && selectedImage && (
        <MetadataModal
          image={selectedImage}
          onClose={() => setShowMetadataModal(false)}
          onCopyPrompt={handleCopyMetadata}
          copied={copiedMetadata}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          comfyOnline={comfyOnline}
        />
      )}

      {showFullScreen && selectedImage && (
        <div
          onClick={() => setShowFullScreen(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img src={selectedImage.url} alt={selectedImage.prompt} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          <button
            onClick={() => setShowFullScreen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {showReferenceModal && (
        <ImageReferenceModal
          images={images}
          onClose={() => setShowReferenceModal(false)}
          onSelect={(ref) => {
            setImageReference(ref);
            setShowReferenceModal(false);
          }}
          onSelectForInpaint={(imageUrl) => {
            setShowReferenceModal(false);
            handleSendToCanvas(imageUrl);
          }}
        />
      )}
    </div>
  );
};

export default App;
