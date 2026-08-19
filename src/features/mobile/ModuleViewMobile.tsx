import { useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { TransactionDetailMobile } from './TransactionDetailMobile';
import { ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react';
import type { ModuleDefinition } from '@/types';

interface Props {
  module: ModuleDefinition;
}

/**
 * Mobile Module View — shows transactions for a specific module.
 * Reuses same data from shared store.
 */
export function ModuleViewMobile({ module }: Props) {
  const { pop, push } = useMobileNav();
  const { data } = useAppStore();

  const transactions = useMemo(() => {
    if (!data) return [];
    return data.records
      .filter(r => !r.isDeleted && (r.moduleId === module.id || r.linkedModuleId === module.id))
      .map(r => {
        const titleKey = Object.keys(r.values).find(k => k.endsWith('_title') || k.endsWith('_order_name'));
        const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount') && !k.endsWith('_total_amount'));
        const typeKey = Object.keys(r.values).find(k => k.endsWith('_type'));
        const dateKey = Object.keys(r.values).find(k => k.endsWith('_date'));
        return {
          record: r,
          title: titleKey ? String(r.values[titleKey] ?? '') : '—',
          amount: amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0,
          type: typeKey ? String(r.values[typeKey] ?? '0') : '0',
          date: dateKey ? String(r.values[dateKey] ?? '') : r.createdAt?.slice(0, 10) || '',
        };
      })
      .filter(t => t.type !== '2')
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, module.id]);

  const fmtMoney = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M₫`;
    if (n >= 1000) return `${Math.round(n / 1000)}K₫`;
    return `${n.toLocaleString('vi-VN')}₫`;
  };

  const openDetail = (record: typeof transactions[0]['record']) => {
    push({ id: `detail-${record.id}`, component: <TransactionDetailMobile record={record} /> });
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h2 className="text-base font-semibold text-gray-900">{module.name}</h2>
        <span className="text-xs text-gray-400 ml-auto">{transactions.length} bản ghi</span>
      </header>

      {/* List */}
      <div className="flex-1 overflow-auto px-4 py-3 pb-20">
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">Chưa có giao dịch</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {transactions.map(t => (
              <button
                key={t.record.id}
                onClick={() => openDetail(t.record)}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 text-left"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === '1' ? 'bg-green-50' : 'bg-red-50'}`}>
                  {t.type === '1' ? <TrendingUp size={18} className="text-green-500" /> : <TrendingDown size={18} className="text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                  <p className="text-[10px] text-gray-400">{t.date}</p>
                </div>
                <span className={`text-sm font-semibold ${t.type === '1' ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtMoney(t.amount)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
