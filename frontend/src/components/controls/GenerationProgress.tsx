import React from 'react';
import { TaskProgress } from '../../types';
import { Loader2, Sparkles, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface GenerationProgressProps {
  progress: TaskProgress | null;
  isGenerating: boolean;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  progress,
  isGenerating,
}) => {
  if (!isGenerating && !progress) return null;

  const pct = Math.min(100, Math.max(0, progress?.progress ?? 0));
  const currentStep = progress?.current_step ?? 0;
  const totalSteps = progress?.total_steps ?? 30;
  const isComplete = progress?.status === 'completed';
  const isFailed = progress?.status === 'failed';

  return (
    <div className="bg-[#111726] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 animate-fadeIn">
      {/* Header & Status Pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {isGenerating ? (
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
          ) : isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : isFailed ? (
            <XCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <Sparkles className="w-4 h-4 text-slate-400" />
          )}
          <span className="text-xs font-bold text-slate-200">
            {isGenerating
              ? `Sampling Latents (Step ${currentStep}/${totalSteps})`
              : isComplete
              ? 'Generation Finished'
              : 'Idle'}
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-indigo-400">{pct.toFixed(1)}%</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
        <div
          className={`h-full transition-all duration-200 rounded-full ${
            isComplete
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-indigo-600 via-indigo-400 to-indigo-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Live Preview Latent Frame */}
      {progress?.preview_base64 && isGenerating && (
        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black/60 max-h-56 flex items-center justify-center">
          <img
            src={progress.preview_base64}
            alt="Live Latent Preview"
            className="w-full h-full object-contain filter blur-[0.5px] transition-all"
          />
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] text-indigo-300 font-mono">
            Live Preview
          </div>
        </div>
      )}
    </div>
  );
};
