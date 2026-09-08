import React from 'react';
import { 
  Sparkles, Palette, FolderGit2, ShieldCheck, 
  Cpu, HardDrive, WifiOff, LayoutDashboard 
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'studio' | 'gallery' | 'settings';
  setActiveTab: (tab: 'studio' | 'gallery' | 'settings') => void;
  comfyOnline: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  comfyOnline,
}) => {
  return (
    <header className="flex flex-wrap items-center justify-between px-6 py-3 bg-[#0d1322] border-b border-slate-800 shadow-md">
      {/* Brand */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-black tracking-tight text-white uppercase">Antigravity</h1>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold border border-indigo-500/30">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Headless ComfyUI • Fooocus Automation • InvokeAI Canvas
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-1 bg-[#121a2d] p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('studio')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'studio'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Production Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('gallery')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'gallery'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FolderGit2 className="w-3.5 h-3.5" />
          <span>Boards & History</span>
        </button>
      </div>

      {/* Offline Status Badges */}
      <div className="flex items-center space-x-3">
        <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-300 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>100% Offline Mode</span>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span>ComfyUI:</span>
          <span className={`w-2 h-2 rounded-full ${comfyOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="font-mono">{comfyOnline ? 'Engine Active' : 'Standalone'}</span>
        </div>
      </div>
    </header>
  );
};
