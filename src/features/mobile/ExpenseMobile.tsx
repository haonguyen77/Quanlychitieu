import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { TransactionDetailMobile } from './TransactionDetailMobile';
import { Search, X, SlidersHorizontal, TrendingDown, TrendingUp } from 'lucide-react';
import type { DataRecord } from '@/types';

/**
 * Mobile Expense List — Card-based, grouped by date, with search + filter.
 * Design reference: Android App "Chi tiêu" screen.
 */
export function ExpenseMobile() {
  const { data } = useAppStore();
  const { push } = useMobileNav();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filterModule, setFilterModule] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);

  const allTransactions = useMemo(() => {
    if (!data) return [];
    return data.records
      .filter(r => !r.isDeleted && r.moduleId === 'mod_chitieu')
      .map(r => {
        const titleKey = Object.keys(r.values).find(k => k.endsWith('_title'));
        const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount'));
        const typeKey = Object.keys(r.values).find(k => k.endsWith('_type'));
        const dateKey = Object.keys(r.values).find(k => k.endsWith('_date'));
        return {
          record: r,
          title: titleKey ? String(r.values[titleKey] ?? '') : '—',
          amount: amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0,
          type: typeKey ? String(r.values[typeKey] ?? '0') : '0',
          date: dateKey ? String(r.values[dateKey] ?? '') : r.createdAt?.slice(0, 10) || '',
          linkedModule: r.linkedModuleId || '',
        };
      })
      .filter(t => t.type !== '2')
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  // Apply search + filter
  const filtered = useMemo(() => {
    let result = allTransactions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }
    if (filterModule) {
      result = result.filter(t => t.linkedModule === filterModule || (!t.linkedModule && filterModule === 'mod_chitieu'));
    }
    return result;
  }, [allTransactions, searchQuery, filterModule]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const day = t.date.slice(0, 10);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(t);
    }
    return Array.from(groups.entries()).map(([date, txns]) => ({ date, txns }));
  }, [filtered]);

  const totalExpense = filtered.filter(t => t.type !== '1').reduce((s, t) => s + t.amount, 0);
  const totalIncome = filtered.filter(t => t.type === '1').reduce((s, t) => s + t.amount, 0);

  const fmtMoney = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
    if (n >= 1000) return `${Math.round(n / 1000).toLocaleString('vi-VN')}K`;
    return n.toLocaleString('vi-VN');
  };

  const fmtDate = (d: string) => {
    try {
      const date = new Date(d);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
      return `${weekday}, ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
    } catch { return d; }
  };

  const openDetail = (record: DataRecord) => {
    push({ id: `detail-${record.id}`, component: <TransactionDetailMobile record={record} /> });
  };

  const activeModules = data?.modules.filter(m => m.isActive && m.isVisible !== false) || [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Chi tiêu</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowSearch(!showSearch)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${showSearch ? 'bg-primary-50' : 'bg-gray-50'}`}>
            <Search size={18} className={showSearch ? 'text-primary-500' : 'text-gray-500'} />
          </button>
          <button onClick={() => setShowFilter(!showFilter)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${filterModule ? 'bg-primary-50' : 'bg-gray-50'}`}>
            <SlidersHorizontal size={18} className={filterModule ? 'text-primary-500' : 'text-gray-500'} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm giao dịch..."
              autoFocus
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-primary-500 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter chips */}
      {showFilter && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterModule(null)}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${!filterModule ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >Tất cả</button>
          {activeModules.map(m => (
            <button
              key={m.id}
              onClick={() => setFilterModule(m.id === filterModule ? null : m.id)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${filterModule === m.id ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >{m.name}</button>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="px-4 py-2">
        <div className="flex gap-3">
          <div className="flex-1 bg-red-50 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown size={14} className="text-red-500" />
              <span className="text-[10px] text-gray-500">Tổng chi</span>
            </div>
            <p className="text-base font-bold text-red-600">{fmtMoney(totalExpense)}₫</p>
          </div>
          <div className="flex-1 bg-green-50 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={14} className="text-green-500" />
              <span className="text-[10px] text-gray-500">Tổng thu</span>
            </div>
            <p className="text-base font-bold text-green-600">{fmtMoney(totalIncome)}₫</p>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-auto px-4 pb-24 space-y-4">
        {grouped.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">{searchQuery || filterModule ? 'Không tìm thấy' : 'Chưa có giao dịch'}</p>
          </div>
        ) : (
          grouped.map(({ date, txns }) => {
            const dayTotal = txns.reduce((s, t) => s + (t.type === '1' ? t.amount : -t.amount), 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-medium text-gray-500">{fmtDate(date)}</span>
                  <span className={`text-xs font-semibold ${dayTotal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {dayTotal >= 0 ? '+' : ''}{fmtMoney(Math.abs(dayTotal))}₫
                  </span>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                  {txns.map(t => (
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
                      </div>
                      <span className={`text-sm font-semibold tabular-nums ${t.type === '1' ? 'text-green-600' : 'text-red-600'}`}>
                        {fmtMoney(t.amount)}₫
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
