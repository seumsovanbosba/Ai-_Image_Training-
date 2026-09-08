import React from 'react';
import { X, ShieldCheck, Cpu, HardDrive, CheckCircle2, Server } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  comfyOnline: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, comfyOnline }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn font-mono text-xs">
      <div className="bg-surface-panel border border-surface-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-subpanel/50">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-brand-400" />
            <span className="font-semibold text-slate-100 uppercase tracking-wide">Environment &amp; Engine</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-slate-300">
          <div className="space-y-2">
            <span className="text-[10px] text-slate-500 uppercase">Offline Safety Compliance</span>
            <div className="p-3 rounded-md bg-surface-base border border-surface-border space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-emerald-400">
                <span className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>HF_HUB_OFFLINE</span>
                </span>
                <span className="font-bold">1 (ENFORCED)</span>
              </div>
              <div className="flex items-center justify-between text-emerald-400">
                <span className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>TRANSFORMERS_OFFLINE</span>
                </span>
                <span className="font-bold">1 (ENFORCED)</span>
              </div>
              <div className="flex items-center justify-between text-emerald-400">
                <span className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>HF_DATASETS_OFFLINE</span>
                </span>
                <span className="font-bold">1 (ENFORCED)</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] text-slate-500 uppercase">Local Daemon Endpoints</span>
            <div className="p-3 rounded-md bg-surface-base border border-surface-border space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Orchestrator API:</span>
                <span className="text-brand-400 font-semibold">http://127.0.0.1:8000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ComfyUI Daemon:</span>
                <span className="text-brand-400 font-semibold">ws://127.0.0.1:8188/ws</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ComfyUI Status:</span>
                <span className={`flex items-center space-x-1 ${comfyOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${comfyOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>{comfyOnline ? 'Online & Listening' : 'Standalone Fallback'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-surface-border bg-surface-subpanel/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium shadow-sm transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
