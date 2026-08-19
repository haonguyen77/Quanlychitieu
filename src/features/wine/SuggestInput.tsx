import { useState, useMemo, useRef, useEffect } from 'react';

interface SuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  maxSuggestions?: number;
}

/**
 * Input field with autocomplete dropdown from a list of previously-used values.
 * Shows suggestions as user types; click or Enter to select.
 */
export function SuggestInput({ value, onChange, suggestions, placeholder, className, maxSuggestions = 6 }: SuggestInputProps) {
  const [showSugg, setShowSugg] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return suggestions.slice(0, maxSuggestions);
    const q = value.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q).slice(0, maxSuggestions);
  }, [value, suggestions, maxSuggestions]);

  useEffect(() => { setHighlightIdx(0); }, [filtered]);

  const select = (val: string) => {
    onChange(val);
    setShowSugg(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSugg || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((p) => Math.min(p + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((p) => Math.max(p - 1, 0)); }
    else if (e.key === 'Tab' && filtered.length > 0) { e.preventDefault(); select(filtered[highlightIdx]); }
    else if (e.key === 'Enter') { e.preventDefault(); setShowSugg(false); /* confirm current value */ }
    else if (e.key === 'Escape') { setShowSugg(false); }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowSugg(true); }}
        onFocus={() => setShowSugg(true)}
        onBlur={() => setTimeout(() => setShowSugg(false), 200)}
        onKeyDown={handleKeyDown}
      />
      {showSugg && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-36 overflow-y-auto">
          {filtered.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => select(s)}
              className={`w-full text-left px-3 py-1.5 text-[13px] text-gray-900 dark:text-gray-100 ${i === highlightIdx ? 'bg-purple-100 dark:bg-purple-900/30' : 'hover:bg-purple-50 dark:hover:bg-purple-900/20'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
