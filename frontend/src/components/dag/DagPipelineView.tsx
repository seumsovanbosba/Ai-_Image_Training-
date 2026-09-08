import React from 'react';
import { 
  Cpu, Layers, Sparkles, Sliders, HardDrive, 
  ArrowRight, ShieldCheck, CheckCircle2, Play 
} from 'lucide-react';
import { ModelInfo } from '../../types';

interface DagPipelineViewProps {
  selectedModel: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  sampler: string;
  scheduler: string;
  seed: number;
  prompt: string;
  negativePrompt: string;
  selectedStyles: string[];
  comfyOnline: boolean;
  isGenerating: boolean;
}

const NodeHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeClass: string;
}> = ({ icon, title, badge, badgeClass }) => (
  <div className="flex items-center gap-2 border-b border-surface-border pb-2 min-w-0">
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <span className="shrink-0">{icon}</span>
      <span className="font-mono text-[11px] font-semibold text-slate-200 whitespace-nowrap truncate" title={title}>
        {title}
      </span>
    </div>
    <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${badgeClass}`}>
      {badge}
    </span>
  </div>
);

export const DagPipelineView: React.FC<DagPipelineViewProps> = ({
  selectedModel,
  width,
  height,
  steps,
  cfgScale,
  sampler,
  scheduler,
  seed,
  prompt,
  negativePrompt,
  selectedStyles,
  comfyOnline,
  isGenerating,
}) => {
  return (
    <div className="h-full w-full bg-transparent p-6 overflow-y-auto flex flex-col space-y-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider font-mono">
              ComfyUI Headless DAG Execution Graph
            </h2>
            <span className="px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/30 text-brand-400 font-mono text-[10px]">
              SDXL In-Memory DAG
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Asynchronous JSON API graph dispatched to 127.0.0.1:8188 via WebSocket
          </p>
        </div>

        <div className="flex items-center space-x-3 font-mono text-xs">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-surface-panel border border-surface-border">
            <span className={`w-2 h-2 rounded-full ${comfyOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-slate-300">Port 8188:</span>
            <span className="text-slate-100 font-medium">{comfyOnline ? 'Connected' : 'Standalone'}</span>
          </div>
        </div>
      </div>

      {/* Nodes Flow Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Node 1: Checkpoint Loader */}
        <div className="rounded-lg border border-surface-border bg-surface-panel p-4 space-y-3">
          <NodeHeader
            icon={<HardDrive className="w-4 h-4 text-brand-400" />}
            title="1. CheckpointLoaderSimple"
            badge="Cached FP16"
            badgeClass="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          />
          <div className="space-y-1.5 font-mono text-[11px] text-slate-400">
            <div><span className="text-slate-500">ckpt_name:</span> <span className="text-slate-200 truncate block">{selectedModel || 'sd_xl_base_1.0.safetensors'}</span></div>
            <div><span className="text-slate-500">precision:</span> <span className="text-brand-400">bfloat16 / fp16</span></div>
            <div><span className="text-slate-500">offline:</span> <span className="text-emerald-400">True (HF_HUB_OFFLINE=1)</span></div>
          </div>
          <div className="pt-2 border-t border-surface-border flex justify-between text-[10px] font-mono text-slate-500">
            <span>Outputs: MODEL, CLIP, VAE</span>
            <ArrowRight className="w-3.5 h-3.5 text-brand-500" />
          </div>
        </div>

        {/* Node 2: Empty Latent */}
        <div className="rounded-lg border border-surface-border bg-surface-panel p-4 space-y-3">
          <NodeHeader
            icon={<Layers className="w-4 h-4 text-brand-400" />}
            title="2. EmptyLatentImage"
            badge="VRAM Alloc"
            badgeClass="text-brand-400 bg-brand-500/10 border-brand-500/20"
          />
          <div className="space-y-1.5 font-mono text-[11px] text-slate-400">
            <div><span className="text-slate-500">width:</span> <span className="text-slate-200">{width} px</span></div>
            <div><span className="text-slate-500">height:</span> <span className="text-slate-200">{height} px</span></div>
            <div><span className="text-slate-500">batch_size:</span> <span className="text-slate-200">1</span></div>
          </div>
          <div className="pt-2 border-t border-surface-border flex justify-between text-[10px] font-mono text-slate-500">
            <span>Output: LATENT</span>
            <ArrowRight className="w-3.5 h-3.5 text-brand-500" />
          </div>
        </div>

        {/* Node 3: Fooocus Conditioning */}
        <div className="rounded-lg border border-surface-border bg-surface-panel p-4 space-y-3">
          <NodeHeader
            icon={<Sparkles className="w-4 h-4 text-brand-400" />}
            title="3. FooocusCLIPEncode"
            badge="Rule Expansion"
            badgeClass="text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
          />
          <div className="space-y-1.5 font-mono text-[11px] text-slate-400">
            <div><span className="text-slate-500">styles:</span> <span className="text-brand-400">{selectedStyles.join(', ') || 'None'}</span></div>
            <div className="truncate"><span className="text-slate-500">prompt:</span> <span className="text-slate-200">{prompt || 'Empty prompt'}</span></div>
            <div className="truncate"><span className="text-slate-500">negative:</span> <span className="text-slate-400">{negativePrompt || 'Default heuristics'}</span></div>
          </div>
          <div className="pt-2 border-t border-surface-border flex justify-between text-[10px] font-mono text-slate-500">
            <span>Output: CONDITIONING (+/-)</span>
            <ArrowRight className="w-3.5 h-3.5 text-brand-500" />
          </div>
        </div>

        {/* Node 4: KSampler */}
        <div className="rounded-lg border border-surface-border bg-surface-panel p-4 space-y-3 lg:col-span-2">
          <NodeHeader
            icon={<Cpu className="w-4 h-4 text-brand-400" />}
            title="4. KSampler (SDXL Diffusion)"
            badge={isGenerating ? 'Active Inference' : 'Ready'}
            badgeClass={
              isGenerating
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-surface-subpanel text-slate-400 border-surface-border'
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px] text-slate-400">
            <div><span className="text-slate-500">seed:</span> <span className="text-slate-200">{seed === -1 ? 'Random' : seed}</span></div>
            <div><span className="text-slate-500">steps:</span> <span className="text-slate-200 font-semibold">{steps}</span></div>
            <div><span className="text-slate-500">cfg:</span> <span className="text-slate-200 font-semibold">{cfgScale}</span></div>
            <div><span className="text-slate-500">sampler:</span> <span className="text-slate-200">{sampler}</span></div>
            <div><span className="text-slate-500">scheduler:</span> <span className="text-slate-200">{scheduler}</span></div>
            <div><span className="text-slate-500">denoise:</span> <span className="text-slate-200">1.0</span></div>
            <div><span className="text-slate-500">preview_ws:</span> <span className="text-emerald-400">Enabled</span></div>
          </div>
        </div>

        {/* Node 5: VAE Decode & Save */}
        <div className="rounded-lg border border-surface-border bg-surface-panel p-4 space-y-3">
          <NodeHeader
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            title="5. VAEDecode & SaveImage"
            badge="Lossless PNG"
            badgeClass="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          />
          <div className="space-y-1.5 font-mono text-[11px] text-slate-400">
            <div><span className="text-slate-500">out_dir:</span> <span className="text-slate-200">/outputs/</span></div>
            <div><span className="text-slate-500">format:</span> <span className="text-slate-200">PNG + PNGinfo metadata</span></div>
            <div><span className="text-slate-500">db_sync:</span> <span className="text-emerald-400">SQLite persistence</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
