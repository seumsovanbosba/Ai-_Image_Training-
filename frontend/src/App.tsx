import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { PromptBar } from './components/prompt/PromptBar';
import { GenerationSettings } from './components/controls/GenerationSettings';
import { GenerationProgress } from './components/controls/GenerationProgress';
import { InpaintCanvas } from './components/canvas/InpaintCanvas';
import { GalleryView } from './components/gallery/GalleryView';
import { api } from './services/api';
import { ProgressWebSocket } from './services/websocket';
import { 
  StylePreset, ResolutionPreset, ModelInfo, Board, 
  ImageAsset, TaskProgress 
} from './types';
import { Paintbrush, Wand2, Layers, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<'studio' | 'gallery' | 'settings'>('studio');
  const [studioMode, setStudioMode] = useState<'generate' | 'inpaint'>('generate');

  // Metadata & Engine Data
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [styles, setStyles] = useState<StylePreset[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionPreset[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [comfyOnline, setComfyOnline] = useState<boolean>(false);

  // Generation Parameters
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['Fooocus V2']);
  const [autoExpand, setAutoExpand] = useState<boolean>(true);
  const [expansionLevel, setExpansionLevel] = useState<string>('medium');

  const [selectedModel, setSelectedModel] = useState<string>('');
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
    } catch (err) {
      console.error('Failed to refresh gallery', err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setCurrentProgress(null);

    try {
      let task_id: string;

      if (studioMode === 'inpaint' && inpaintData) {
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
        },
        () => {
          setIsGenerating(false);
          refreshGallery();
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
    setStudioMode('inpaint');
    setActiveTab('studio');
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

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0e1a] text-slate-100">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        comfyOnline={comfyOnline}
      />

      {/* Main Workspace */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'studio' && (
          <div className="flex flex-col space-y-4">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between bg-[#111726] border border-slate-800 p-1.5 rounded-2xl">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setStudioMode('generate')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                    studioMode === 'generate'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Text-to-Image Studio</span>
                </button>

                <button
                  onClick={() => setStudioMode('inpaint')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                    studioMode === 'inpaint'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Paintbrush className="w-4 h-4" />
                  <span>Production Inpaint Canvas</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 pr-3 font-medium hidden sm:block">
                {studioMode === 'generate'
                  ? 'Standard prompt DAG synthesis'
                  : 'Interactive brush mask + base image compositing'}
              </div>
            </div>

            {/* Inpainting Canvas Mode */}
            {studioMode === 'inpaint' && (
              <div className="h-[520px]">
                <InpaintCanvas
                  initialImage={canvasBaseImage}
                  onMaskReady={(baseDataUrl, maskDataUrl, w, h) => {
                    setInpaintData({ baseDataUrl, maskDataUrl, width: w, height: h });
                  }}
                />
              </div>
            )}

            {/* Prompt Bar (Fooocus automated prompt & style injector) */}
            <PromptBar
              prompt={prompt}
              setPrompt={setPrompt}
              negativePrompt={negativePrompt}
              setNegativePrompt={setNegativePrompt}
              styles={styles}
              selectedStyles={selectedStyles}
              setSelectedStyles={setSelectedStyles}
              autoExpand={autoExpand}
              setAutoExpand={setAutoExpand}
              expansionLevel={expansionLevel}
              setExpansionLevel={setExpansionLevel}
              onGenerate={handleGenerate}
              onInterrupt={handleInterrupt}
              isGenerating={isGenerating}
            />

            {/* Split View: Engine Settings & Realtime Progress / Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <GenerationSettings
                  models={models}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  resolutions={resolutions}
                  width={width}
                  height={height}
                  setDimensions={(w, h) => {
                    setWidth(w);
                    setHeight(h);
                  }}
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
                  isInpaintTab={studioMode === 'inpaint'}
                  boards={boards}
                  selectedBoardId={selectedBoardId}
                  setSelectedBoardId={setSelectedBoardId}
                />
              </div>

              <div className="md:col-span-1 flex flex-col space-y-4">
                <GenerationProgress
                  progress={currentProgress}
                  isGenerating={isGenerating}
                />

                {/* Latest output preview if generated */}
                {!isGenerating && images.length > 0 && (
                  <div className="bg-[#111726] border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Recent Output
                    </span>
                    <div className="relative rounded-xl overflow-hidden aspect-square border border-slate-800 group">
                      <img
                        src={images[0].url}
                        alt="Recent generation"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleSendToCanvas(images[0].url)}
                        className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-indigo-600/90 text-white text-[11px] font-semibold flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition shadow-lg"
                      >
                        <Paintbrush className="w-3 h-3" />
                        <span>Inpaint</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Gallery & Boards Tab */}
        {activeTab === 'gallery' && (
          <div className="h-[calc(100vh-140px)]">
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
      </main>
    </div>
  );
};
export default App;
