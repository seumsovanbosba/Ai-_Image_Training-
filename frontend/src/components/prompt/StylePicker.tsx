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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#162032]">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Fooocus Style Presets</h2>
              <p className="text-xs text-slate-400">Select multiple artistic styles to combine modifiers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="p-4 border-b border-slate-800 bg-[#0d131f] space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search style presets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Style Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 bg-[#0b0f19]">
          {filteredStyles.map((style) => {
            const isSelected = selectedStyles.includes(style.name);
            return (
              <button
                key={style.name}
                onClick={() => onToggleStyle(style.name)}
                className={`flex flex-col text-left p-3.5 rounded-xl border transition-all relative ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-600/20'
                    : 'border-slate-800 bg-[#131b2c] hover:border-slate-700 hover:bg-[#18233a]'
                }`}
              >
                <div className="flex items-start justify-between w-full mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {style.category}
                  </span>
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'border-slate-700 bg-slate-800/60'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
                <div className="text-xs font-bold text-slate-100 mb-1">{style.name}</div>
                <div className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                  {style.positive_prompt.replace('{prompt}, ', '')}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-[#141b2b]">
          <span className="text-xs text-slate-400">
            <strong>{selectedStyles.length}</strong> style{selectedStyles.length !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
