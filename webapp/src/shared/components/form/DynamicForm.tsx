import { useState, useCallback } from 'react';
import type { FieldDefinition, RecordValues, RecordValue } from '@/types';
import { FieldRenderer } from './FieldRenderer';

interface DynamicFormProps {
  fields: FieldDefinition[];
  initialValues?: RecordValues;
  onSubmit: (values: RecordValues) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

/**
 * Dynamic Form Engine
 * 
 * Renders a form based on field definitions (metadata).
 * Supports all 18+ field types.
 * No hardcoded fields - everything is driven by the module's field configuration.
 */
export function DynamicForm({
  fields,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Lưu',
}: DynamicFormProps) {
  const [values, setValues] = useState<RecordValues>(() => {
    const defaults: RecordValues = {};
    for (const field of fields) {
      if (field.isVisible) {
        defaults[field.id] = initialValues[field.id] ?? field.defaultValue ?? null;
      }
    }
    return defaults;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((fieldId: string, value: RecordValue) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error on change
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of fields) {
      if (!field.isVisible) continue;
      if (field.isRequired) {
        const val = values[field.id];
        if (val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
          newErrors[field.id] = `${field.fieldLabel} là bắt buộc`;
        }
      }

      // Type-specific validation
      if (field.validation && values[field.id] != null) {
        const val = values[field.id];
        if (field.validation.min !== undefined && Number(val) < field.validation.min) {
          newErrors[field.id] = `Giá trị tối thiểu là ${field.validation.min}`;
        }
        if (field.validation.max !== undefined && Number(val) > field.validation.max) {
          newErrors[field.id] = `Giá trị tối đa là ${field.validation.max}`;
        }
        if (field.validation.minLength !== undefined && String(val).length < field.validation.minLength) {
          newErrors[field.id] = `Tối thiểu ${field.validation.minLength} ký tự`;
        }
        if (field.validation.maxLength !== undefined && String(val).length > field.validation.maxLength) {
          newErrors[field.id] = `Tối đa ${field.validation.maxLength} ký tự`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(values);
    }
  };

  const visibleFields = fields
    .filter((f) => f.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {visibleFields.map((field) => (
        <div key={field.id} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">
            {field.fieldLabel}
            {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <FieldRenderer
            field={field}
            value={values[field.id]}
            onChange={(value) => handleChange(field.id, value)}
            error={errors[field.id]}
          />
          {errors[field.id] && (
            <span className="text-xs text-red-500">{errors[field.id]}</span>
          )}
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn-primary flex-1">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Hủy
          </button>
        )}
      </div>
    </form>
  );
}
