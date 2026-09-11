import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Sparkles, Check, Eraser, AlertCircle } from 'lucide-react';
import { ImageAsset, ImageReference } from '../../types';

interface ImageReferenceModalProps {
  images: ImageAsset[];
  onClose: () => void;
  onSelect: (ref: ImageReference) => void;
  onSelectForInpaint?: (imageUrl: string, name?: string) => void;
}

export const ImageReferenceModal: React.FC<ImageReferenceModalProps> = ({
  images,
  onClose,
  onSelect,
  onSelectForInpaint,
}) => {
  const [tab, setTab] = useState<'upload' | 'gallery'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [staged, setStaged] = useState<{
    dataUrl: string;
    name: string;
    width: number;
    height: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setStaged({
          dataUrl,
          name: file.name,
          width: img.naturalWidth || 1024,
          height: img.naturalHeight || 1024,
        });
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
                Image Guidance &amp; Reference
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Guide your next synthesis with an existing visual composition, or surgically remove objects
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

        {/* Educational Distinction Banner */}
        <div className="mx-5 mt-4 p-3 rounded-xl bg-surface-subpanel/80 border border-amber-500/20 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <div className="space-y-1 text-slate-300">
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <span>Composition Guide vs Object Removal</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                • <strong className="text-brand-300">Img2Img Reference:</strong> Preserves general scene structure, pose, and colors while re-rendering details across the entire frame.
                <br />
                • <strong className="text-amber-300">Surgical Object Removal (Inpaint Canvas):</strong> If your goal is to remove glasses, hats, or unwanted objects without touching the rest of the image, open it in <strong className="text-amber-300">Inpaint Canvas</strong> to draw a mask.
              </p>
            </div>
          </div>
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
            staged ? (
              <div className="flex flex-col items-center gap-4 py-2">
                <div className="relative w-44 h-44 rounded-xl overflow-hidden border border-surface-border shadow-lg bg-black">
                  <img src={staged.dataUrl} alt={staged.name} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-sm px-2 py-1 text-[10px] text-slate-300 font-mono text-center truncate">
                    {staged.width}×{staged.height} · {staged.name}
                  </div>
                </div>

                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  <button
                    onClick={() => {
                      onSelect({
                        dataUrl: staged.dataUrl,
                        name: staged.name,
                        fidelity: 0.65,
                        width: staged.width,
                        height: staged.height,
                      });
                      onClose();
                    }}
                    className="p-3.5 rounded-xl bg-surface-card hover:bg-surface-hover border border-brand-500/40 hover:border-brand-500 flex flex-col items-start gap-1.5 transition text-left group shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-brand-400 font-semibold text-xs">
                      <Sparkles className="w-4 h-4" />
                      <span>Use as Img2Img Reference</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans leading-snug">
                      Guide composition, layout, and colors for fresh generations.
                    </p>
                  </button>

                  {onSelectForInpaint && (
                    <button
                      onClick={() => {
                        onSelectForInpaint(staged.dataUrl, staged.name);
                        onClose();
                      }}
                      className="p-3.5 rounded-xl bg-surface-card hover:bg-surface-hover border border-amber-500/40 hover:border-amber-500 flex flex-col items-start gap-1.5 transition text-left group shadow-sm"
                    >
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                        <Eraser className="w-4 h-4" />
                        <span>Remove Object in Canvas</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans leading-snug">
                        Surgically paint a mask over glasses, hats, or clutter to erase/replace them.
                      </p>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setStaged(null)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline mt-1"
                >
                  Select a different image
                </button>
              </div>
            ) : (
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
            )
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
                      className="group relative rounded-lg border border-surface-border bg-surface-card overflow-hidden aspect-square hover:border-brand-500 hover:ring-2 hover:ring-brand-500/30 transition-all shadow-sm"
                    >
                      <img
                        src={img.url}
                        alt={img.prompt}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                        <span className="text-[9px] text-slate-300 font-mono truncate">
                          {img.width}×{img.height}
                        </span>
                        <div className="flex flex-col gap-1.5 w-full">
                          <button
                            onClick={() => handleSelectGalleryImage(img)}
                            className="w-full py-1 px-2 rounded bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-medium flex items-center justify-center gap-1 shadow transition"
                            title="Use as Img2Img reference"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Img2Img Ref</span>
                          </button>
                          {onSelectForInpaint && (
                            <button
                              onClick={() => {
                                onSelectForInpaint(img.url, img.filename);
                                onClose();
                              }}
                              className="w-full py-1 px-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-medium flex items-center justify-center gap-1 shadow transition"
                              title="Open in Inpaint Canvas to remove objects"
                            >
                              <Eraser className="w-3 h-3" />
                              <span>Remove Object</span>
                            </button>
                          )}
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
