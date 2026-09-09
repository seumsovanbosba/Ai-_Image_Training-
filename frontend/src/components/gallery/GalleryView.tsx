import React, { useState } from 'react';
import { ImageAsset, Board } from '../../types';
import { ImageDetailModal } from './ImageDetailModal';
import { 
  Folder, FolderPlus, Image as ImageIcon, Send, 
  Trash2, Plus, Filter, Sparkles, RefreshCw, X 
} from 'lucide-react';

interface GalleryViewProps {
  images: ImageAsset[];
  boards: Board[];
  selectedBoardId: number | null;
  setSelectedBoardId: (id: number | null) => void;
  onCreateBoard: (name: string, description?: string) => Promise<void>;
  onSendToCanvas: (imageUrl: string) => void;
  onReuseSettings: (image: ImageAsset) => void;
  onDeleteImage: (imageId: number) => Promise<void>;
  onAssignBoard: (imageId: number, boardId: number | null) => Promise<void>;
  onUpscale?: (image: ImageAsset) => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  images,
  boards,
  selectedBoardId,
  setSelectedBoardId,
  onCreateBoard,
  onSendToCanvas,
  onReuseSettings,
  onDeleteImage,
  onAssignBoard,
  onUpscale,
}) => {
  const [selectedImage, setSelectedImage] = useState<ImageAsset | null>(null);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    await onCreateBoard(newBoardName.trim(), newBoardDesc.trim() || undefined);
    setNewBoardName('');
    setNewBoardDesc('');
    setShowNewBoardModal(false);
  };

  const filteredImages = selectedBoardId !== null
    ? images.filter((img) => img.board_id === selectedBoardId)
    : images;

  return (
    <div className="flex flex-col md:flex-row h-full gap-4 p-4 font-mono text-xs">
      {/* Left: Boards Sidebar */}
      <div className="w-full md:w-60 flex flex-col bg-surface-panel border border-surface-border rounded-lg p-3.5 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
          <div className="flex items-center space-x-2">
            <Folder className="w-3.5 h-3.5 text-brand-400" />
            <h3 className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider">Asset Boards</h3>
          </div>
          <button
            onClick={() => setShowNewBoardModal(true)}
            className="p-1 rounded bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 transition"
            title="Create New Board"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Board List */}
        <div className="space-y-1 overflow-y-auto flex-1 pr-1">
          <button
            onClick={() => setSelectedBoardId(null)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] font-medium transition ${
              selectedBoardId === null
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ImageIcon className="w-3 h-3" />
              <span>All Generations</span>
            </div>
            <span className="text-[10px] opacity-75">{images.length}</span>
          </button>

          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBoardId(b.id)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] font-medium transition ${
                selectedBoardId === b.id
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">{b.name}</span>
              </div>
              <span className="text-[10px] opacity-75 shrink-0">{b.image_count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Images Grid */}
      <div className="flex-1 flex flex-col bg-surface-panel border border-surface-border rounded-lg overflow-hidden">
        {/* Header Bar */}
        <div className="px-4 py-2.5 border-b border-surface-border bg-surface-subpanel/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-slate-300 font-medium">
              {selectedBoardId === null
                ? 'All Outputs'
                : boards.find((b) => b.id === selectedBoardId)?.name || 'Board'}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-500">{filteredImages.length} items</span>
          </div>
        </div>

        {/* Grid */}
        <div className="p-4 overflow-y-auto flex-1">
          {filteredImages.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <p>No images found in this board</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredImages.map((img) => (
                <div
                  key={img.id}
                  onClick={() => setSelectedImage(img)}
                  className="group relative rounded-md border border-surface-border bg-surface-card overflow-hidden aspect-square cursor-pointer hover:border-brand-500/50 transition-all shadow-sm"
                >
                  <img
                    src={img.url}
                    alt={img.prompt}
                    className="w-full h-full object-cover select-none transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-between">
                    <div className="flex justify-end">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/70 border border-white/10 text-slate-300">
                        {img.width}×{img.height}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-200 line-clamp-2 leading-tight">
                      {img.prompt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Board Modal */}
      {showNewBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleCreateBoard}
            className="bg-surface-panel border border-surface-border rounded-lg w-full max-w-sm p-4 space-y-3 font-mono shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-surface-border pb-2">
              <h4 className="text-xs font-semibold text-slate-200 uppercase">Create Asset Board</h4>
              <button
                type="button"
                onClick={() => setShowNewBoardModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase">Board Name</label>
              <input
                type="text"
                required
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="e.g., Brutalist Sanctuary"
                className="w-full bg-surface-base border border-surface-border rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase">Description (Optional)</label>
              <input
                type="text"
                value={newBoardDesc}
                onChange={(e) => setNewBoardDesc(e.target.value)}
                placeholder="Project concepts..."
                className="w-full bg-surface-base border border-surface-border rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 mt-1"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewBoardModal(false)}
                className="px-3 py-1.5 rounded border border-surface-border hover:bg-surface-hover text-slate-400 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary text-xs font-medium"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Image Detail Modal */}
      {selectedImage && (
        <ImageDetailModal
          image={selectedImage}
          boards={boards}
          onClose={() => setSelectedImage(null)}
          onSendToCanvas={(url) => {
            onSendToCanvas(url);
            setSelectedImage(null);
          }}
          onReuseSettings={(img) => {
            onReuseSettings(img);
            setSelectedImage(null);
          }}
          onDeleteImage={async (id) => {
            await onDeleteImage(id);
            setSelectedImage(null);
          }}
          onAssignBoard={onAssignBoard}
          onUpscale={(img) => {
            onUpscale?.(img);
            setSelectedImage(null);
          }}
        />
      )}
    </div>
  );
};
