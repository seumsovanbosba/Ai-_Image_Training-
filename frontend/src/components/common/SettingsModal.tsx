import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Cpu, Server } from 'lucide-react';
import { api } from '../../services/api';
import { VramInfo } from '../../types';

interface SettingsModalProps {
  onClose: () => void;
  comfyOnline: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, comfyOnline }) => {
  const [vram, setVram] = useState<VramInfo | null>(null);
  const [engineOnline, setEngineOnline] = useState(comfyOnline);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const status = await api.getSystemStatus();
        if (cancelled) return;
        setEngineOnline(status.comfyui_online);
        setVram(status.vram || null);
      } catch {
        if (!cancelled) setVram(null);
      }
    };

    load();
    const id = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const hasVram = vram && vram.source !== 'unavailable' && vram.total_gb != null && vram.used_gb != null;
  const percent = hasVram ? Math.min(100, Math.max(0, vram.percent ?? 0)) : 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn font-mono text-xs">
      <div className="bg-surface-panel border border-surface-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
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

        <div className="p-5 space-y-4 text-slate-300">
          <div className="space-y-2">
            <span className="text-[10px] text-slate-500 uppercase">GPU Memory</span>
            <div className="p-3 rounded-md bg-surface-base border border-surface-border space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1.5 text-slate-400">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>VRAM</span>
                </span>
                {hasVram ? (
                  <span className="text-on-surface font-semibold">
                    {vram.used_gb.toFixed(1)} / {vram.total_gb.toFixed(1)} GB
                  </span>
                ) : (
                  <span className="text-amber-400">Unavailable</span>
                )}
              </div>
              <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-container rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="truncate pr-3">{vram?.device_name || 'No GPU reported'}</span>
                <span>{hasVram ? `${percent.toFixed(0)}% · ${vram.source}` : 'waiting for engine'}</span>
              </div>
            </div>
          </div>

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
                <span className={`flex items-center space-x-1 ${engineOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${engineOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>{engineOnline ? 'Online & Listening' : 'Standalone Fallback'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-surface-border bg-surface-subpanel/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary font-medium shadow-sm transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
