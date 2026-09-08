import React, { useState } from 'react';
import { ImageAsset, Board } from '../../types';
import { ImageDetailModal } from './ImageDetailModal';
import { 
  Folder, FolderPlus, Image as ImageIcon, Send, 
  Trash2, Plus, Filter, Sparkles 
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
    <div className="flex flex-col md:flex-row h-full gap-6">
      {/* Left: Boards Sidebar */}
      <div className="w-full md:w-64 flex flex-col bg-[#111726] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Folder className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Asset Boards</h3>
          </div>
          <button
            onClick={() => setShowNewBoardModal(true)}
            className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 transition"
            title="Create New Board"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Board List */}
        <div className="space-y-1 overflow-y-auto flex-1 pr-1">
          <button
            onClick={() => setSelectedBoardId(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
              selectedBoardId === null
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>All Generations</span>
            </div>
            <span className="text-[10px] opacity-70 font-mono">{images.length}</span>
          </button>

          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBoardId(b.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                selectedBoardId === b.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{b.name}</span>
              </div>
              <span className="text-[10px] opacity-70 font-mono shrink-0">{b.image_count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Images Grid */}
      <div className="flex-1 bg-[#111726] border border-slate-800 rounded-2xl p-6 shadow-xl overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-100">
              {selectedBoardId === null
                ? 'All Generated Assets'
                : boards.find((b) => b.id === selectedBoardId)?.name ?? 'Board Assets'}
            </h2>
            <p className="text-xs text-slate-400">
              {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''} stored locally in SQLite & /outputs
            </p>
          </div>
        </div>

        {filteredImages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 mb-4">
              <ImageIcon className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">No images in this board yet</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Use the Generator or Canvas to produce offline AI creations. All outputs are automatically tracked here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredImages.map((img) => (
              <div
                key={img.id}
                onClick={() => setSelectedImage(img)}
                className="group relative aspect-square bg-[#0b0f19] rounded-xl overflow-hidden border border-slate-800 hover:border-indigo-500/60 transition-all duration-200 cursor-pointer shadow-md hover:shadow-indigo-500/10"
              >
                <img
                  src={img.url}
                  alt={img.prompt}
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition p-3 flex flex-col justify-end">
                  <p className="text-xs text-white font-medium line-clamp-2 mb-2 select-none">
                    {img.prompt}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-300">
                    <span className="font-mono bg-black/60 px-1.5 py-0.5 rounded">
                      {img.width}×{img.height}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendToCanvas(img.url);
                      }}
                      className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition"
                      title="Send to Inpaint Canvas"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {img.is_inpaint && (
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-amber-500/90 text-black text-[9px] font-bold">
                    Inpaint
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Detail Inspector Modal */}
      {selectedImage && (
        <ImageDetailModal
          image={selectedImage}
          boards={boards}
          onClose={() => setSelectedImage(null)}
          onSendToCanvas={onSendToCanvas}
          onReuseSettings={onReuseSettings}
          onDelete={onDeleteImage}
          onAssignBoard={onAssignBoard}
        />
      )}

      {/* New Board Modal */}
      {showNewBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <FolderPlus className="w-5 h-5 text-indigo-400" />
              <span>Create New Asset Board</span>
            </h3>

            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Board Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cyberpunk Characters, Landscapes, Canvas Edits"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="w-full bg-[#0a0e1a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. High detail neon cityscapes and characters"
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  className="w-full bg-[#0a0e1a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewBoardModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition"
                >
                  Create Board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
