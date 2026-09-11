import React from 'react';
import { CircleHelp, Settings, ArrowLeft } from 'lucide-react';
import { WorkspaceTab } from '../../types';

interface StudioTopBarProps {
  sidebarCollapsed: boolean;
  activeTab: WorkspaceTab;
  comfyOnline: boolean;
  engineStarting?: boolean;
  onStartEngine?: () => void;
  onOpenSettings: () => void;
  onBackToStudio?: () => void;
}

const TAB_LABEL: Record<WorkspaceTab, string> = {
  studio: 'AI Image Studio',
  canvas: 'Inpaint Canvas',
  dag: 'DAG Pipeline',
  gallery: 'Images & Assets',
};

export const StudioTopBar: React.FC<StudioTopBarProps> = ({
  sidebarCollapsed,
  activeTab,
  comfyOnline,
  engineStarting,
  onStartEngine,
  onOpenSettings,
  onBackToStudio,
}) => {
  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-surface-dim/80 backdrop-blur-xl z-30 shadow-[0_1px_8px_rgba(0,0,0,0.04)] ${
        sidebarCollapsed ? 'left-14' : 'left-sidebar'
      }`}
    >
      <div className="h-16 w-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-body-md">
          {activeTab !== 'studio' && onBackToStudio && (
            <button
              onClick={onBackToStudio}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-body-md transition-colors mr-1 border border-outline-variant/40"
              title="Return to Studio Timeline"
            >
              <ArrowLeft className="w-4 h-4 text-primary" />
              <span>Back to Studio</span>
            </button>
          )}

          {activeTab !== 'studio' && onBackToStudio ? (
            <button
              onClick={onBackToStudio}
              className="text-outline hover:text-primary transition-colors cursor-pointer"
            >
              Studio
            </button>
          ) : (
            <span className="text-outline">Studio</span>
          )}
          <span className="text-outline-variant">/</span>
          <span className="text-on-surface font-medium">{TAB_LABEL[activeTab]}</span>
        </div>


        <div className="flex items-center gap-3">
          {/* Engine Status Badge */}
          <div
            onClick={() => {
              if (!comfyOnline && !engineStarting && onStartEngine) {
                onStartEngine();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono border transition-all select-none ${
              comfyOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : engineStarting
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse cursor-wait'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 cursor-pointer'
            }`}
            title={
              comfyOnline
                ? 'ComfyUI Headless Engine is online and ready on port 8188'
                : engineStarting
                ? 'ComfyUI Engine is currently starting up... Please wait.'
                : 'ComfyUI Engine is offline. Click to start the engine.'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                comfyOnline
                  ? 'bg-emerald-400'
                  : engineStarting
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-400'
              }`}
            />
            <span>
              {comfyOnline
                ? 'Engine Online'
                : engineStarting
                ? 'Engine Initializing...'
                : 'Engine Offline (Click to Start)'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <a
              href="#"
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
              title="Help & Documentation"
            >
              <CircleHelp className="w-5 h-5" />
            </a>
            <button
              onClick={onOpenSettings}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
              title="Global Studio Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
