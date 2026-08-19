import { useState, useRef } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { useAppStore } from '@/core/store/appStore';
import type { RecordValue, CategoryDefinition } from '@/types';

// ─── Shared FormField wrapper ───────────────────────────────────────────────
interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, required, error, hint, children, className = '' }: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

// ─── Title Input with autocomplete ──────────────────────────────────────────
interface TitleInputProps {
  moduleId: string;
  value: RecordValue;
  onChange: (v: RecordValue) => void;
  placeholder?: string;
  autoFocus?: boolean;
  getSuggestions: (moduleId: string, query: string) => string[];
}

export function TitleInput({ moduleId, value, onChange, placeholder, autoFocus, getSuggestions }: TitleInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const computeSuggestions = (query: string): string[] => {
    // Try the passed getSuggestions first
    const result = getSuggestions(moduleId, query);
    if (result.length > 0) return result;

    // Fallback: direct search in app data (in case the store function has issues)
    const data = useAppStore.getState().data;
    if (!data) return [];

    const lowerQ = query.toLowerCase();
    const titleMap = new Map<string, number>();

    for (const record of data.records) {
      if (record.isDeleted) continue;
      if (record.moduleId !== moduleId && record.moduleId !== 'mod_chitieu') continue;

      // Search all value keys that end with _title or _order_name
      for (const [key, val] of Object.entries(record.values)) {
        if ((key.endsWith('_title') || key.endsWith('_order_name')) && val && typeof val === 'string') {
          if (val.toLowerCase().includes(lowerQ)) {
            titleMap.set(val, (titleMap.get(val) ?? 0) + 1);
          }
        }
      }
    }

    return [...titleMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([title]) => title);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.length === 1) val = val.toUpperCase();
    onChange(val);
    if (val.length >= 1) {
      const r = computeSuggestions(val);
      setSuggestions(r);
      setShowSuggestions(r.length > 0);
      setHighlightIdx(-1);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const handleBlur = () => {
    const c = String(value ?? '');
    if (c && c[0] !== c[0].toUpperCase()) onChange(c.charAt(0).toUpperCase() + c.slice(1));
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const selectItem = (s: string) => {
    onChange(s);
    setShowSuggestions(false);
    setHighlightIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        e.preventDefault();
        selectItem(suggestions[highlightIdx]);
      }
    } else if (e.key === 'Tab') {
      if (suggestions.length > 0) {
        e.preventDefault();
        const nextIdx = highlightIdx < 0 ? 0 : (highlightIdx + 1) % suggestions.length;
        setHighlightIdx(nextIdx);
        selectItem(suggestions[nextIdx]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E] transition-all duration-200"
        value={String(value ?? '')}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-20 max-h-44 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                i === highlightIdx ? 'bg-[#22C55E] text-white' : 'hover:bg-gray-50 text-gray-700'
              }`}
              onMouseDown={() => selectItem(s)}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              {s}
            </button>
          ))}
          <div className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
            ↑↓ di chuyen · Enter/Tab chon
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Money Input with suggestions ───────────────────────────────────────────
interface MoneyInputProps {
  value: RecordValue;
  onChange: (v: RecordValue) => void;
}

export function MoneyInput({ value, onChange }: MoneyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => {
    if (value === null || value === undefined || value === '') return '';
    return Number(value).toLocaleString('vi-VN');
  });
  const [suggestions, setSuggestions] = useState<number[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const gen = (raw: string): number[] => {
    if (!raw || raw === '0') return [];
    const n = parseInt(raw, 10);
    if (isNaN(n) || n === 0) return [];
    // Logic: 1 digit → *10000, 2+ digits → *1000
    if (raw.length === 1) {
      return [n * 10000];
    } else {
      return [n * 1000];
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (!raw) {
      setDisplayValue('');
      onChange(null);
      setSuggestions([]);
      setSelectedIdx(-1);
    } else {
      const n = parseInt(raw, 10);
      setDisplayValue(n.toLocaleString('vi-VN'));
      onChange(n);
      setSuggestions(gen(raw));
      setSelectedIdx(-1);
    }
  };

  const select = (a: number) => {
    setDisplayValue(a.toLocaleString('vi-VN'));
    onChange(a);
    setSuggestions([]);
    setSelectedIdx(-1);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!suggestions.length) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      select(suggestions[selectedIdx >= 0 ? selectedIdx : 0]);
    } else if (e.key === 'Enter') {
      // Confirm current value, close suggestions
      e.preventDefault();
      setSuggestions([]);
      setSelectedIdx(-1);
    } else if (e.key === 'ArrowRight') {
      if (suggestions.length > 0) {
        e.preventDefault();
        const i = (selectedIdx + 1) % suggestions.length;
        setSelectedIdx(i);
        select(suggestions[i]);
      }
    } else if (e.key === 'ArrowLeft') {
      if (suggestions.length > 0) {
        e.preventDefault();
        const i = selectedIdx <= 0 ? suggestions.length - 1 : selectedIdx - 1;
        setSelectedIdx(i);
        select(suggestions[i]);
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          className="w-full h-9 px-3 pr-8 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 text-right placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E] transition-all duration-200 font-medium"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={onKey}
          placeholder="0"
          autoComplete="off"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">d</span>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((a, i) => (
            <button
              key={a}
              type="button"
              onClick={() => select(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                i === selectedIdx
                  ? 'bg-[#22C55E] text-white border-transparent shadow-sm'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#22C55E] hover:bg-green-50'
              }`}
            >
              {a.toLocaleString('vi-VN')}
            </button>
          ))}
          <span className="text-[10px] text-gray-400 self-center ml-1">Tab/←→</span>
        </div>
      )}
    </div>
  );
}

// ─── Date Picker ────────────────────────────────────────────────────────────
interface DatePickerProps {
  value: RecordValue;
  onChange: (v: RecordValue) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const handlePrev = () => {
    const d = new Date(String(value || new Date().toISOString().slice(0, 10)));
    d.setDate(d.getDate() - 1);
    onChange(d.toISOString().slice(0, 10));
  };

  const handleNext = () => {
    const d = new Date(String(value || new Date().toISOString().slice(0, 10)));
    d.setDate(d.getDate() + 1);
    onChange(d.toISOString().slice(0, 10));
  };

  return (
    <div className="flex items-center h-9 rounded-lg border border-[#E5E7EB] bg-white overflow-hidden transition-all duration-200 focus-within:ring-2 focus-within:ring-[#22C55E]/30 focus-within:border-[#22C55E]">
      <button
        type="button"
        onClick={handlePrev}
        tabIndex={-1}
        className="px-2.5 h-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors duration-200"
      >
        <Icon name="chevron-left" size={14} />
      </button>
      <div className="flex-1 flex items-center px-2 gap-2">
        <Icon name="calendar" size={14} className="text-gray-400" />
        <input
          type="date"
          className="flex-1 h-full text-sm text-gray-900 bg-transparent border-0 focus:outline-none"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={handleNext}
        tabIndex={-1}
        className="px-2.5 h-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors duration-200"
      >
        <Icon name="chevron-right" size={14} />
      </button>
    </div>
  );
}

// ─── Type Segmented (Chi / Thu) ─────────────────────────────────────────────
interface TypeSegmentedProps {
  value: RecordValue;
  onChange: (v: RecordValue) => void;
  options: Array<{ id: string; label: string; value: string; color?: string; isActive: boolean; sortOrder: number }>;
}

export function TypeSegmented({ value, onChange, options }: TypeSegmentedProps) {
  const activeOpts = options.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedIdx = activeOpts.findIndex((o) => o.value === value);

  return (
    <div className="relative flex h-9 rounded-lg border border-[#E5E7EB] bg-gray-50 p-1 overflow-hidden">
      {/* Sliding indicator */}
      {selectedIdx >= 0 && (
        <div
          className="absolute top-1 bottom-1 rounded-lg transition-all duration-200 ease-in-out"
          style={{
            left: `calc(${(selectedIdx / activeOpts.length) * 100}% + 4px)`,
            width: `calc(${100 / activeOpts.length}% - 8px)`,
            backgroundColor: activeOpts[selectedIdx]?.color || '#EF4444',
          }}
        />
      )}
      {activeOpts.map((opt) => (
        <button
          key={opt.id}
          type="button"
          tabIndex={-1}
          onClick={() => onChange(opt.value)}
          className={`relative z-10 flex-1 flex items-center justify-center text-sm font-medium rounded-lg transition-colors duration-200 ${
            value === opt.value ? 'text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Account Select ─────────────────────────────────────────────────────────
interface AccountSelectProps {
  value: RecordValue;
  onChange: (v: RecordValue) => void;
  options: Array<{ id: string; label: string; value: string; isActive: boolean }>;
}

export function AccountSelect({ value, onChange, options }: AccountSelectProps) {
  return (
    <div className="relative">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
        <Icon name="wallet" size={16} />
      </div>
      <select
        className="w-full h-9 pl-8 pr-8 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E] transition-all duration-200 cursor-pointer"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- Chon --</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <Icon name="chevron-down" size={14} />
      </div>
    </div>
  );
}

// ─── Category Buttons ───────────────────────────────────────────────────────
interface CategoryButtonsProps {
  categories: CategoryDefinition[];
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
}

export function CategoryButtons({ categories, selectedId, onSelect }: CategoryButtonsProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleCategories = expanded ? categories : categories.slice(0, 5);

  return (
    <div className="flex flex-wrap gap-2">
      {visibleCategories.map((cat) => {
        const isSelected = selectedId === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(isSelected ? undefined : cat.id)}
            className={`inline-flex items-center gap-2 h-10 px-3 rounded-lg border-2 text-xs font-medium transition-all duration-200 hover:shadow-md ${
              isSelected
                ? 'border-[#22C55E] bg-green-50/80 text-green-700 shadow-sm'
                : 'border-[#E5E7EB] bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            <Icon name={cat.icon || 'more-horizontal'} size={14} color={isSelected ? '#22C55E' : cat.color || '#64748b'} />
            <span>{cat.name}</span>
          </button>
        );
      })}
      {categories.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border-2 border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all duration-200"
        >
          {expanded ? 'Thu gon' : `+${categories.length - 5}`}
        </button>
      )}
    </div>
  );
}

// ─── Main BasicForm Section ─────────────────────────────────────────────────
interface BasicFormProps {
  // Field values
  titleValue: RecordValue;
  amountValue: RecordValue;
  dateValue: RecordValue;
  typeValue: RecordValue;
  accountValue: RecordValue;
  // Category
  categories: CategoryDefinition[];
  selectedCategoryId: string | undefined;
  // Options
  typeOptions: Array<{ id: string; label: string; value: string; color?: string; isActive: boolean; sortOrder: number }>;
  accountOptions: Array<{ id: string; label: string; value: string; isActive: boolean }>;
  // Callbacks
  onTitleChange: (v: RecordValue) => void;
  onAmountChange: (v: RecordValue) => void;
  onDateChange: (v: RecordValue) => void;
  onTypeChange: (v: RecordValue) => void;
  onAccountChange: (v: RecordValue) => void;
  onCategorySelect: (id: string | undefined) => void;
  // Misc
  moduleId: string;
  getSuggestions: (moduleId: string, query: string) => string[];
  errors: Record<string, string>;
  titleFieldId?: string;
  amountFieldId?: string;
  dateFieldId?: string;
  typeFieldId?: string;
  accountFieldId?: string;
}

export function BasicForm({
  titleValue, amountValue, dateValue, typeValue, accountValue,
  categories, selectedCategoryId,
  typeOptions, accountOptions,
  onTitleChange, onAmountChange, onDateChange, onTypeChange, onAccountChange, onCategorySelect,
  moduleId, getSuggestions, errors,
  titleFieldId, amountFieldId, dateFieldId, typeFieldId, accountFieldId,
}: BasicFormProps) {
  return (
    <div className="bg-white border border-[#E8EDF5] rounded-xl p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <h3 className="text-xs font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
        Thong tin co ban
      </h3>

      {/* Row 1: Title + Amount */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-3 mb-3">
        <FormField label="Ten giao dich" required error={titleFieldId ? errors[titleFieldId] : undefined}>
          <TitleInput
            moduleId={moduleId}
            value={titleValue}
            onChange={onTitleChange}
            placeholder="Nhap ten giao dich..."
            autoFocus
            getSuggestions={getSuggestions}
          />
        </FormField>

        <FormField label="So tien" required error={amountFieldId ? errors[amountFieldId] : undefined}>
          <MoneyInput value={amountValue} onChange={onAmountChange} />
        </FormField>
      </div>

      {/* Row 2: Date + Type + Account */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <FormField label="Ngay" required error={dateFieldId ? errors[dateFieldId] : undefined}>
          <DatePicker value={dateValue} onChange={onDateChange} />
        </FormField>

        <FormField label="Loai" required error={typeFieldId ? errors[typeFieldId] : undefined}>
          <TypeSegmented value={typeValue} onChange={onTypeChange} options={typeOptions} />
        </FormField>

        <FormField label="Tai khoan" required error={accountFieldId ? errors[accountFieldId] : undefined}>
          <AccountSelect value={accountValue} onChange={onAccountChange} options={accountOptions} />
        </FormField>
      </div>

      {/* Row 3: Categories */}
      {categories.length > 0 && (
        <FormField label="Danh muc" required>
          <CategoryButtons
            categories={categories}
            selectedId={selectedCategoryId}
            onSelect={onCategorySelect}
          />
        </FormField>
      )}
    </div>
  );
}
