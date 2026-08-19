import { useMemo } from 'react';
import { useRecordStore, type DatePreset } from '@/core/store/recordStore';
import { TimeFilter } from '@/shared/components/ui/TimeFilter';
import type { ModuleDefinition, DataRecord } from '@/types';

interface ModuleStatsProps {
  module: ModuleDefinition;
  records: DataRecord[];
}

export function ModuleStats({ module, records }: ModuleStatsProps) {
  const { dateFrom, dateTo, datePreset, setDateRange, setDatePresetForModule, filterCategory, setFilterCategory } = useRecordStore();

  const stats = useMemo(() => {
    const amountField = module.fields.find(
      (f) => f.fieldType === 'money' && (f.fieldName === 'amount' || f.fieldName === 'total_amount')
    );
    const typeField = module.fields.find(
      (f) => f.fieldName === 'type' && f.fieldType === 'dropdown'
    );

    if (!amountField) {
      return { totalRecords: records.length, totalAmount: 0, income: 0, expense: 0 };
    }

    let income = 0;
    let expense = 0;

    for (const record of records) {
      const amount = Number(record.values[amountField.id] ?? 0);
      if (typeField) {
        const type = record.values[typeField.id];
        if (type === '1' || type === 'income' || type === 'thu') {
          income += amount;
        } else {
          expense += amount;
        }
      } else {
        expense += amount;
      }
    }

    return {
      totalRecords: records.length,
      totalAmount: income - expense,
      income,
      expense,
    };
  }, [records, module.fields]);

  const formatMoney = (amount: number) => {
    return Math.abs(amount).toLocaleString('vi-VN') + ' ₫';
  };

  const handlePresetChange = (preset: DatePreset) => {
    setDatePresetForModule(preset, module.id);
  };

  return (
    <div className="px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
      <div className="flex items-center justify-between">
        {/* Stats */}
        <div className="flex items-center gap-5">
          {stats.expense > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-[var(--color-text-secondary)]">Chi:</span>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                {formatMoney(stats.expense)}
              </span>
            </div>
          )}
          {stats.income > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-[var(--color-text-secondary)]">Thu:</span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                {formatMoney(stats.income)}
              </span>
            </div>
          )}
          {stats.income > 0 && stats.expense > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs text-[var(--color-text-secondary)]">Số dư:</span>
              <span className={`text-sm font-semibold ${stats.totalAmount >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.totalAmount >= 0 ? '' : '-'}{formatMoney(stats.totalAmount)}
              </span>
            </div>
          )}
          <span className="text-xs text-[var(--color-text-secondary)]">
            {stats.totalRecords} bản ghi
          </span>
        </div>

        {/* Active category filter indicator */}
        {filterCategory && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <span className="text-[10px] text-amber-700 dark:text-amber-300">
              Đang lọc: {module.categories?.find((c) => c.id === filterCategory)?.name || 'Danh mục'}
            </span>
            <button onClick={() => setFilterCategory(null)} className="text-amber-600 hover:text-amber-800 ml-1" title="Xóa bộ lọc">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}

        {/* Date filter */}
        <TimeFilter
          datePreset={datePreset}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onPresetChange={handlePresetChange}
          onDateRangeChange={setDateRange}
          presets={['week', 'month', 'year', 'all']}
        />
      </div>
    </div>
  );
}
