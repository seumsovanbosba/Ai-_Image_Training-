import React, { useState } from 'react';
import { ImageAsset, Board } from '../../types';
import { 
  X, Download, Copy, Trash2, Send, FolderPlus, 
  Sparkles, Check, Info, Calendar, Layers 
} from 'lucide-react';

interface ImageDetailModalProps {
  image: ImageAsset;
  boards: Board[];
  onClose: () => void;
  onSendToCanvas: (imageUrl: string) => void;
  onReuseSettings: (image: ImageAsset) => void;
  onDelete: (imageId: number) => void;
  onAssignBoard: (imageId: number, boardId: number | null) => void;
}

export const ImageDetailModal: React.FC<ImageDetailModalProps> = ({
  image,
  boards,
  onClose,
  onSendToCanvas,
  onReuseSettings,
  onDelete,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row shadow-2xl overflow-hidden">
        {/* Left: Full-size Image Preview */}
        <div className="flex-1 bg-[#090d16] flex items-center justify-center p-4 relative overflow-hidden min-h-[360px]">
          <img
            src={image.url}
            alt={image.prompt}
            className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl"
          />
        </div>

        {/* Right: Metadata Inspector & Workflow Actions */}
        <div className="w-full md:w-96 flex flex-col border-t md:border-t-0 md:border-l border-slate-800 bg-[#131b2c] p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Info className="w-4 h-4 text-indigo-400" />
              <span>Generation Metadata</span>
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Prompt Section */}
          <div className="py-4 space-y-3 flex-1">
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                <span>Positive Prompt</span>
                <button
                  onClick={copyPrompt}
                  className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 transition"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-200 bg-[#0c1220] p-3 rounded-xl border border-slate-800 leading-relaxed font-sans select-text">
                {image.prompt}
              </p>
            </div>

            {image.negative_prompt && (
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">Negative Prompt</span>
                <p className="text-xs text-slate-400 bg-[#0c1220] p-2.5 rounded-xl border border-slate-800 line-clamp-3 select-text">
                  {image.negative_prompt}
                </p>
              </div>
            )}

            {/* Parameter Badges */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[#0c1220] p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Model</span>
                <span className="font-semibold text-slate-200 truncate block">{image.model_name}</span>
              </div>
              <div className="bg-[#0c1220] p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Resolution</span>
                <span className="font-mono text-slate-200">{image.width} × {image.height}</span>
              </div>
              <div className="bg-[#0c1220] p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Steps & CFG</span>
                <span className="font-mono text-slate-200">{image.steps} steps / CFG {image.cfg_scale}</span>
              </div>
              <div className="bg-[#0c1220] p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Seed</span>
                <span className="font-mono text-indigo-400">{image.seed}</span>
              </div>
              <div className="bg-[#0c1220] p-2.5 rounded-xl border border-slate-800 col-span-2">
                <span className="text-slate-500 block text-[10px]">Sampler & Scheduler</span>
                <span className="font-mono text-slate-300">{image.sampler} ({image.scheduler})</span>
              </div>
            </div>

            {/* Board Selector */}
            <div className="pt-2">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Assign to Board</label>
              <select
                value={image.board_id ?? ''}
                onChange={(e) => onAssignBoard(image.id, e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-[#0c1220] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">No Board (Unassigned)</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    📁 {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <button
              onClick={() => {
                onSendToCanvas(image.url);
                onClose();
              }}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition"
            >
              <Send className="w-4 h-4" />
              <span>Send to Inpaint Canvas</span>
            </button>

            <button
              onClick={() => {
                onReuseSettings(image);
                onClose();
              }}
              className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Reuse Prompt & Seed</span>
            </button>

            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save File</span>
              </button>
              <button
                onClick={() => {
                  onDelete(image.id);
                  onClose();
                }}
                className="p-2 rounded-xl text-rose-400 hover:bg-rose-950/40 border border-rose-900/40 transition"
                title="Delete Image"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
