import { useState } from 'react';
import type { FieldDefinition, RecordValue } from '@/types';

interface FieldRendererProps {
  field: FieldDefinition;
  value: RecordValue;
  onChange: (value: RecordValue) => void;
  error?: string;
}

/**
 * Field Renderer
 * 
 * Renders the correct input component based on the field's type.
 * Supports all 18+ field types defined in the schema.
 */
export function FieldRenderer({ field, value, onChange, error }: FieldRendererProps) {
  const baseClass = `input-field ${error ? 'border-red-500 focus:ring-red-500' : ''}`;

  switch (field.fieldType) {
    case 'text':
    case 'phone':
    case 'email':
    case 'link':
      return (
        <input
          type={field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : field.fieldType === 'link' ? 'url' : 'text'}
          className={baseClass}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || `Nhập ${field.fieldLabel.toLowerCase()}...`}
        />
      );

    case 'textarea':
      return (
        <textarea
          className={`${baseClass} resize-none`}
          rows={3}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || `Nhập ${field.fieldLabel.toLowerCase()}...`}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          className={baseClass}
          value={value !== null && value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={field.placeholder || '0'}
          min={field.validation?.min}
          max={field.validation?.max}
        />
      );

    case 'money':
      return <MoneyInput value={value} onChange={onChange} field={field} error={error} />;

    case 'date':
      return (
        <input
          type="date"
          className={baseClass}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'datetime':
      return (
        <input
          type="datetime-local"
          className={baseClass}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'dropdown':
      return (
        <select
          className={baseClass}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">-- Chọn --</option>
          {field.options
            ?.filter((opt) => opt.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((opt) => (
              <option key={opt.id} value={opt.value}>
                {opt.label}
              </option>
            ))}
        </select>
      );

    case 'multiselect':
      return <MultiSelectInput field={field} value={value} onChange={onChange} />;

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--color-border)]"
          />
          <span className="text-sm text-[var(--color-text)]">{field.fieldLabel}</span>
        </label>
      );

    case 'switch':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-10 h-5 rounded-full transition-colors ${
                value ? 'bg-[var(--color-primary)]' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                value ? 'translate-x-5' : ''
              }`}
            />
          </div>
          <span className="text-sm text-[var(--color-text)]">{field.placeholder || ''}</span>
        </label>
      );

    case 'radio':
      return (
        <div className="flex flex-wrap gap-3">
          {field.options
            ?.filter((opt) => opt.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((opt) => (
              <label key={opt.id} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={() => onChange(opt.value)}
                  className="w-3.5 h-3.5"
                />
                <span className="text-sm text-[var(--color-text)]">{opt.label}</span>
              </label>
            ))}
        </div>
      );

    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(value ?? '#3b82f6')}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-[var(--color-border)]"
          />
          <input
            type="text"
            className={baseClass}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#3b82f6"
          />
        </div>
      );

    case 'rating':
      return <RatingInput value={value} onChange={onChange} />;

    case 'tag':
      return <TagInput value={value} onChange={onChange} field={field} />;

    case 'image':
    case 'file':
      return (
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept={field.fieldType === 'image' ? 'image/*' : undefined}
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              onChange(files.map((f) => f.name));
            }}
            className="text-sm text-[var(--color-text-secondary)] file:mr-2 file:px-3 file:py-1 file:rounded file:border-0 file:text-xs file:bg-[var(--color-primary)] file:text-white"
          />
        </div>
      );

    default:
      return (
        <input
          type="text"
          className={baseClass}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      );
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MoneyInput({
  value,
  onChange,
  field,
  error,
}: {
  value: RecordValue;
  onChange: (v: RecordValue) => void;
  field: FieldDefinition;
  error?: string;
}) {
  const [displayValue, setDisplayValue] = useState(() => {
    if (value === null || value === undefined) return '';
    return Number(value).toLocaleString('vi-VN');
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (raw === '') {
      setDisplayValue('');
      onChange(null);
    } else {
      const num = parseInt(raw, 10);
      setDisplayValue(num.toLocaleString('vi-VN'));
      onChange(num);
    }
  };

  const baseClass = `input-field ${error ? 'border-red-500' : ''}`;

  return (
    <div className="relative">
      <input
        type="text"
        className={`${baseClass} pr-8`}
        value={displayValue}
        onChange={handleChange}
        placeholder={field.placeholder || '0'}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-secondary)]">
        ₫
      </span>
    </div>
  );
}

function MultiSelectInput({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: RecordValue;
  onChange: (v: RecordValue) => void;
}) {
  const selected = Array.isArray(value) ? value : [];
  const options = field.options?.filter((opt) => opt.isActive).sort((a, b) => a.sortOrder - b.sortOrder) || [];

  const toggle = (optValue: string) => {
    if (selected.includes(optValue)) {
      onChange(selected.filter((s) => s !== optValue));
    } else {
      onChange([...selected, optValue]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`px-2 py-1 rounded-full text-xs border transition-colors ${
            selected.includes(opt.value)
              ? 'bg-[var(--color-primary)] text-white border-transparent'
              : 'bg-transparent text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RatingInput({ value, onChange }: { value: RecordValue; onChange: (v: RecordValue) => void }) {
  const rating = Number(value ?? 0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === rating ? 0 : star)}
          className={`text-lg ${star <= rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function TagInput({
  value,
  onChange,
  field,
}: {
  value: RecordValue;
  onChange: (v: RecordValue) => void;
  field: FieldDefinition;
}) {
  const [inputValue, setInputValue] = useState('');
  const tags = Array.isArray(value) ? value : [];

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInputValue('');
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)]"
          >
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        className="input-field"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={field.placeholder || 'Nhập tag và Enter...'}
      />
    </div>
  );
}
