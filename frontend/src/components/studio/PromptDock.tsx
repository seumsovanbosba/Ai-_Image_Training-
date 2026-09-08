import React, { useEffect, useRef, useState } from 'react';
import {
  Plus, Zap, ChevronDown, SlidersHorizontal,
  ArrowUp, Square, ImagePlus, Filter, X
} from 'lucide-react';
import { ModelInfo } from '../../types';

export const ASPECT_RATIOS = [
  { label: '1:1 Square', sub: '1024×1024', w: 1024, h: 1024 },
  { label: '16:9 Cinema', sub: '1344×768', w: 1344, h: 768 },
  { label: '9:16 Portrait', sub: '768×1344', w: 768, h: 1344 },
  { label: '21:9 Panoramic', sub: '1536×640', w: 1536, h: 640 },
];

interface PromptDockProps {
  sidebarCollapsed: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  models: ModelInfo[];
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  width: number;
  height: number;
  setDimensions: (w: number, h: number) => void;
  selectedStyles: string[];
  onRemoveStyle: (name: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onInterrupt: () => void;
  onOpenStyles: () => void;
  onOpenNegative: () => void;
  onOpenAdvanced: () => void;
  onAttachImage?: () => void;
}

const shortModel = (name: string) =>
  name
    .replace(/\.safetensors$/i, '')
    .replace(/sd[_-]?xl/gi, 'SDXL')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const PromptDock: React.FC<PromptDockProps> = ({
  sidebarCollapsed,
  prompt,
  setPrompt,
  models,
  selectedModel,
  setSelectedModel,
  width,
  height,
  setDimensions,
  selectedStyles,
  onRemoveStyle,
  isGenerating,
  onGenerate,
  onInterrupt,
  onOpenStyles,
  onOpenNegative,
  onOpenAdvanced,
  onAttachImage,
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [aspectOpen, setAspectOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeAspect = ASPECT_RATIOS.find((a) => a.w === width && a.h === height) || ASPECT_RATIOS[0];

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [prompt]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setToolsOpen(false);
        setModelOpen(false);
        setAspectOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!isGenerating && prompt.trim()) onGenerate();
    }
  };

  return (
    <div
      className={`fixed bottom-0 right-0 px-4 sm:px-8 pb-6 pt-1 z-30 pointer-events-none flex flex-col items-center ${
        sidebarCollapsed ? 'left-14' : 'left-sidebar'
      }`}
    >
      <div ref={wrapRef} className="w-full max-w-dock pointer-events-auto relative">
        {toolsOpen && (
          <div className="absolute -top-4 -translate-y-full left-0 w-72 bg-surface-container-high/95 backdrop-blur-2xl rounded-xl p-1 shadow-2xl z-40">
            <div className="px-2 py-0.5 text-outline font-mono text-label-caps uppercase tracking-wider">
              Input &amp; Synthesis Tools
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <button
                onClick={() => { setToolsOpen(false); onAttachImage?.(); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-bright text-on-surface transition-colors text-left"
              >
                <ImagePlus className="w-[18px] h-[18px] text-primary" />
                <span className="flex flex-col">
                  <span className="text-body-md">Image-to-Image Reference</span>
                  <span className="font-mono text-mono-data text-outline">Upload guidance latents</span>
                </span>
              </button>
              <button
                onClick={() => { setToolsOpen(false); onOpenStyles(); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-bright text-on-surface transition-colors text-left"
              >
                <SlidersHorizontal className="w-[18px] h-[18px] text-secondary" />
                <span className="flex flex-col">
                  <span className="text-body-md">Add Style Preset</span>
                  <span className="font-mono text-mono-data text-outline">Brutalism, Film Grain, Macro</span>
                </span>
              </button>
              <button
                onClick={() => { setToolsOpen(false); onOpenNegative(); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-bright text-on-surface transition-colors text-left"
              >
                <Filter className="w-[18px] h-[18px] text-tertiary" />
                <span className="flex flex-col">
                  <span className="text-body-md">Negative Prompt Filter</span>
                  <span className="font-mono text-mono-data text-outline">Prune artifacts, oversaturation</span>
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="bg-surface-container/95 backdrop-blur-2xl rounded-2xl shadow-dock p-2 flex flex-col gap-1 transition-shadow duration-300 focus-within:shadow-dockFocus">
          <div className="flex items-end gap-2 px-1">
            <button
              onClick={() => { setToolsOpen((v) => !v); setModelOpen(false); setAspectOpen(false); }}
              className="w-9 h-9 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface flex items-center justify-center shrink-0 transition-all"
              title="Attach references & presets"
            >
              <Plus className={`w-5 h-5 transition-transform duration-200 ${toolsOpen ? 'rotate-45' : ''}`} />
            </button>
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want to imagine with SDXL..."
                rows={1}
                className="w-full bg-transparent text-body-lg text-on-surface placeholder:text-outline resize-none py-1.5 focus:outline-none max-h-36 overflow-y-auto select-text"
              />
            </div>
            {isGenerating ? (
              <button
                onClick={onInterrupt}
                className="w-9 h-9 rounded-full bg-[#ffb4ab] text-[#690005] flex items-center justify-center shrink-0 shadow-lg"
                title="Interrupt"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={onGenerate}
                disabled={!prompt.trim()}
                className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 hover:bg-primary-fixed-dim shadow-lg disabled:opacity-40 transition-colors"
                title="Queue inference (⌘Enter)"
              >
                <ArrowUp className="w-[18px] h-[18px]" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1 pt-1 px-1">
            <div className="flex flex-wrap items-center gap-1">
              <div className="relative">
                <button
                  onClick={() => { setModelOpen((v) => !v); setAspectOpen(false); setToolsOpen(false); }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono text-mono-data transition-colors"
                >
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <span>{shortModel(selectedModel) || 'SDXL Base 1.0'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-outline" />
                </button>
                {modelOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-64 bg-surface-container-high rounded-xl p-1 shadow-2xl z-40">
                    <div className="px-2 py-1 text-outline font-mono text-label-caps uppercase tracking-wider">
                      Generative Checkpoint
                    </div>
                    {(models.length ? models : [{ name: selectedModel || 'sd_xl_base_1.0.safetensors', type: 'sdxl', size_gb: 6.46, path: '' }]).map((m) => (
                      <button
                        key={m.name}
                        onClick={() => { setSelectedModel(m.name); setModelOpen(false); }}
                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface-bright text-on-surface font-mono text-mono-data flex items-center justify-between"
                      >
                        <span>{shortModel(m.name)}</span>
                        <span className={m.name === selectedModel ? 'text-tertiary' : 'text-outline'}>
                          {m.name === selectedModel ? 'Active' : m.type.toUpperCase()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => { setAspectOpen((v) => !v); setModelOpen(false); setToolsOpen(false); }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono text-mono-data transition-colors"
                >
                  <span>{activeAspect.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-outline" />
                </button>
                {aspectOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-56 bg-surface-container-high rounded-xl p-1 shadow-2xl z-40">
                    <div className="px-2 py-1 text-outline font-mono text-label-caps uppercase tracking-wider">
                      Dimensions Preset
                    </div>
                    {ASPECT_RATIOS.map((ar) => (
                      <button
                        key={ar.label}
                        onClick={() => { setDimensions(ar.w, ar.h); setAspectOpen(false); }}
                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface-bright text-on-surface font-mono text-mono-data flex items-center justify-between"
                      >
                        <span>{ar.label}</span>
                        <span className="text-outline">{ar.sub}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedStyles.map((style) => (
                <div
                  key={style}
                  className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-surface-container font-mono text-mono-data text-on-surface-variant"
                >
                  <span>{style}</span>
                  <button onClick={() => onRemoveStyle(style)} className="hover:text-on-surface ml-1 text-outline">
                    <X className="w-[13px] h-[13px]" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={onOpenAdvanced}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface font-mono text-label-caps uppercase tracking-wider transition-colors"
              title="Sampling & Inference Latent Parameters"
            >
              <SlidersHorizontal className="w-[15px] h-[15px] text-primary" />
              <span className="hidden md:inline">Advanced Parameters</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
