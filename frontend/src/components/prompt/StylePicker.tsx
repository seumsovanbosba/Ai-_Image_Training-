import React, { useState } from 'react';
import { StylePreset } from '../../types';
import { Sparkles, Check, X, Search } from 'lucide-react';

interface StylePickerProps {
  styles: StylePreset[];
  selectedStyles: string[];
  onToggleStyle: (styleName: string) => void;
  onClose: () => void;
}

export const StylePicker: React.FC<StylePickerProps> = ({
  styles,
  selectedStyles,
  onToggleStyle,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(styles.map((s) => s.category)))];

  const filteredStyles = styles.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-panel border border-surface-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border bg-surface-subpanel/60">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-md bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-100 font-mono">Fooocus Style Presets</h2>
              <p className="text-[11px] text-slate-400">Select multiple artistic styles to blend modifiers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="p-4 border-b border-surface-border bg-surface-base space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search styles (cinematic, anime, cyberpunk, brutalist...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-panel border border-surface-border rounded-md pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-brand-600 text-white font-medium'
                    : 'bg-surface-panel text-slate-400 hover:text-slate-200 hover:bg-surface-hover border border-surface-border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Style Grid */}
        <div className="p-5 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5 flex-1 bg-surface-base">
          {filteredStyles.map((style) => {
            const isSelected = selectedStyles.includes(style.name);
            return (
              <button
                key={style.name}
                onClick={() => onToggleStyle(style.name)}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all relative font-mono ${
                  isSelected
                    ? 'border-brand-500/70 bg-brand-500/10 shadow-sm'
                    : 'border-surface-border bg-surface-panel hover:border-surface-borderLight hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-start justify-between w-full mb-1">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider">
                    {style.category}
                  </span>
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                      isSelected
                        ? 'bg-brand-600 border-brand-500 text-white'
                        : 'border-surface-border text-transparent'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </div>
                </div>

                <span className={`text-xs font-medium ${isSelected ? 'text-brand-300' : 'text-slate-200'}`}>
                  {style.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-border bg-surface-subpanel/60 flex items-center justify-between font-mono text-[11px]">
          <span className="text-slate-400">
            Selected: <span className="text-brand-400 font-semibold">{selectedStyles.length}</span> styles
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium shadow-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
