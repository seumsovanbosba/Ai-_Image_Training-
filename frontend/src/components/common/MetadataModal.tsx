import React from 'react';
import { X, Copy, Check, Info } from 'lucide-react';
import { ImageAsset } from '../../types';

interface MetadataModalProps {
  image: ImageAsset | null;
  onClose: () => void;
  onCopyPrompt: (text: string) => void;
  copied: boolean;
}

export const MetadataModal: React.FC<MetadataModalProps> = ({
  image,
  onClose,
  onCopyPrompt,
  copied,
}) => {
  if (!image) return null;

  const metadataJson = JSON.stringify({
    filename: image.filename,
    prompt: image.prompt,
    negative_prompt: image.negative_prompt,
    styles: image.styles_applied,
    model: image.model_name,
    dimensions: `${image.width}x${image.height}`,
    steps: image.steps,
    cfg_scale: image.cfg_scale,
    sampler: image.sampler,
    scheduler: image.scheduler,
    seed: image.seed,
    created_at: image.created_at,
  }, null, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-panel border border-surface-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-subpanel/50">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-brand-400" />
            <span className="font-semibold text-slate-100 uppercase tracking-wide">Image Metadata Inspector</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-[10px] text-slate-500 uppercase">Conditioning Prompt</label>
            <div className="p-2.5 rounded bg-surface-base border border-surface-border text-slate-200 mt-1 select-text">
              {image.prompt}
            </div>
          </div>

          {image.negative_prompt && (
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Negative Prompt</label>
              <div className="p-2.5 rounded bg-surface-base border border-surface-border text-slate-400 mt-1 select-text">
                {image.negative_prompt}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-surface-base border border-surface-border">
              <span className="text-slate-500 block text-[10px]">Model</span>
              <span className="text-slate-200 truncate block">{image.model_name}</span>
            </div>
            <div className="p-2 rounded bg-surface-base border border-surface-border">
              <span className="text-slate-500 block text-[10px]">Resolution</span>
              <span className="text-brand-400">{image.width} × {image.height}</span>
            </div>
            <div className="p-2 rounded bg-surface-base border border-surface-border">
              <span className="text-slate-500 block text-[10px]">Steps / CFG</span>
              <span className="text-slate-200">{image.steps} / {image.cfg_scale}</span>
            </div>
            <div className="p-2 rounded bg-surface-base border border-surface-border">
              <span className="text-slate-500 block text-[10px]">Sampler / Scheduler</span>
              <span className="text-slate-200">{image.sampler} / {image.scheduler}</span>
            </div>
            <div className="p-2 rounded bg-surface-base border border-surface-border col-span-2">
              <span className="text-slate-500 block text-[10px]">Seed</span>
              <span className="text-slate-200">{image.seed}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-surface-border bg-surface-subpanel/50 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">{image.filename}</span>
          <button
            onClick={() => onCopyPrompt(metadataJson)}
            className="px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium flex items-center space-x-1.5 transition shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy All JSON'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
