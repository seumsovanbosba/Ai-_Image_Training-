import React, { useState } from 'react';
import { ImageAsset, Board } from '../../types';
import { 
  X, Download, Copy, Trash2, Send, FolderPlus, 
  Sparkles, Check, Info, Calendar, Layers, Paintbrush 
} from 'lucide-react';

interface ImageDetailModalProps {
  image: ImageAsset;
  boards: Board[];
  onClose: () => void;
  onSendToCanvas: (imageUrl: string) => void;
  onReuseSettings: (image: ImageAsset) => void;
  onDeleteImage: (imageId: number) => Promise<void>;
  onAssignBoard: (imageId: number, boardId: number | null) => Promise<void>;
}

export const ImageDetailModal: React.FC<ImageDetailModalProps> = ({
  image,
  boards,
  onClose,
  onSendToCanvas,
  onReuseSettings,
  onDeleteImage,
  onAssignBoard,
}) => {
  const [copied, setCopied] = useState(false);

  const copyPrompt = () => {
    navigator.clipboard.writeText(image.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = image.url;
    a.download = image.filename;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-mono text-xs">
      <div className="bg-surface-panel border border-surface-border rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row shadow-2xl overflow-hidden">
        {/* Left: Full-size Image Preview */}
        <div className="flex-1 bg-[#07080a] flex items-center justify-center p-4 relative overflow-hidden min-h-[360px] bg-[radial-gradient(#141822_1px,transparent_1px)] [background-size:20px_20px]">
          <img
            src={image.url}
            alt={image.prompt}
            className="max-w-full max-h-[82vh] object-contain rounded-lg border border-surface-border shadow-2xl"
          />
        </div>

        {/* Right: Metadata Inspector & Workflow Actions */}
        <div className="w-full md:w-96 flex flex-col border-t md:border-t-0 md:border-l border-surface-border bg-surface-subpanel/40 p-5 overflow-y-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-100 flex items-center space-x-2">
              <Info className="w-4 h-4 text-brand-400" />
              <span>Generation Metadata</span>
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-surface-hover text-slate-400 hover:text-slate-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSendToCanvas(image.url)}
              className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-md bg-brand-600 hover:bg-brand-500 text-white font-medium shadow-sm transition"
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Send to Inpaint</span>
            </button>
            <button
              onClick={() => onReuseSettings(image)}
              className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-md bg-surface-card hover:bg-surface-hover border border-surface-border text-slate-200 font-medium transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>Reuse Settings</span>
            </button>
          </div>

          {/* Conditioning Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase">
              <span>Prompt</span>
              <button
                onClick={copyPrompt}
                className="flex items-center space-x-1 text-brand-400 hover:text-brand-300 transition"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-2.5 rounded-md bg-surface-base border border-surface-border text-slate-200 leading-relaxed text-[11px] select-text max-h-32 overflow-y-auto">
              {image.prompt}
            </div>
          </div>

          {/* Negative Prompt */}
          {image.negative_prompt && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase">Negative Prompt</span>
              <div className="p-2.5 rounded-md bg-surface-base border border-surface-border text-slate-400 leading-relaxed text-[11px] select-text max-h-24 overflow-y-auto">
                {image.negative_prompt}
              </div>
            </div>
          )}

          {/* Core Specs Grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-surface-base border border-surface-border">
              <span className="text-[9px] text-slate-500 block uppercase">Model</span>
              <span className="text-slate-200 truncate block">{image.model_name}</span>
            </div>
            <div className="p-2 rounded bg-surface-base border border-surface-border">
              <span className="text-[9px] text-slate-500 block uppercase">Dimensions</span>
              <span className="text-brand-400">{image.width} × {image.height}</span>
            </div>
            <div className="p-2 rounded bg-surface-base border border-surface-border">
              <span className="text-[9px] text-slate-500 block uppercase">Steps / CFG</span>
              <span className="text-slate-200">{image.steps} / {image.cfg_scale}</span>
            </div>
            <div className="p-2 rounded bg-surface-base border border-surface-border">
              <span className="text-[9px] text-slate-500 block uppercase">Sampler / Curve</span>
              <span className="text-slate-200 truncate block">{image.sampler} • {image.scheduler}</span>
            </div>
            <div className="p-2 rounded bg-surface-base border border-surface-border col-span-2">
              <span className="text-[9px] text-slate-500 block uppercase">Seed</span>
              <span className="text-slate-200">{image.seed}</span>
            </div>
          </div>

          {/* Board Assignment */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-400 uppercase">Asset Board</span>
            <select
              value={image.board_id || ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                onAssignBoard(image.id, val);
              }}
              className="w-full bg-surface-base border border-surface-border rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="">Unassigned (Working Memory)</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Footer utilities */}
          <div className="pt-2 border-t border-surface-border flex items-center justify-between">
            <button
              onClick={handleDownload}
              className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 text-[11px] transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PNG</span>
            </button>

            <button
              onClick={() => onDeleteImage(image.id)}
              className="flex items-center space-x-1 text-rose-400 hover:text-rose-300 text-[11px] transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
