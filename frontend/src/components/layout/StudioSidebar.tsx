import React from 'react';
import {
  Sparkles, Plus, Search, Images, History, MessageSquare, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { RecentChat, WorkspaceTab } from '../../types';

interface StudioSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  activeTab: WorkspaceTab;
  search: string;
  onSearch: (value: string) => void;
  recents: RecentChat[];
  activeRecentId: string | null;
  imageCount: number;
  onNewGeneration: () => void;
  onOpenGallery: () => void;
  onSelectRecent: (recent: RecentChat) => void;
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  collapsed,
  onToggleCollapsed,
  activeTab,
  search,
  onSearch,
  recents,
  activeRecentId,
  imageCount,
  onNewGeneration,
  onOpenGallery,
  onSelectRecent,
}) => {
  const filtered = recents.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  if (collapsed) {
    return (
      <aside className="fixed left-0 top-0 bottom-0 w-14 bg-surface-container-lowest z-40 flex flex-col items-center py-3 gap-3 border-r border-outline-variant/40">
        <button
          onClick={onToggleCollapsed}
          className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary"
          title="Expand sidebar"
        >
          <Sparkles className="w-4 h-4" />
        </button>
        <button
          onClick={onNewGeneration}
          className="w-9 h-9 rounded-lg bg-surface-container-high text-primary hover:bg-surface-bright transition-colors flex items-center justify-center"
          title="New Generation"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenGallery}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            activeTab === 'gallery' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
          title="Images & Assets"
        >
          <Images className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleCollapsed}
          className="mt-auto mb-2 p-2 text-on-surface-variant hover:text-on-surface"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-sidebar bg-surface-container-lowest z-40 flex flex-col justify-between p-3 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1 py-0.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-on-primary" />
            </div>
            <span className="text-headline-md text-on-surface tracking-tight">Studio Canvas</span>
          </div>
          <button
            onClick={onToggleCollapsed}
            className="p-0.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-[18px] h-[18px]" />
          </button>
        </div>

        <button
          onClick={onNewGeneration}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          <Plus className="w-[18px] h-[18px] text-primary" />
          <span className="text-body-md">New Generation</span>
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant">
          <Search className="w-[18px] h-[18px] shrink-0" />
          <input
            className="w-full bg-transparent text-body-md text-on-surface placeholder:text-outline focus:outline-none"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        <nav className="flex flex-col gap-0.5 pt-1">
          <button
            onClick={onOpenGallery}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'gallery'
                ? 'bg-surface-container-high text-on-surface font-medium'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <Images className="w-5 h-5" />
            <span className="text-body-md flex-1 text-left">Images &amp; Assets</span>
            <span className="font-mono text-mono-data text-on-surface-variant bg-surface-container px-1 rounded-full">
              {imageCount}
            </span>
          </button>
        </nav>

        <div className="pt-1">
          <div className="px-3 py-0.5 flex items-center justify-between text-outline">
            <span className="font-mono text-label-caps uppercase tracking-wider">Recents</span>
            <History className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[38vh]">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-mono-data font-mono text-outline">No chats yet</p>
            )}
            {filtered.map((recent) => (
              <button
                key={recent.id}
                onClick={() => onSelectRecent(recent)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors group ${
                  activeRecentId === recent.id
                    ? 'bg-surface-container-high text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <MessageSquare className="w-4 h-4 opacity-70 group-hover:text-primary transition-colors shrink-0" />
                <span className="text-body-md truncate">{recent.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
