import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { ArrowLeft, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { getRecordField, formatMoney, getCategoryDisplay } from './mobileDataMapper';

type Period = 'week' | 'month' | 'year' | 'all';

export function ReportsMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const [period, setPeriod] = useState<Period>('month');
  const [refDate, setRefDate] = useState(new Date());

  const { startDate, endDate } = useMemo(() => {
    const ref = refDate;
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    switch (period) {
      case 'week': { const day = ref.getDay(); const diff = day === 0 ? -6 : 1 - day; const s = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diff); return { startDate: fmt(s), endDate: fmt(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6)) }; }
      case 'month': return { startDate: fmt(new Date(ref.getFullYear(), ref.getMonth(), 1)), endDate: fmt(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)) };
      case 'year': return { startDate: `${ref.getFullYear()}-01-01`, endDate: `${ref.getFullYear()}-12-31` };
      default: return { startDate: '2020-01-01', endDate: '2099-12-31' };
    }
  }, [period, refDate]);

  const stats = useMemo(() => {
    if (!data) return { income: 0, expense: 0, catMap: new Map<string, number>(), topTxns: [] as { title: string; amount: number }[] };
    let income = 0, expense = 0;
    const catMap = new Map<string, number>();
    const txns: { title: string; amount: number }[] = [];

    for (const r of data.records) {
      if (r.isDeleted || r.moduleId !== 'mod_chitieu') continue;
      const d = getRecordField(r, 'date');
      if (d < startDate || d > endDate) continue;
      const amt = Math.abs(Number(getRecordField(r, 'amount')) || 0);
      const type = getRecordField(r, 'type');
      if (type === '1') { income += amt; }
      else if (type !== '2') {
        expense += amt;
        const catId = r.categoryId || '__other';
        catMap.set(catId, (catMap.get(catId) ?? 0) + amt);
        txns.push({ title: getRecordField(r, 'title') || '—', amount: amt });
      }
    }
    txns.sort((a, b) => b.amount - a.amount);
    return { income, expense, catMap, topTxns: txns.slice(0, 10) };
  }, [data, startDate, endDate]);

  const catEntries = useMemo(() => {
    return Array.from(stats.catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([catId, amount]) => {
      const info = getCategoryDisplay(catId === '__other' ? null : catId, data);
      return { ...info, amount, percent: stats.expense > 0 ? (amount / stats.expense) * 100 : 0 };
    });
  }, [stats, data]);

  const balance = stats.income - stats.expense;
  const fmtShort = (n: number) => { if (Math.abs(n) >= 1000000) { const m = Math.floor(Math.abs(n) / 1000000); return `${n < 0 ? '-' : ''}${m}M`; } return n.toLocaleString('vi-VN'); };
  const navigate = (dir: number) => { const d = new Date(refDate); if (period === 'week') d.setDate(d.getDate() + 7 * dir); else if (period === 'month') d.setMonth(d.getMonth() + dir); else if (period === 'year') d.setFullYear(d.getFullYear() + dir); setRefDate(d); };

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-gray-100"><ArrowLeft size={20} /></button>
        <h2 className="flex-1 text-base font-bold">Báo cáo</h2>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Period filter */}
        <div className="flex gap-1.5">
          {(['week', 'month', 'year', 'all'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className="flex-1 py-2 rounded-full text-xs font-semibold"
              style={{ backgroundColor: period === p ? '#1264F5' : '#F5F5F5', color: period === p ? '#fff' : '#333' }}>
              {{ week: 'Tuần', month: 'Tháng', year: 'Năm', all: 'Tất cả' }[p]}
            </button>
          ))}
        </div>
        {period !== 'all' && (
          <div className="flex justify-center gap-4">
            <button onClick={() => navigate(-1)} className="text-xs text-blue-600">← Trước</button>
            <button onClick={() => navigate(1)} className="text-xs text-blue-600">Sau →</button>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 rounded-xl p-3 text-center"><TrendingUp size={16} className="mx-auto text-green-600 mb-1" /><p className="text-[10px] text-gray-500">Thu</p><p className="text-sm font-bold text-green-600">{fmtShort(stats.income)}</p></div>
          <div className="bg-red-50 rounded-xl p-3 text-center"><TrendingDown size={16} className="mx-auto text-red-500 mb-1" /><p className="text-[10px] text-gray-500">Chi</p><p className="text-sm font-bold text-red-500">{fmtShort(stats.expense)}</p></div>
          <div className="bg-blue-50 rounded-xl p-3 text-center"><Wallet size={16} className="mx-auto text-blue-600 mb-1" /><p className="text-[10px] text-gray-500">Số dư</p><p className="text-sm font-bold text-blue-600">{fmtShort(balance)}</p></div>
        </div>

        {/* Category chart */}
        {catEntries.length > 0 && (
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Chi tiêu theo danh mục</h3>
            <div className="space-y-2.5">
              {catEntries.map((cat, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700">{cat.label}</span>
                    <span className="font-medium">{formatMoney(cat.amount)} ({cat.percent.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top transactions */}
        {stats.topTxns.length > 0 && (
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Top giao dịch</h3>
            <div className="space-y-2">
              {stats.topTxns.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">{i + 1}</span>
                  <span className="flex-1 text-xs truncate">{t.title}</span>
                  <span className="text-xs font-medium">{formatMoney(t.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
