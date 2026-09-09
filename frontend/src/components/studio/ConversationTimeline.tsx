import React, { useEffect, useRef } from 'react';
import {
  Sparkles, User, Zap, Maximize2, BarChart3, Monitor, Paintbrush,
  Palette, GitBranch, Copy, Download, Check, Loader2, Scan, Columns2, ImagePlus
} from 'lucide-react';
import { ChatTurn, ImageAsset } from '../../types';

const SAMPLER_LABEL: Record<string, string> = {
  dpmpp_2m: 'DPM++ 2M',
  dpmpp_2m_sde: 'DPM++ 2M SDE',
  euler: 'Euler',
  euler_ancestral: 'Euler Ancestral',
  uni_pc: 'UniPC',
  heun: 'Heun',
  dpm_2: 'DPM 2',
  ddim: 'DDIM',
};

interface ConversationTimelineProps {
  turns: ChatTurn[];
  copiedId: string | null;
  onCopyPrompt: (prompt: string, id: string) => void;
  onDownload: (image: ImageAsset) => void;
  onInpaint: (imageUrl: string) => void;
  onOpenCanvas: (imageUrl: string) => void;
  onOpenDag: () => void;
  onOpenMetadata: (image: ImageAsset) => void;
  onFullscreen: (image: ImageAsset) => void;
  onVary: (image: ImageAsset) => void;
  onUpscale: (image: ImageAsset) => void;
  onUseAsReference: (image: ImageAsset) => void;
}

const formatTime = (iso: string) => {
  if (!iso) return 'Just now';
  let s = iso.trim();
  if (!s.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return 'Just now';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const shortModel = (name?: string) => {
  if (!name) return 'SDXL Base 1.0';
  return name
    .replace(/\.safetensors$/i, '')
    .replace(/sd[_-]?xl/gi, 'SDXL')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const ConversationTimeline: React.FC<ConversationTimelineProps> = ({
  turns,
  copiedId,
  onCopyPrompt,
  onDownload,
  onInpaint,
  onOpenCanvas,
  onOpenDag,
  onOpenMetadata,
  onFullscreen,
  onVary,
  onUpscale,
  onUseAsReference,
}) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, turns[turns.length - 1]?.progress?.current_step]);

  return (
    <div className="flex-1 w-full relative z-10 overflow-x-hidden min-h-0 flex flex-col">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[780px] h-[380px] bg-primary/5 rounded-full blur-[140px] opacity-70" />
        <div className="absolute bottom-12 left-1/3 w-[460px] h-[240px] bg-secondary-container/10 rounded-full blur-[120px] opacity-40" />
      </div>
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col pb-44 overflow-y-auto">
        <div className="pt-8 pb-6 flex flex-col items-center text-center">
          <h1 className="text-display-hero text-on-surface tracking-tight max-w-2xl font-semibold">
            What shall we materialize today?
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-1 max-w-xl">
            Iterative latent diffusion workspace with dynamic prompt interpolation and high-fidelity rendering.
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-6">
          {turns.map((turn) => (
            <React.Fragment key={turn.id}>
              <div className="flex items-start gap-3 max-w-3xl ml-auto">
                <div className="flex flex-col items-end gap-1">
                  <div className="bg-surface-container-high text-on-surface px-6 py-3 rounded-2xl rounded-tr-sm shadow-md">
                    <p className="text-body-lg text-on-surface select-text">{turn.prompt}</p>
                  </div>
                  <div className="flex items-center gap-1 text-outline font-mono text-mono-data pr-1">
                    <span>{formatTime(turn.createdAt)}</span>
                    <span>·</span>
                    <button
                      className="text-primary hover:underline"
                      onClick={() => onCopyPrompt(turn.prompt, turn.id)}
                    >
                      {copiedId === turn.id ? 'Copied' : 'Copy prompt'}
                    </button>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 shadow-sm">
                  <User className="w-[18px] h-[18px]" />
                </div>
              </div>

              <div className="flex items-start gap-3 max-w-4xl mr-auto w-full">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest text-primary flex items-center justify-center shrink-0 mt-1 shadow-sm">
                  <Sparkles className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 flex flex-col gap-3 min-w-0">
                  <ResultCard
                    turn={turn}
                    copiedId={copiedId}
                    onCopyPrompt={onCopyPrompt}
                    onDownload={onDownload}
                    onInpaint={onInpaint}
                    onOpenCanvas={onOpenCanvas}
                    onOpenDag={onOpenDag}
                    onOpenMetadata={onOpenMetadata}
                    onFullscreen={onFullscreen}
                    onVary={onVary}
                    onUpscale={onUpscale}
                    onUseAsReference={onUseAsReference}
                  />
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
};

const ResultCard: React.FC<{
  turn: ChatTurn;
  copiedId: string | null;
  onCopyPrompt: (prompt: string, id: string) => void;
  onDownload: (image: ImageAsset) => void;
  onInpaint: (imageUrl: string) => void;
  onOpenCanvas: (imageUrl: string) => void;
  onOpenDag: () => void;
  onOpenMetadata: (image: ImageAsset) => void;
  onFullscreen: (image: ImageAsset) => void;
  onVary: (image: ImageAsset) => void;
  onUpscale: (image: ImageAsset) => void;
  onUseAsReference: (image: ImageAsset) => void;
}> = ({
  turn, copiedId, onCopyPrompt, onDownload, onInpaint, onOpenCanvas,
  onOpenDag, onOpenMetadata, onFullscreen, onVary, onUpscale, onUseAsReference,
}) => {
  const image = turn.image;
  const preview = turn.progress?.preview_base64;
  const elapsed = turn.elapsedSeconds ?? (image ? null : null);
  const sampler = SAMPLER_LABEL[image?.sampler || ''] || image?.sampler || 'Euler Ancestral';

  return (
    <>
      <div className="w-full bg-surface-container-low rounded-2xl p-3 shadow-xl overflow-hidden group">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-on-surface-variant">
          <div className="flex flex-wrap items-center gap-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high font-mono text-mono-data text-primary">
              <Zap className="w-[13px] h-[13px]" /> {shortModel(image?.model_name)}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container font-mono text-mono-data">
              {image ? `${image.width} × ${image.height}` : '—'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container font-mono text-mono-data">
              {image?.steps ?? turn.progress?.total_steps ?? 30} Steps
              {elapsed != null ? ` · ${elapsed.toFixed(2)}s` : ''}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container font-mono text-mono-data text-tertiary">
              Seed #{image?.seed ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-0.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
              title="Full Resolution View"
              disabled={!image}
              onClick={() => image && onFullscreen(image)}
            >
              <Maximize2 className="w-[18px] h-[18px]" />
            </button>
            <button
              className="p-0.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
              title="Image Histogram & Tensors"
              disabled={!image}
              onClick={() => image && onOpenMetadata(image)}
            >
              <BarChart3 className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        <div className="relative w-full aspect-square md:aspect-[16/10] bg-surface-container-lowest rounded-xl overflow-hidden flex items-center justify-center">
          {image ? (
            <img
              src={image.url}
              alt={image.prompt}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.01]"
            />
          ) : turn.progress?.status === 'failed' || turn.progress?.type === 'failed' ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-rose-400">
              <span className="font-semibold text-sm">Generation Error</span>
              <p className="text-xs text-rose-300/80 font-mono max-w-md">
                {turn.progress?.error || 'An error occurred during generation.'}
              </p>
            </div>
          ) : preview ? (
            <img src={preview} alt="Live latent preview" className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-on-surface-variant">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <span className="font-mono text-mono-data">
                {turn.generating
                  ? `Sampling latents (${turn.progress?.current_step ?? 0}/${turn.progress?.total_steps ?? 30})`
                  : 'Waiting for canvas…'}
              </span>
            </div>
          )}

          <div className="absolute top-3 left-3 bg-surface-dim/75 backdrop-blur-md px-3 py-1 rounded-xl shadow-md flex items-center gap-2 text-on-surface">
            <span className={`w-2 h-2 rounded-full ${turn.generating ? 'bg-amber-400 animate-pulse' : 'bg-primary animate-pulse'}`} />
            <span className="font-mono text-label-caps tracking-wider uppercase">
              {turn.generating ? 'Latent Canvas Sampling' : 'Latent Canvas Synchronized'}
            </span>
          </div>

          {image && (
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 bg-surface-dim/80 backdrop-blur-md p-1 rounded-xl shadow-lg">
              <button
                onClick={() => onFullscreen(image)}
                className="px-2 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono text-label-caps uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                <Scan className="w-3.5 h-3.5" /> Inspect Tiles
              </button>
              <button
                onClick={() => onOpenMetadata(image)}
                className="px-2 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono text-label-caps uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                <Columns2 className="w-3.5 h-3.5" /> Compare Pre-Pass
              </button>
            </div>
          )}

          {turn.generating && (
            <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-md px-4 py-2.5 rounded-md border border-white/10 font-mono text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-on-surface">
                <span>Sampling Step {turn.progress?.current_step || 0}/{turn.progress?.total_steps || 30}</span>
                <span className="text-primary font-bold">{(turn.progress?.progress || 0).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-primary-container to-primary h-full rounded-full transition-all duration-200"
                  style={{ width: `${turn.progress?.progress || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 pt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <button
              disabled={!image}
              onClick={() => image && onUpscale(image)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-body-md transition-colors shadow-sm disabled:opacity-40"
            >
              <Monitor className="w-4 h-4 text-primary" />
              <span>Upscale 2x</span>
            </button>
            <button
              disabled={!image}
              onClick={() => image && onInpaint(image.url)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-body-md transition-colors shadow-sm disabled:opacity-40"
            >
              <Paintbrush className="w-4 h-4 text-tertiary" />
              <span>Inpaint</span>
            </button>
            <button
              disabled={!image}
              onClick={() => image && onOpenCanvas(image.url)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-body-md transition-colors shadow-sm disabled:opacity-40"
            >
              <Palette className="w-4 h-4 text-secondary" />
              <span>Open in Canvas</span>
            </button>
            <button
              disabled={!image}
              onClick={() => image && onVary(image)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-body-md transition-colors shadow-sm disabled:opacity-40"
            >
              <GitBranch className="w-4 h-4 text-outline" />
              <span>Vary Subtle</span>
            </button>
            <button
              disabled={!image}
              onClick={() => image && onUseAsReference(image)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-body-md transition-colors shadow-sm disabled:opacity-40"
            >
              <ImagePlus className="w-4 h-4 text-primary" />
              <span>Use as Reference</span>
            </button>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => onCopyPrompt(turn.prompt, turn.id)}
              className="p-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
              title="Copy Prompt"
            >
              {copiedId === turn.id ? <Check className="w-[18px] h-[18px] text-tertiary" /> : <Copy className="w-[18px] h-[18px]" />}
            </button>
            <button
              disabled={!image}
              onClick={() => image && onDownload(image)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-on-primary text-body-md font-medium hover:bg-primary-fixed-dim transition-colors shadow-sm disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-2 text-outline font-mono text-mono-data">
        <span className="flex items-center gap-1">
          {turn.generating ? (
            <Loader2 className="w-[13px] h-[13px] text-primary animate-spin" />
          ) : (
            <Check className="w-[13px] h-[13px] text-tertiary" />
          )}
          {turn.generating ? 'Diffusion in progress' : 'Diffusion complete'}
        </span>
        <span>·</span>
        <span>Sampling: {sampler} / {image?.scheduler || 'Karras'}</span>
        <span>·</span>
        <span>Clip Skip: 2</span>
        <span>·</span>
        <button className="text-primary hover:underline" onClick={onOpenDag}>
          View node graph trace
        </button>
      </div>
    </>
  );
};
