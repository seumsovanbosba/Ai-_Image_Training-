import React from 'react';
import { SlidersHorizontal, X, RotateCcw, Share2, ExternalLink, Filter } from 'lucide-react';
import { Board } from '../../types';

export const SAMPLERS = [
  { value: 'dpmpp_2m', label: 'DPM++ 2M' },
  { value: 'euler_ancestral', label: 'Euler Ancestral' },
  { value: 'ddim', label: 'DDIM Linear' },
  { value: 'heun', label: 'Heun Karras' },
  { value: 'uni_pc', label: 'UniPC 2' },
  { value: 'dpmpp_2m_sde', label: 'DPM++ 2M SDE' },
  { value: 'euler', label: 'Euler' },
  { value: 'dpm_2', label: 'DPM 2' },
];

export const SCHEDULERS = [
  { value: 'karras', label: 'Karras' },
  { value: 'exponential', label: 'Exponential' },
  { value: 'simple', label: 'Simple' },
  { value: 'sgm_uniform', label: 'SGM Uniform' },
  { value: 'normal', label: 'Normal' },
];

interface AdvancedDrawerProps {
  open: boolean;
  onClose: () => void;
  steps: number;
  setSteps: (n: number) => void;
  cfgScale: number;
  setCfgScale: (n: number) => void;
  sampler: string;
  setSampler: (s: string) => void;
  scheduler: string;
  setScheduler: (s: string) => void;
  seed: number;
  setSeed: (n: number) => void;
  denoise: number;
  setDenoise: (n: number) => void;
  showDenoise: boolean;
  boards: Board[];
  selectedBoardId: number | null;
  setSelectedBoardId: (id: number | null) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  onOpenDag: () => void;
}

export const AdvancedDrawer: React.FC<AdvancedDrawerProps> = ({
  open,
  onClose,
  steps,
  setSteps,
  cfgScale,
  setCfgScale,
  sampler,
  setSampler,
  scheduler,
  setScheduler,
  seed,
  setSeed,
  denoise,
  setDenoise,
  showDenoise,
  boards,
  selectedBoardId,
  setSelectedBoardId,
  negativePrompt,
  setNegativePrompt,
  onOpenDag,
}) => {
  const randomizeSeed = () => setSeed(Math.floor(Math.random() * 90000000) + 10000000);
  const resetDefaults = () => {
    setSteps(30);
    setCfgScale(7.0);
    setSeed(-1);
    setSampler('dpmpp_2m');
    setScheduler('karras');
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-background/60 backdrop-blur-[2px] z-40 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none hidden'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-modal-width bg-surface-container-low/95 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 transform transition-transform duration-300 ease-out flex flex-col p-6 overflow-y-auto ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
              <SlidersHorizontal className="w-[18px] h-[18px] text-primary" />
            </div>
            <div>
              <h3 className="text-headline-md text-on-surface leading-tight">Inference Settings</h3>
              <span className="font-mono text-mono-data text-outline">Latent Denoising Pipeline v2</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-6 pt-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-body-md text-on-surface font-medium">Sampling Steps</label>
              <span className="font-mono text-mono-data text-primary px-1 py-0.5 bg-surface-container rounded">{steps} steps</span>
            </div>
            <input type="range" min={1} max={80} value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="w-full" />
            <div className="flex justify-between text-outline font-mono text-mono-data">
              <span>Fast (15)</span>
              <span>Balanced (30)</span>
              <span>Ultra-HQ (60)</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-body-md text-on-surface font-medium">CFG Scale (Prompt Adherence)</label>
              <span className="font-mono text-mono-data text-primary px-1 py-0.5 bg-surface-container rounded">{cfgScale.toFixed(1)}</span>
            </div>
            <input type="range" min={1} max={18} step={0.5} value={cfgScale} onChange={(e) => setCfgScale(Number(e.target.value))} className="w-full" />
            <div className="flex justify-between text-outline font-mono text-mono-data">
              <span>Creative (4.0)</span>
              <span>Standard (7.0)</span>
              <span>Rigid (14.0)</span>
            </div>
          </div>

          {showDenoise && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-body-md text-on-surface font-medium">Inpaint Denoise</label>
                <span className="font-mono text-mono-data text-primary px-1 py-0.5 bg-surface-container rounded">{denoise.toFixed(2)}</span>
              </div>
              <input type="range" min={0.1} max={1} step={0.05} value={denoise} onChange={(e) => setDenoise(Number(e.target.value))} className="w-full" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-body-md text-on-surface font-medium">Sampler</label>
              <select
                value={sampler}
                onChange={(e) => setSampler(e.target.value)}
                className="bg-surface-container text-on-surface font-mono text-mono-data px-3 py-2 rounded-lg focus:outline-none"
              >
                {SAMPLERS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-body-md text-on-surface font-medium">Scheduler</label>
              <select
                value={scheduler}
                onChange={(e) => setScheduler(e.target.value)}
                className="bg-surface-container text-on-surface font-mono text-mono-data px-3 py-2 rounded-lg focus:outline-none"
              >
                {SCHEDULERS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-body-md text-on-surface font-medium">Latent Generation Seed</label>
              <button onClick={randomizeSeed} className="font-mono text-mono-data text-primary hover:underline flex items-center gap-1">
                <RotateCcw className="w-[13px] h-[13px]" /> Randomize
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 bg-surface-container text-on-surface font-mono text-mono-data px-3 py-2 rounded-lg focus:outline-none"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || -1)}
              />
              <button
                className="px-3 py-2 bg-surface-container hover:bg-surface-bright font-mono text-mono-data rounded-lg text-outline transition-colors"
                onClick={() => setSeed(-1)}
              >
                -1 (Random)
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-body-md text-on-surface font-medium">Destination Board</label>
            <select
              value={selectedBoardId || ''}
              onChange={(e) => setSelectedBoardId(e.target.value ? Number(e.target.value) : null)}
              className="bg-surface-container text-on-surface font-mono text-mono-data px-3 py-2 rounded-lg focus:outline-none"
            >
              <option value="">Unassigned (Working Memory)</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.image_count})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-body-md text-on-surface font-medium flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-tertiary" />
                Negative Prompt Filter
              </label>
              <span className="font-mono text-mono-data text-outline">
                {negativePrompt.split(',').filter(Boolean).length} heuristics
              </span>
            </div>
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="low quality, artifacts, blurry…"
              className="w-full h-24 bg-surface-container text-on-surface font-mono text-mono-data px-3 py-2 rounded-lg focus:outline-none resize-none select-text"
            />
          </div>

          <div className="bg-surface-container p-3 rounded-xl flex flex-col gap-3">
            <ToggleRow title="FP16 Half-Precision Engine" subtitle="Optimizes VRAM consumption & speed" defaultOn />
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-body-md text-on-surface font-medium">Clip Skip Latent Layer</span>
                <span className="font-mono text-mono-data text-outline">Skips the final CLIP transformer block</span>
              </div>
              <span className="font-mono text-mono-data text-primary px-2 py-0.5 bg-surface-container-high rounded">Layer 2</span>
            </div>
            <ToggleRow title="Enable Tiled VAE Decoding" subtitle="Prevents out-of-memory crash on 4K upscales" defaultOn />
          </div>

          <div className="p-3 rounded-xl bg-surface-container-high/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-secondary" />
              <div className="flex flex-col">
                <span className="text-body-md text-on-surface font-medium">Open DAG Node Graph</span>
                <span className="font-mono text-mono-data text-outline">Visualize diffusion tensors</span>
              </div>
            </div>
            <button onClick={onOpenDag} className="p-0.5 text-outline hover:text-on-surface transition-colors">
              <ExternalLink className="w-[18px] h-[18px]" />
            </button>
          </div>

          <div className="mt-auto pt-3 flex items-center gap-2">
            <button
              onClick={resetDefaults}
              className="flex-1 py-2 px-3 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface text-body-md transition-colors"
            >
              Reset Defaults
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary text-body-md font-medium transition-colors"
            >
              Apply Settings
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const ToggleRow: React.FC<{ title: string; subtitle: string; defaultOn?: boolean }> = ({ title, subtitle, defaultOn }) => (
  <div className="flex items-center justify-between">
    <div className="flex flex-col">
      <span className="text-body-md text-on-surface font-medium">{title}</span>
      <span className="font-mono text-mono-data text-outline">{subtitle}</span>
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input defaultChecked={defaultOn} className="sr-only peer" type="checkbox" />
      <div className="w-10 h-5 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container" />
    </label>
  </div>
);
