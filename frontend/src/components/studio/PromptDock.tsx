import React, { useEffect, useRef, useState } from 'react';
import {
  Plus, Zap, ChevronDown, SlidersHorizontal,
  ArrowUp, Square, ImagePlus, Filter, X, Wand2, Layers,
  Paintbrush, Palette, Info, Eraser, Check, Sparkles
} from 'lucide-react';
import { ModelInfo, LoraInfo, ImageReference } from '../../types';

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
  loras: LoraInfo[];
  selectedLora: string | null;
  setSelectedLora: (v: string | null) => void;
  loraEnabled?: boolean;
  setLoraEnabled?: (v: boolean) => void;
  loraStrength: number;
  setLoraStrength: (v: number) => void;
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
  onUploadToInpaint?: (file: File) => void;
  onOpenInpaint?: () => void;
  onEditReferenceInCanvas?: (ref: ImageReference) => void;
  onRemoveObjectFromReference?: (ref: ImageReference) => void;
  imageReference?: ImageReference | null;
  onUpdateReferenceFidelity?: (fidelity: number) => void;
  onRemoveReference?: () => void;
  autoExpand?: boolean;
  setAutoExpand?: (v: boolean) => void;
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
  loras,
  selectedLora,
  setSelectedLora,
  loraEnabled = true,
  setLoraEnabled,
  loraStrength,
  setLoraStrength,
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
  onUploadToInpaint,
  onOpenInpaint,
  onEditReferenceInCanvas,
  onRemoveObjectFromReference,
  imageReference,
  onUpdateReferenceFidelity,
  onRemoveReference,
  autoExpand = false,
  setAutoExpand,
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [loraOpen, setLoraOpen] = useState(false);
  const [aspectOpen, setAspectOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inpaintFileInputRef = useRef<HTMLInputElement>(null);

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
        setLoraOpen(false);
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

  const placeholder = isGenerating
    ? 'Generating offline via ComfyUI...'
    : imageReference
    ? 'Describe how to guide this reference image (or click "Remove Object" to erase items in canvas)...'
    : 'Describe what you want to imagine with SDXL...';

  return (
    <div
      className={`fixed bottom-0 right-0 px-4 sm:px-8 pb-6 pt-1 z-30 pointer-events-none flex flex-col items-center ${
        sidebarCollapsed ? 'left-14' : 'left-sidebar'
      }`}
    >
      <div ref={wrapRef} className="w-full max-w-dock pointer-events-auto relative">
        <input
          ref={inpaintFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && onUploadToInpaint) {
              onUploadToInpaint(f);
            }
            e.target.value = '';
          }}
        />

        {toolsOpen && (
          <div className="absolute -top-4 -translate-y-full left-0 w-80 bg-surface-container-high/95 backdrop-blur-2xl rounded-xl p-1.5 shadow-2xl z-40 border border-surface-container-highest">
            <div className="px-2 py-1 text-outline font-mono text-label-caps uppercase tracking-wider">
              Input &amp; Synthesis Tools
            </div>
            <div className="flex flex-col gap-1 mt-1">
              {onUploadToInpaint && (
                <button
                  onClick={() => { setToolsOpen(false); inpaintFileInputRef.current?.click(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-bright text-on-surface transition-colors text-left group"
                >
                  <Paintbrush className="w-[18px] h-[18px] text-tertiary group-hover:scale-110 transition-transform shrink-0" />
                  <span className="flex flex-col">
                    <span className="text-body-md font-semibold flex items-center gap-1.5">
                      Upload to Inpaint / Remove Object
                      <span className="text-[9px] px-1 py-0.2 rounded bg-tertiary/20 text-tertiary font-mono">Surgical</span>
                    </span>
                    <span className="font-mono text-mono-data text-outline">Mask unwanted items (glasses, hat) &amp; prompt replacement</span>
                  </span>
                </button>
              )}
              {onOpenInpaint && (
                <button
                  onClick={() => { setToolsOpen(false); onOpenInpaint(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-bright text-on-surface transition-colors text-left group"
                >
                  <Palette className="w-[18px] h-[18px] text-primary group-hover:scale-110 transition-transform shrink-0" />
                  <span className="flex flex-col">
                    <span className="text-body-md font-semibold">Open Inpaint Canvas</span>
                    <span className="font-mono text-mono-data text-outline">Full canvas with object removal presets &amp; feathering</span>
                  </span>
                </button>
              )}
              <button
                onClick={() => { setToolsOpen(false); onAttachImage?.(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-bright text-on-surface transition-colors text-left group"
              >
                <ImagePlus className="w-[18px] h-[18px] text-primary group-hover:scale-110 transition-transform shrink-0" />
                <span className="flex flex-col">
                  <span className="text-body-md font-semibold flex items-center gap-1.5">
                    Image-to-Image Reference
                    <span className="text-[9px] px-1 py-0.2 rounded bg-primary/20 text-primary font-mono">Composition</span>
                  </span>
                  <span className="font-mono text-mono-data text-outline">Guide overall composition &amp; style (not for object removal)</span>
                </span>
              </button>
              <button
                onClick={() => { setToolsOpen(false); onOpenStyles(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-bright text-on-surface transition-colors text-left"
              >
                <SlidersHorizontal className="w-[18px] h-[18px] text-secondary shrink-0" />
                <span className="flex flex-col">
                  <span className="text-body-md">Add Style Preset</span>
                  <span className="font-mono text-mono-data text-outline">Brutalism, Film Grain, Macro, etc.</span>
                </span>
              </button>
              <button
                onClick={() => { setToolsOpen(false); onOpenNegative(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-bright text-on-surface transition-colors text-left"
              >
                <Filter className="w-[18px] h-[18px] text-tertiary shrink-0" />
                <span className="flex flex-col">
                  <span className="text-body-md">Negative Prompt Filter</span>
                  <span className="font-mono text-mono-data text-outline">Prune artifacts, oversaturation</span>
                </span>
              </button>
              <button
                onClick={() => { setAutoExpand?.(!autoExpand); setToolsOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-bright text-on-surface transition-colors text-left"
              >
                <Wand2 className={`w-[18px] h-[18px] shrink-0 ${autoExpand ? 'text-amber-400' : 'text-outline'}`} />
                <span className="flex flex-col">
                  <span className="text-body-md flex items-center gap-1.5">
                    Fooocus Auto-Expand
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${autoExpand ? 'bg-amber-500/20 text-amber-300' : 'bg-surface-container text-outline'}`}>
                      {autoExpand ? 'ON' : 'OFF'}
                    </span>
                  </span>
                  <span className="font-mono text-mono-data text-outline">
                    {autoExpand ? 'Enriching with lighting & details' : 'Using raw prompt without additions'}
                  </span>
                </span>
              </button>
            </div>
          </div>
        )}


        <div className="bg-surface-container/95 backdrop-blur-2xl rounded-2xl shadow-dock p-2 flex flex-col gap-1 transition-shadow duration-300 focus-within:shadow-dockFocus">
          
          {/* Mode Header & Active Workflow Distinction */}
          <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-mono text-outline border-b border-surface-container-highest/60 mb-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-slate-400">Mode:</span>
              {imageReference ? (
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <Sparkles className="w-3 h-3" />
                  <span>2. Img2Img (Composition Reference)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-200 font-semibold">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>1. Generate (Text-to-Image)</span>
                </span>
              )}
              {selectedLora && (
                <span className={`px-1.5 py-0.2 rounded text-[9px] ${loraEnabled ? 'bg-primary/20 text-primary font-bold' : 'bg-surface-container text-outline line-through'}`}>
                  4. LoRA: {shortModel(selectedLora)} ({loraEnabled ? `${(loraStrength).toFixed(2)}x` : 'Bypassed'})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onOpenInpaint && (
                <button
                  type="button"
                  onClick={onOpenInpaint}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition hover:underline cursor-pointer"
                  title="Switch to 3. Inpaint / Remove Object Canvas for precise localized edits (glasses, hats, clutter)"
                >
                  <Eraser className="w-3 h-3" />
                  <span>3. Inpaint / Remove Object</span>
                </button>
              )}
            </div>
          </div>

          {imageReference && (
            <div className="flex items-center justify-between px-3 py-1.5 mb-0.5 rounded-xl bg-surface-container-high/90 border border-primary/30 text-on-surface text-xs font-mono">
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-primary/50 shrink-0 bg-black">
                  <img src={imageReference.dataUrl} alt="Ref" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-primary font-semibold text-[11px] truncate max-w-[150px]">
                    {imageReference.name}
                  </span>
                  <span className="text-[9px] text-outline font-sans">
                    Img2Img Reference (Guides overall composition) &bull; For precise object removal, use <strong className="text-slate-300">Remove Object</strong> below (Inpaint Canvas).
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onEditReferenceInCanvas ? onEditReferenceInCanvas(imageReference) : onOpenInpaint?.()}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-highest hover:bg-surface-bright text-on-surface text-[10px] font-semibold transition border border-outline-variant/30 active:scale-95"
                  title="Open this reference image in Inpaint Canvas for general localized editing and touch-ups"
                >
                  <Paintbrush className="w-3 h-3 text-tertiary" />
                  <span>Edit Reference</span>
                </button>

                <button
                  onClick={() => onRemoveObjectFromReference ? onRemoveObjectFromReference(imageReference) : (onEditReferenceInCanvas ? onEditReferenceInCanvas(imageReference) : onOpenInpaint?.())}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary text-[10px] font-semibold transition shadow-sm active:scale-95"
                  title="Surgically remove glasses, hats, or unwanted objects using Inpaint Canvas with high denoise (0.85). Normal Img2Img cannot do precise object removal."
                >
                  <Eraser className="w-3 h-3" />
                  <span>Remove Object</span>
                </button>

                <div className="flex items-center gap-1.5" title="Image Fidelity: Higher stays closer to original composition, lower allows more creative freedom">
                  <span className="text-[10px] text-outline">Fidelity:</span>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={Math.round((imageReference.fidelity ?? 0.65) * 100)}
                    onChange={(e) => onUpdateReferenceFidelity?.(Number(e.target.value) / 100)}
                    className="w-16 h-1 accent-primary cursor-pointer"
                  />
                  <span className="text-[11px] text-primary font-bold w-7 text-right">
                    {Math.round((imageReference.fidelity ?? 0.65) * 100)}%
                  </span>
                </div>

                <button
                  onClick={onRemoveReference}
                  className="p-1 rounded-md hover:bg-surface-bright text-outline hover:text-rose-400 transition"
                  title="Remove reference image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 px-1">
            <button
              onClick={() => { setToolsOpen((v) => !v); setModelOpen(false); setAspectOpen(false); setLoraOpen(false); }}
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
                placeholder={placeholder}
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
                  onClick={() => { setModelOpen((v) => !v); setAspectOpen(false); setToolsOpen(false); setLoraOpen(false); }}
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

              <div className="relative flex items-center">
                <div className="flex items-center rounded-lg overflow-hidden border border-surface-border">
                  <button
                    onClick={() => { setLoraOpen((v) => !v); setModelOpen(false); setAspectOpen(false); setToolsOpen(false); }}
                    className={`flex items-center gap-1.5 px-2 py-1 font-mono text-mono-data transition-colors ${
                      selectedLora
                        ? loraEnabled
                          ? 'bg-primary/15 text-primary'
                          : 'bg-surface-container-high text-outline'
                        : 'bg-surface-container-high hover:bg-surface-bright text-on-surface'
                    }`}
                    title={
                      selectedLora
                        ? `LoRA: ${selectedLora} (${loraEnabled ? 'Active' : 'Bypassed'}). Click to change.`
                        : 'Select a LoRA concept add-on. Loaded on top of SDXL base model.'
                    }
                  >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[110px]">
                      {selectedLora
                        ? (loraEnabled ? shortModel(selectedLora) : `${shortModel(selectedLora)} (Off)`)
                        : 'LoRA off'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-outline shrink-0" />
                  </button>

                  {selectedLora && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLoraEnabled?.(!loraEnabled);
                      }}
                      className={`px-1.5 py-1 text-[10px] font-mono font-bold border-l border-surface-border transition-colors ${
                        loraEnabled
                          ? 'bg-primary text-on-primary hover:bg-primary-fixed-dim'
                          : 'bg-surface-container-high text-outline hover:text-white'
                      }`}
                      title={
                        loraEnabled
                          ? 'LoRA Enabled: Generating with Base + LoRA. Click to bypass for comparison with pure Base model.'
                          : 'LoRA Disabled: Generating with pure Base model. Click to enable LoRA.'
                      }
                    >
                      {loraEnabled ? 'ON' : 'OFF'}
                    </button>
                  )}
                </div>

                {loraOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-80 bg-surface-container-high/95 backdrop-blur-2xl rounded-xl p-1.5 shadow-2xl z-40 border border-surface-container-highest">
                    {/* Educational Header explaining the real purpose of LoRA */}
                    <div className="p-2.5 rounded-lg bg-surface-container mb-1.5 text-slate-300 font-sans border border-outline-variant/30 space-y-1">
                      <div className="font-semibold text-primary text-xs flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>LoRA: Lightweight Fine-Tuning Add-On</span>
                      </div>
                      <p className="text-[10px] text-outline leading-tight">
                        <strong>SDXL Base Model</strong> = General knowledge and image generation.
                        <br />
                        <strong>LoRA</strong> = Small learned modification teaching a specific character, style, or subject via <code>LoraLoader</code>.
                        <br />
                        <span className="text-amber-300/90 font-medium">Not an image editor:</span> LoRA generates learned concepts. To remove objects from an existing photo, use the Inpaint Canvas.
                      </p>
                    </div>

                    {/* Enable / Disable switch for easy comparison */}
                    {selectedLora && (
                      <div className="px-2 py-1.5 mb-1 bg-surface-container rounded-lg flex items-center justify-between border border-surface-border">
                        <span className="text-on-surface font-mono text-[11px]">Compare (LoRA Status)</span>
                        <button
                          onClick={() => setLoraEnabled?.(!loraEnabled)}
                          className={`px-2.5 py-0.5 rounded text-[10px] font-semibold transition active:scale-95 ${
                            loraEnabled
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-container-high text-amber-400 border border-amber-400/40'
                          }`}
                        >
                          {loraEnabled ? 'Enabled (Base + LoRA)' : 'Disabled (Pure Base)'}
                        </button>
                      </div>
                    )}

                    <div className="px-2 py-1 text-outline font-mono text-label-caps uppercase tracking-wider flex items-center justify-between">
                      <span>Available LoRAs</span>
                      <span className="text-[9px] font-sans lowercase">models/loras/</span>
                    </div>

                    <button
                      onClick={() => { setSelectedLora(null); setLoraOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-mono text-mono-data transition ${
                        !selectedLora ? 'bg-primary/20 text-primary font-semibold' : 'hover:bg-surface-bright text-on-surface'
                      }`}
                    >
                      None (Pure Base Checkpoint)
                    </button>

                    {loras.length === 0 && (
                      <div className="px-2.5 py-2 text-outline font-mono text-mono-data text-[10px]">
                        No LoRAs found. Train with Kohya or copy .safetensors files to models/loras/.
                      </div>
                    )}

                    <div className="max-h-36 overflow-y-auto space-y-0.5">
                      {loras.map((l) => {
                        const isSelected = selectedLora === l.name;
                        return (
                          <button
                            key={l.name}
                            onClick={() => {
                              setSelectedLora(l.name);
                              setLoraEnabled?.(true);
                              setLoraOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg font-mono text-mono-data flex items-center justify-between transition ${
                              isSelected ? 'bg-primary/20 text-primary font-semibold' : 'hover:bg-surface-bright text-on-surface'
                            }`}
                          >
                            <span className="truncate pr-2">{shortModel(l.name)}</span>
                            <span className="text-outline shrink-0 text-[10px]">{l.size_mb} MB</span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedLora && (
                      <div className="px-2.5 py-2 mt-1 border-t border-surface-container flex items-center gap-2">
                        <span className="text-outline font-mono text-[10px] shrink-0">Strength</span>
                        <input
                          type="range"
                          min={10}
                          max={150}
                          step={5}
                          value={Math.round(loraStrength * 100)}
                          onChange={(e) => setLoraStrength(Number(e.target.value) / 100)}
                          className="flex-1 h-1 accent-primary cursor-pointer"
                        />
                        <span className="text-primary font-mono text-[11px] w-8 text-right font-bold">
                          {loraStrength.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => { setAspectOpen((v) => !v); setModelOpen(false); setToolsOpen(false); setLoraOpen(false); }}
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

              <button
                onClick={() => setAutoExpand?.(!autoExpand)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-mono text-mono-data transition-colors ${
                  autoExpand
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-surface-container-high hover:bg-surface-bright text-outline hover:text-on-surface'
                }`}
                title={autoExpand ? 'Fooocus Auto-Expand: ON (Enriches prompt with cinematic lighting & micro-details)' : 'Fooocus Auto-Expand: OFF (Exact prompt as entered)'}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{autoExpand ? 'Auto-Expand: ON' : 'Auto-Expand: OFF'}</span>
              </button>
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
