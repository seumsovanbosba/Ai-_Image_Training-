import React, { useState } from 'react';
import { 
  Sparkles, Wand2, ChevronDown, ChevronUp, Plus, X, 
  Square, Play, RefreshCw, SlidersHorizontal 
} from 'lucide-react';
import { StylePreset } from '../../types';
import { StylePicker } from './StylePicker';

interface PromptBarProps {
  prompt: string;
  setPrompt: (p: string) => void;
  negativePrompt: string;
  setNegativePrompt: (np: string) => void;
  styles: StylePreset[];
  selectedStyles: string[];
  setSelectedStyles: React.Dispatch<React.SetStateAction<string[]>>;
  autoExpand: boolean;
  setAutoExpand: (ae: boolean) => void;
  expansionLevel: string;
  setExpansionLevel: (el: string) => void;
  onGenerate: () => void;
  onInterrupt: () => void;
  isGenerating: boolean;
}

export const PromptBar: React.FC<PromptBarProps> = ({
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  styles,
  selectedStyles,
  setSelectedStyles,
  autoExpand,
  setAutoExpand,
  expansionLevel,
  setExpansionLevel,
  onGenerate,
  onInterrupt,
  isGenerating,
}) => {
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showNegative, setShowNegative] = useState(false);

  const toggleStyle = (styleName: string) => {
    setSelectedStyles((prev) =>
      prev.includes(styleName) ? prev.filter((s) => s !== styleName) : [...prev, styleName]
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!isGenerating && prompt.trim()) {
        onGenerate();
      }
    }
  };

  return (
    <div className="flex flex-col bg-[#111726] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
      {/* Selected Style Chips */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
        <button
          onClick={() => setShowStylePicker(true)}
          className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Styles ({selectedStyles.length})</span>
        </button>

        {selectedStyles.map((s) => (
          <span
            key={s}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200"
          >
            <span>{s}</span>
            <button
              onClick={() => toggleStyle(s)}
              className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Auto Expand Toggle */}
        <div className="ml-auto flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setAutoExpand(!autoExpand)}
            className={`flex items-center space-x-1.5 text-xs font-medium transition ${
              autoExpand ? 'text-amber-400' : 'text-slate-500'
            }`}
            title="Automatically enhance prompt details and scene lighting"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Fooocus Auto-Expand</span>
          </button>

          {autoExpand && (
            <select
              value={expansionLevel}
              onChange={(e) => setExpansionLevel(e.target.value)}
              className="bg-slate-800 text-[11px] text-slate-300 rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none"
            >
              <option value="light">Light</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy</option>
            </select>
          )}
        </div>
      </div>

      {/* Main Prompt Input Area */}
      <div className="flex items-end gap-3">
        <div className="relative flex-1">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Describe what you want to create... (e.g. 'a cybernetic tiger resting in ancient overgrown temple ruins') [Ctrl + Enter to Generate]"
            className="w-full bg-[#0a0e1a] border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition resize-none leading-relaxed"
          />
        </div>

        {/* Action Button: Generate or Interrupt */}
        {isGenerating ? (
          <button
            onClick={onInterrupt}
            className="flex items-center justify-center space-x-2 px-6 h-[72px] rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition active:scale-95"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            onClick={onGenerate}
            disabled={!prompt.trim()}
            className="flex items-center justify-center space-x-2 px-7 h-[72px] rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate</span>
          </button>
        )}
      </div>

      {/* Negative Prompt Accordion Toggle */}
      <div>
        <button
          onClick={() => setShowNegative(!showNegative)}
          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition py-0.5"
        >
          {showNegative ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>Custom Negative Prompt (Automated quality filters already included)</span>
        </button>

        {showNegative && (
          <div className="mt-2 animate-fadeIn">
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
              placeholder="Exclude specific elements (e.g. 'sunglasses, modern buildings, text'). Quality artifacts are already cleaned automatically."
              className="w-full bg-[#0a0e1a] border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-rose-500/50 transition resize-none"
            />
          </div>
        )}
      </div>

      {/* Style Picker Modal */}
      {showStylePicker && (
        <StylePicker
          styles={styles}
          selectedStyles={selectedStyles}
          onToggleStyle={toggleStyle}
          onClose={() => setShowStylePicker(false)}
        />
      )}
    </div>
  );
};
