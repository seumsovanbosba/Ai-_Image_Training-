import React from 'react';
import { CircleHelp, Settings } from 'lucide-react';
import { WorkspaceTab } from '../../types';

interface StudioTopBarProps {
  sidebarCollapsed: boolean;
  activeTab: WorkspaceTab;
  onOpenSettings: () => void;
}

const TAB_LABEL: Record<WorkspaceTab, string> = {
  studio: 'AI Image Studio',
  canvas: 'Canvas',
  dag: 'DAG Pipeline',
  gallery: 'Images & Assets',
};

export const StudioTopBar: React.FC<StudioTopBarProps> = ({
  sidebarCollapsed,
  activeTab,
  onOpenSettings,
}) => {
  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-surface-dim/80 backdrop-blur-xl z-30 shadow-[0_1px_8px_rgba(0,0,0,0.04)] ${
        sidebarCollapsed ? 'left-14' : 'left-sidebar'
      }`}
    >
      <div className="h-16 w-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-1 text-body-md">
          <span className="text-outline">Studio</span>
          <span className="text-outline-variant">/</span>
          <span className="text-on-surface font-medium">{TAB_LABEL[activeTab]}</span>
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
    </header>
  );
};
