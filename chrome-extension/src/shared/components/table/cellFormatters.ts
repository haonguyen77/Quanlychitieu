import type { FieldDefinition, RecordValue } from '@/types';

/**
 * Format a cell value for display based on field type.
 */
export function formatCellValue(value: RecordValue, field: FieldDefinition): string {
  if (value === null || value === undefined) return '—';

  switch (field.fieldType) {
    case 'money':
      return formatMoney(Number(value));

    case 'number':
      return Number(value).toLocaleString('vi-VN');

    case 'date':
      return formatDate(String(value));

    case 'datetime':
      return formatDateTime(String(value));

    case 'dropdown':
    case 'radio': {
      const option = field.options?.find((opt) => opt.value === value);
      return option?.label ?? String(value);
    }

    case 'multiselect': {
      if (Array.isArray(value)) {
        return value
          .map((v) => field.options?.find((opt) => opt.value === v)?.label ?? v)
          .join(', ');
      }
      return String(value);
    }

    case 'checkbox':
    case 'switch':
      return value ? '✓' : '✗';

    case 'rating':
      return '★'.repeat(Number(value)) + '☆'.repeat(5 - Number(value));

    case 'tag':
      return Array.isArray(value) ? value.join(', ') : String(value);

    case 'color':
      return String(value);

    case 'phone':
    case 'email':
    case 'link':
    case 'text':
    case 'textarea':
    default:
      return String(value);
  }
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
