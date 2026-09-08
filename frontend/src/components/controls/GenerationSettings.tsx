import React from 'react';
import { 
  Sliders, Dices, Layers, Cpu, Ratio, Gauge, 
  Sparkles, Check 
} from 'lucide-react';
import { ModelInfo, ResolutionPreset, Board } from '../../types';

interface GenerationSettingsProps {
  models: ModelInfo[];
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  resolutions: ResolutionPreset[];
  width: number;
  height: number;
  setDimensions: (w: number, h: number) => void;
  steps: number;
  setSteps: (s: number) => void;
  cfgScale: number;
  setCfgScale: (cfg: number) => void;
  sampler: string;
  setSampler: (s: string) => void;
  scheduler: string;
  setScheduler: (s: string) => void;
  seed: number;
  setSeed: (s: number) => void;
  denoise: number;
  setDenoise: (d: number) => void;
  isInpaintTab: boolean;
  boards: Board[];
  selectedBoardId: number | null;
  setSelectedBoardId: (id: number | null) => void;
}

const SAMPLERS = [
  'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_sde', 'euler', 
  'euler_ancestral', 'heun', 'dpm_2', 'lms', 'ddim'
];

const SCHEDULERS = ['karras', 'normal', 'sgm_uniform', 'simple', 'exponential', 'ddim_uniform'];

export const GenerationSettings: React.FC<GenerationSettingsProps> = ({
  models,
  selectedModel,
  setSelectedModel,
  resolutions,
  width,
  height,
  setDimensions,
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
  isInpaintTab,
  boards,
  selectedBoardId,
  setSelectedBoardId,
}) => {
  const randomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 2147483647));
  };

  return (
    <div className="flex flex-col bg-[#111726] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <Sliders className="w-4 h-4 text-indigo-400" />
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Engine Settings</h3>
      </div>

      {/* Model Selection */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
          <span>Model Checkpoint</span>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
            Offline Safetensors
          </span>
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full bg-[#0a0e1a] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition font-mono"
        >
          {models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} ({m.type.toUpperCase()}) {m.size_gb > 0 ? `• ${m.size_gb}GB` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Aspect Ratio / Resolution */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
          <span>Resolution & Aspect Ratio</span>
          <span className="text-[10px] text-indigo-400 font-mono">{width} × {height}</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
          {resolutions.map((r) => {
            const isSelected = r.width === width && r.height === height;
            return (
              <button
                key={`${r.width}x${r.height}`}
                onClick={() => setDimensions(r.width, r.height)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200 shadow-sm'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span className="text-xs font-bold">{r.aspect_ratio}</span>
                <span className="text-[10px] opacity-70 font-mono">{r.width}×{r.height}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Board Destination */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-400">Save to Board</label>
        <select
          value={selectedBoardId ?? ''}
          onChange={(e) => setSelectedBoardId(e.target.value ? Number(e.target.value) : null)}
          className="w-full bg-[#0a0e1a] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
        >
          <option value="">Unassigned (All Images)</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              📁 {b.name} ({b.image_count})
            </option>
          ))}
        </select>
      </div>

      {/* Inpainting Denoise (if on canvas tab) */}
      {isInpaintTab && (
        <div className="space-y-1.5 bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-900/40">
          <div className="flex justify-between text-[11px] text-indigo-300">
            <span>Inpaint Denoise Strength</span>
            <span className="font-mono font-bold">{denoise}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={denoise}
            onChange={(e) => setDenoise(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>Subtle touch-up (0.3)</span>
            <span>Full regeneration (0.9)</span>
          </div>
        </div>
      )}

      {/* Steps & CFG Sliders */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Steps</span>
            <span className="font-mono text-slate-200 font-bold">{steps}</span>
          </div>
          <input
            type="range"
            min="10"
            max="60"
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>CFG Scale</span>
            <span className="font-mono text-slate-200 font-bold">{cfgScale}</span>
          </div>
          <input
            type="range"
            min="1"
            max="15"
            step="0.5"
            value={cfgScale}
            onChange={(e) => setCfgScale(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>
      </div>

      {/* Sampler & Scheduler */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400 uppercase">Sampler</label>
          <select
            value={sampler}
            onChange={(e) => setSampler(e.target.value)}
            className="w-full bg-[#0a0e1a] border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            {SAMPLERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400 uppercase">Scheduler</label>
          <select
            value={scheduler}
            onChange={(e) => setScheduler(e.target.value)}
            className="w-full bg-[#0a0e1a] border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            {SCHEDULERS.map((sc) => (
              <option key={sc} value={sc}>{sc}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Seed */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-400">Seed</label>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="flex-1 bg-[#0a0e1a] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={randomizeSeed}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
            title="Randomize Seed"
          >
            <Dices className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSeed(-1)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
              seed === -1
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Randomize every generation"
          >
            Auto (-1)
          </button>
        </div>
      </div>
    </div>
  );
};
