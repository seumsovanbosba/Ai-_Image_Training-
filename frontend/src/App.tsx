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
import {
  StylePreset, ResolutionPreset, ModelInfo, Board,
  ImageAsset, TaskProgress, WorkspaceTab, ChatTurn, RecentChat
} from './types';
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
  const [styles, setStyles] = useState<StylePreset[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionPreset[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageAsset | null>(null);
  const [comfyOnline, setComfyOnline] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(
    'low quality, artifacts, blurry, bad anatomy, blown out contrast, chromatic aberration, cartoon, oversaturated'
  );
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [autoExpand] = useState(true);
  const [expansionLevel] = useState('medium');
  const [selectedModel, setSelectedModel] = useState('sd_xl_base_1.0.safetensors');
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
  } | null>(null);

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
        if (imgList.length > 0) setSelectedImage(imgList[0]);
        setComfyOnline(status.comfyui_online);
      } catch (err) {
        console.error('Failed to load suite data', err);
      }
    };
    initData();
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
  }) => {
    const nextPrompt = (override?.prompt ?? prompt).trim();
    if (!nextPrompt || isGenerating) return;

    const runWidth = override?.width ?? width;
    const runHeight = override?.height ?? height;
    const runSeed = override?.seed ?? seed;

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
      if (activeTab === 'canvas' && inpaintData) {
        const res = await api.inpaint({
          prompt: nextPrompt,
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
          seed: runSeed,
          board_id: selectedBoardId,
        });
        task_id = res.task_id;
      } else {
        const res = await api.generate({
          prompt: nextPrompt,
          negative_prompt: negativePrompt,
          styles: selectedStyles,
          auto_expand: autoExpand,
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
        });
        task_id = res.task_id;
      }

      const ws = new ProgressWebSocket(
        task_id,
        (progress) => {
          setCurrentProgress(progress);
          const elapsed = (Date.now() - startTime) / 1000;
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
          console.error('WebSocket error:', err);
          setIsGenerating(false);
          setPendingTurn(null);
        }
      );
      setActiveWs(ws);
    } catch (err) {
      console.error('Generation request failed:', err);
      setIsGenerating(false);
      setPendingTurn(null);
    }
  }, [
    prompt, isGenerating, activeTab, inpaintData, negativePrompt, selectedStyles,
    autoExpand, expansionLevel, width, height, selectedModel, sampler, scheduler,
    steps, cfgScale, seed, selectedBoardId, denoise,
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
    setFreshSession(false);
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
        onSelectRecent={handleSelectRecent}
      />

      <div className={`${pad} min-h-screen flex flex-col h-full`}>
        <StudioTopBar
          sidebarCollapsed={sidebarCollapsed}
          activeTab={activeTab}
          onOpenSettings={() => setShowSettingsModal(true)}
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
            <div className="flex-1 overflow-hidden p-4 pb-44 relative z-10">
              <InpaintCanvas
                initialImage={canvasBaseImage || selectedImage?.url}
                onMaskReady={(baseDataUrl, maskDataUrl, w, h) => {
                  setInpaintData({ baseDataUrl, maskDataUrl, width: w, height: h });
                }}
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
              onOpenCanvas={handleSendToCanvas}
              onOpenDag={() => setActiveTab('dag')}
              onOpenMetadata={(img) => { setSelectedImage(img); setShowMetadataModal(true); }}
              onFullscreen={(img) => { setSelectedImage(img); setShowFullScreen(true); }}
              onVary={(p) => {
                setPrompt(p);
                startGeneration({ prompt: p, seed: Math.floor(Math.random() * 2147483647) });
              }}
              onUpscale={(img) => {
                setPrompt(img.prompt);
                startGeneration({
                  prompt: img.prompt,
                  width: Math.min(img.width * 2, 2048),
                  height: Math.min(img.height * 2, 2048),
                });
              }}
            />
          )}

          {(activeTab === 'studio' || activeTab === 'canvas') && (
            <PromptDock
              sidebarCollapsed={sidebarCollapsed}
              prompt={prompt}
              setPrompt={setPrompt}
              models={models}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
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
              onAttachImage={() => setActiveTab('canvas')}
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
    </div>
  );
};

export default App;
