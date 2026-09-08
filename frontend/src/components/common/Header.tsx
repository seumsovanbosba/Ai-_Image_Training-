import React from 'react';
import { 
  Image as ImageIcon, Paintbrush, Network, History, 
  Settings, ShieldCheck, Cpu 
} from 'lucide-react';

export type WorkspaceTab = 'studio' | 'canvas' | 'dag' | 'gallery';

interface HeaderProps {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  comfyOnline: boolean;
  isGenerating?: boolean;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  comfyOnline,
  isGenerating = false,
  onOpenSettings,
}) => {
  return (
    <header className="h-12 border-b border-surface-border bg-surface-panel/90 backdrop-blur px-4 flex items-center justify-between flex-shrink-0 z-30" data-purpose="primary-navigation">
      {/* Brand & Modes */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 shadow-sm">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="font-semibold text-slate-100 tracking-wider text-[12px] uppercase">Antigravity</span>
            <span className="text-[10px] font-mono text-slate-500">v2.4</span>
          </div>
        </div>

        <div className="h-4 w-px bg-surface-border" />

        {/* Workspace Navigation */}
        <nav aria-label="Workspaces" className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('studio')}
            className={`px-3 py-1.5 rounded-md text-[11px] flex items-center space-x-2 transition-all ${
              activeTab === 'studio'
                ? 'text-slate-100 font-medium bg-surface-subpanel border border-surface-borderLight/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover/50'
            }`}
          >
            <ImageIcon className={`w-3 h-3 ${activeTab === 'studio' ? 'text-brand-400' : 'text-slate-400'}`} />
            <span>Text-to-Image Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('canvas')}
            className={`px-3 py-1.5 rounded-md text-[11px] flex items-center space-x-2 transition-all ${
              activeTab === 'canvas'
                ? 'text-slate-100 font-medium bg-surface-subpanel border border-surface-borderLight/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover/50'
            }`}
          >
            <Paintbrush className={`w-3 h-3 ${activeTab === 'canvas' ? 'text-brand-400' : 'text-slate-400'}`} />
            <span>Canvas</span>
          </button>

          <button
            onClick={() => setActiveTab('dag')}
            className={`px-3 py-1.5 rounded-md text-[11px] flex items-center space-x-2 transition-all ${
              activeTab === 'dag'
                ? 'text-slate-100 font-medium bg-surface-subpanel border border-surface-borderLight/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover/50'
            }`}
          >
            <Network className={`w-3 h-3 ${activeTab === 'dag' ? 'text-brand-400' : 'text-slate-400'}`} />
            <span>DAG Pipeline</span>
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-3 py-1.5 rounded-md text-[11px] flex items-center space-x-2 transition-all ${
              activeTab === 'gallery'
                ? 'text-slate-100 font-medium bg-surface-subpanel border border-surface-borderLight/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover/50'
            }`}
          >
            <History className={`w-3 h-3 ${activeTab === 'gallery' ? 'text-brand-400' : 'text-slate-400'}`} />
            <span>Queue &amp; History</span>
          </button>
        </nav>
      </div>

      {/* Status Cluster & System Metrics */}
      <div className="flex items-center space-x-4 font-mono text-[11px]">
        <div className="flex items-center space-x-2 text-slate-300">
          <span className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-amber-400 animate-ping' : comfyOnline ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
          <span className="text-slate-400">Backend:</span>
          <span className="text-slate-200 font-medium">{isGenerating ? 'Synthesizing...' : 'Ready'}</span>
        </div>

        <div className="h-3.5 w-px bg-surface-border" />

        <div className="hidden sm:flex items-center space-x-2.5 text-slate-400">
          <span>VRAM</span>
          <div className="w-16 bg-surface-subpanel h-1.5 rounded-full overflow-hidden border border-surface-border">
            <div className={`h-full rounded-full transition-all duration-500 ${isGenerating ? 'bg-amber-500 w-[78%]' : 'bg-brand-500 w-[59%]'}`} />
          </div>
          <span className="text-slate-200 font-medium">14.2 GB</span>
        </div>

        <div className="h-3.5 w-px bg-surface-border" />

        <div className="hidden md:flex items-center space-x-1.5 text-emerald-400 text-[10px]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>100% Offline</span>
        </div>

        <div className="h-3.5 w-px bg-surface-border" />

        <button
          onClick={onOpenSettings}
          className="w-7 h-7 rounded hover:bg-surface-hover flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
          title="System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
