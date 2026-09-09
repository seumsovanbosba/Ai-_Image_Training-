import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { ImageAsset, ImageReference } from '../../types';

interface ImageReferenceModalProps {
  images: ImageAsset[];
  onClose: () => void;
  onSelect: (ref: ImageReference) => void;
}

export const ImageReferenceModal: React.FC<ImageReferenceModalProps> = ({
  images,
  onClose,
  onSelect,
}) => {
  const [tab, setTab] = useState<'upload' | 'gallery'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        onSelect({
          dataUrl,
          name: file.name,
          fidelity: 0.65,
          width: img.naturalWidth || 1024,
          height: img.naturalHeight || 1024,
        });
        onClose();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectGalleryImage = (img: ImageAsset) => {
    onSelect({
      dataUrl: img.url,
      name: img.filename,
      fidelity: 0.65,
      width: img.width,
      height: img.height,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-mono text-xs">
      <div className="bg-surface-panel border border-surface-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border bg-surface-subpanel/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-100 uppercase tracking-wider">
                Image-to-Image Guidance Reference
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Guide your next synthesis with an existing visual composition
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-5 pt-3 border-b border-surface-border bg-surface-base gap-2">
          <button
            onClick={() => setTab('upload')}
            className={`flex items-center space-x-2 px-3 py-2 border-b-2 text-xs font-semibold transition ${
              tab === 'upload'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
          <button
            onClick={() => setTab('gallery')}
            className={`flex items-center space-x-2 px-3 py-2 border-b-2 text-xs font-semibold transition ${
              tab === 'gallery'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Select From Gallery ({images.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto min-h-[320px]">
          {tab === 'upload' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-surface-border hover:border-brand-500/50 hover:bg-surface-subpanel/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) processFile(e.target.files[0]);
                }}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-surface-card border border-surface-border flex items-center justify-center text-brand-400 mb-3 shadow-md">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium text-slate-200 mb-1">
                Drop your reference image here, or <span className="text-brand-400 underline">browse</span>
              </p>
              <p className="text-[10px] text-slate-500 font-sans">
                Supports PNG, JPEG, WEBP • Automatically encoded into SDXL latent space
              </p>
            </div>
          ) : (
            <div>
              {images.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-500">
                  <ImageIcon className="w-8 h-8 opacity-30 mb-2" />
                  <p>No past generations available</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => handleSelectGalleryImage(img)}
                      className="group relative rounded-lg border border-surface-border bg-surface-card overflow-hidden aspect-square cursor-pointer hover:border-brand-500 hover:ring-2 hover:ring-brand-500/30 transition-all shadow-sm"
                    >
                      <img
                        src={img.url}
                        alt={img.prompt}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                        <span className="text-[9px] text-slate-300 font-mono">
                          {img.width}×{img.height}
                        </span>
                        <div className="flex items-center justify-center">
                          <span className="px-2 py-1 rounded bg-brand-600 text-white text-[10px] font-medium flex items-center space-x-1 shadow">
                            <Check className="w-3 h-3" />
                            <span>Select</span>
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-300 line-clamp-1 font-sans">
                          {img.prompt}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
