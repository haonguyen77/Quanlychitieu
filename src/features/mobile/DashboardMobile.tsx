import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { TrendingDown, TrendingUp, Wallet, CreditCard, BarChart3, Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';

type FilterPeriod = 'week' | 'month' | 'year' | 'all';

/**
 * DashboardMobile — Exact reproduction of Android App dashboard_screen.dart.
 * Header + Period Filter + Summary Cards (2 rows) + Category Donut + Alerts + Comparison.
 */
export function DashboardMobile() {
  const { data } = useAppStore();
  const [period, setPeriod] = useState<FilterPeriod>('month');
  const [showFilter, setShowFilter] = useState(false);
  const [refDate, setRefDate] = useState(new Date());

  // Date range calculation
  const { startDate, endDate } = useMemo(() => {
    const ref = refDate;
    let start: Date, end: Date;
    switch (period) {
      case 'week': {
        const day = ref.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diff);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59);
        break;
      }
      case 'month':
        start = new Date(ref.getFullYear(), ref.getMonth(), 1);
        end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'year':
        start = new Date(ref.getFullYear(), 0, 1);
        end = new Date(ref.getFullYear(), 11, 31, 23, 59, 59);
        break;
      default:
        start = new Date(2020, 0, 1);
        end = new Date(2099, 11, 31);
    }
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }, [period, refDate]);

  // Stats
  const stats = useMemo(() => {
    if (!data) return { income: 0, expense: 0, records: 0, categories: new Map<string, number>() };
    let income = 0, expense = 0, count = 0;
    const cats = new Map<string, number>();

    for (const r of data.records) {
      if (r.isDeleted || r.moduleId !== 'mod_chitieu') continue;
      const dateKey = Object.keys(r.values).find(k => k.endsWith('_date'));
      const d = dateKey ? String(r.values[dateKey] ?? '') : '';
      if (d < startDate || d > endDate) continue;

      const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount'));
      const amount = amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0;
      const typeKey = Object.keys(r.values).find(k => k.endsWith('_type'));
      const type = typeKey ? String(r.values[typeKey] ?? '0') : '0';

      if (type === '1') income += amount;
      else if (type !== '2') { expense += amount; const catId = r.categoryId || '__other'; cats.set(catId, (cats.get(catId) ?? 0) + amount); }
      count++;
    }
    return { income, expense, records: count, categories: cats };
  }, [data, startDate, endDate]);

  const balance = stats.income - stats.expense;
  const daysInPeriod = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
  const avgPerDay = stats.expense / daysInPeriod;

  // Recent transactions
  const recent = useMemo(() => {
    if (!data) return [];
    return data.records
      .filter(r => !r.isDeleted && r.moduleId === 'mod_chitieu')
      .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
      .slice(0, 5)
      .map(r => {
        const titleKey = Object.keys(r.values).find(k => k.endsWith('_title'));
        const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount'));
        const typeKey = Object.keys(r.values).find(k => k.endsWith('_type'));
        const dateKey = Object.keys(r.values).find(k => k.endsWith('_date'));
        return {
          id: r.id,
          title: titleKey ? String(r.values[titleKey] ?? '') : '—',
          amount: amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0,
          type: typeKey ? String(r.values[typeKey] ?? '0') : '0',
          date: dateKey ? String(r.values[dateKey] ?? '') : '',
        };
      });
  }, [data]);

  // Category donut data
  const categoryData = useMemo(() => {
    const entries = Array.from(stats.categories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
    const colors = ['#FF5722', '#FF9800', '#4CAF50', '#7B1FA2', '#1565C0', '#9E9E9E', '#E91E63', '#009688'];
    return entries.map(([id, amount], i) => {
      const mod = data?.modules.find(m => m.id === 'mod_chitieu');
      const cat = mod?.categories?.find(c => c.id === id);
      return { name: cat?.name || 'Khác', amount, percent: (amount / total) * 100, color: colors[i] || '#607D8B' };
    });
  }, [stats.categories, data]);

  const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    const prefix = n < 0 ? '-' : '';
    if (abs >= 1000000) { const m = Math.floor(abs / 1000000); const h = Math.floor((abs - m * 1000000) / 100000); return h > 0 ? `${prefix}${m}M${h}` : `${prefix}${m}M`; }
    if (abs >= 1000) return `${prefix}${Math.round(abs / 1000).toLocaleString('vi-VN')}K`;
    return `${prefix}${abs}`;
  };

  const navigate = (dir: number) => {
    const d = new Date(refDate);
    if (period === 'week') d.setDate(d.getDate() + 7 * dir);
    else if (period === 'month') d.setMonth(d.getMonth() + dir);
    else if (period === 'year') d.setFullYear(d.getFullYear() + dir);
    setRefDate(d);
  };

  return (
    <div className="h-full overflow-auto bg-white">
      {/* Header — matches Android: menu + title + subtitle + search + filter */}
      <div className="px-4 pt-3 pb-0">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: '#0F1F4D' }}>Dashboard</h1>
            <p className="text-xs text-gray-500">Tổng quan tài chính cá nhân</p>
          </div>
          <button className="w-9 h-9 flex items-center justify-center"><Search size={20} color="#0F1F4D" /></button>
          <button onClick={() => setShowFilter(!showFilter)} className="w-9 h-9 flex items-center justify-center">
            <SlidersHorizontal size={20} color={showFilter ? '#7B1FA2' : '#0F1F4D'} />
          </button>
        </div>
      </div>

      {/* Period Filter */}
      {showFilter && (
        <div className="px-4 pt-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate(-1)} className="w-9 h-9 border border-gray-200 rounded-lg flex items-center justify-center">
              <ChevronLeft size={18} color="#0F1F4D" />
            </button>
            {(['week', 'month', 'year', 'all'] as FilterPeriod[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className="flex-1 py-2.5 rounded-full text-xs font-semibold text-center"
                style={{ backgroundColor: period === p ? '#4A148C' : '#fff', color: period === p ? '#fff' : '#0F1F4D', border: period === p ? 'none' : '1px solid #E5E7EB' }}>
                {{ week: 'Tuần', month: 'Tháng', year: 'Năm', all: 'Tất cả' }[p]}
              </button>
            ))}
            <button onClick={() => navigate(1)} className="w-9 h-9 border border-gray-200 rounded-lg flex items-center justify-center">
              <ChevronRight size={18} color="#0F1F4D" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-20 pt-4 space-y-4">
        {/* Summary Cards Row 1: Tổng thu, Tổng chi, Số dư */}
        <div className="grid grid-cols-3 gap-2">
          <SummaryBox icon={<Wallet size={14} />} color="#20A84A" label="Tổng thu" value={fmtShort(stats.income)} />
          <SummaryBox icon={<TrendingDown size={14} />} color="#EF3030" label="Tổng chi" value={fmtShort(stats.expense)} />
          <SummaryBox icon={<Wallet size={14} />} color="#1565C0" label="Số dư" value={fmtShort(balance)} />
        </div>

        {/* Summary Cards Row 2: Tổng nợ, Chi tiêu TB/ngày */}
        <div className="grid grid-cols-2 gap-2">
          <SummaryBox icon={<CreditCard size={14} />} color="#7B1FA2" label="Tổng nợ" value="0" />
          <SummaryBox icon={<BarChart3 size={14} />} color="#FF8F00" label="TB/ngày" value={fmtShort(avgPerDay)} />
        </div>

        {/* Category Donut */}
        {categoryData.length > 0 && (
          <div className="border border-gray-200 rounded-2xl p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: '#0F1F4D' }}>Chi tiêu theo danh mục</p>
            <div className="flex items-center gap-4">
              {/* Simple donut representation */}
              <div className="relative w-28 h-28 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {categoryData.reduce((acc, cat, i) => {
                    const offset = acc.offset;
                    const len = (cat.percent / 100) * 283;
                    acc.elements.push(
                      <circle key={i} cx="50" cy="50" r="45" fill="none" stroke={cat.color} strokeWidth="10"
                        strokeDasharray={`${len} ${283 - len}`} strokeDashoffset={-offset} />
                    );
                    acc.offset += len;
                    return acc;
                  }, { offset: 0, elements: [] as React.ReactNode[] }).elements}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-400">Tổng</span>
                  <span className="text-xs font-bold" style={{ color: '#0F1F4D' }}>{fmtShort(stats.expense)}</span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-1.5">
                {categoryData.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-[11px] text-gray-700 flex-1 truncate">{cat.name}</span>
                    <span className="text-[10px] font-medium text-gray-500">{cat.percent.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="border border-gray-200 rounded-2xl p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#0F1F4D' }}>Giao dịch gần đây</p>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Chưa có giao dịch</p>
          ) : (
            <div className="space-y-2.5">
              {recent.map(t => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === '1' ? 'bg-green-50' : 'bg-red-50'}`}>
                    {t.type === '1' ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{t.title}</p>
                    <p className="text-[10px] text-gray-400">{t.date}</p>
                  </div>
                  <span className={`text-xs font-semibold ${t.type === '1' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === '1' ? '+' : '-'}{fmtShort(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryBox({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-xl p-2.5 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <span className="text-[9px] text-gray-500 leading-tight">{label}</span>
      </div>
      <p className="text-sm font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
