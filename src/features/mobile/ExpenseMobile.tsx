import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { useMobileNav } from './MobileNavigation';
import { TransactionDetailMobile } from './TransactionDetailMobile';
import { Search, X, SlidersHorizontal, TrendingDown, TrendingUp, ChevronLeft, ChevronRight, Calendar, Wallet } from 'lucide-react';
import type { DataRecord } from '@/types';

type FilterPeriod = 'week' | 'month' | 'year' | 'all';

/**
 * ExpenseMobile — Full reproduction of Android expense_screen.dart.
 * Header + Search + Period Filter + Date Range + Summary (Tổng chi/thu) + Grouped transaction list.
 */
export function ExpenseMobile() {
  const { data } = useAppStore();
  const { deleteRecord } = useRecordStore();
  const { push } = useMobileNav();

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [period, setPeriod] = useState<FilterPeriod>('month');
  const [refDate, setRefDate] = useState(new Date());

  // Date range
  const { startDate, endDate, dateLabel } = useMemo(() => {
    const ref = refDate;
    let start: string, end: string, label: string;
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const fmtDisplay = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    switch (period) {
      case 'week': { const day = ref.getDay(); const diff = day === 0 ? -6 : 1 - day; const s = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diff); const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6); start = fmt(s); end = fmt(e); label = `${fmtDisplay(s)} → ${fmtDisplay(e)}`; break; }
      case 'month': { const s = new Date(ref.getFullYear(), ref.getMonth(), 1); const e = new Date(ref.getFullYear(), ref.getMonth() + 1, 0); start = fmt(s); end = fmt(e); label = `${fmtDisplay(s)} → ${fmtDisplay(e)}`; break; }
      case 'year': { start = `${ref.getFullYear()}-01-01`; end = `${ref.getFullYear()}-12-31`; label = `${ref.getFullYear()}`; break; }
      default: start = '2020-01-01'; end = '2099-12-31'; label = 'Tất cả';
    }
    return { startDate: start, endDate: end, dateLabel: label };
  }, [period, refDate]);

  // Transactions
  const allTxns = useMemo(() => {
    if (!data) return [];
    return data.records
      .filter(r => {
        if (r.isDeleted || r.moduleId !== 'mod_chitieu') return false;
        const dk = Object.keys(r.values).find(k => k.endsWith('_date'));
        const d = dk ? String(r.values[dk] ?? '') : '';
        if (d < startDate || d > endDate) return false;
        const tk = Object.keys(r.values).find(k => k.endsWith('_type'));
        return tk ? String(r.values[tk]) !== '2' : true;
      })
      .map(r => {
        const get = (s: string) => { const k = Object.keys(r.values).find(k => k.endsWith(`_${s}`)); return k ? String(r.values[k] ?? '') : ''; };
        const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount'));
        return { record: r, title: get('title') || '—', amount: amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0, type: get('type'), date: get('date') || r.createdAt?.slice(0, 10) || '', account: get('account'), categoryId: r.categoryId || '' };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, startDate, endDate]);

  // Search filter
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allTxns;
    const q = searchQuery.toLowerCase();
    return allTxns.filter(t => t.title.toLowerCase().includes(q));
  }, [allTxns, searchQuery]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) { const day = t.date.slice(0, 10); if (!map.has(day)) map.set(day, []); map.get(day)!.push(t); }
    return Array.from(map.entries());
  }, [filtered]);

  const totalExpense = filtered.filter(t => t.type !== '1').reduce((s, t) => s + t.amount, 0);
  const totalIncome = filtered.filter(t => t.type === '1').reduce((s, t) => s + t.amount, 0);

  const fmtCompact = (n: number) => { if (n >= 1000000) { const m = Math.floor(n / 1000000); const h = Math.floor((n - m * 1000000) / 100000); return h > 0 ? `${m}M${h}` : `${m}M`; } if (n >= 1000) return `${Math.round(n / 1000).toLocaleString('vi-VN')}K`; return n.toLocaleString('vi-VN'); };
  const fmtMoney = (n: number) => n.toLocaleString('vi-VN');
  const navigate = (dir: number) => { const d = new Date(refDate); if (period === 'week') d.setDate(d.getDate() + 7 * dir); else if (period === 'month') d.setMonth(d.getMonth() + dir); else if (period === 'year') d.setFullYear(d.getFullYear() + dir); setRefDate(d); };

  const fmtDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    const formatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    if (diff === 0) return `Hôm nay, ${formatted}`;
    if (diff === 1) return `Hôm qua, ${formatted}`;
    return formatted;
  };

  const openDetail = (record: DataRecord) => { push({ id: `detail-${record.id}`, component: <TransactionDetailMobile record={record} /> }); };

  const getCatName = (catId: string) => { const mod = data?.modules.find(m => m.id === 'mod_chitieu'); return mod?.categories?.find(c => c.id === catId)?.name || ''; };
  const getAccLabel = (val: string) => { const mod = data?.modules.find(m => m.id === 'mod_chitieu'); const f = mod?.fields.find(f => f.fieldName === 'account'); return f?.options?.find(o => o.value === val)?.label || val; };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header — matches Android: title + search + filter */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <h1 className="flex-1 text-2xl font-bold" style={{ color: '#1A1A1A' }}>Chi tiêu</h1>
        <button onClick={() => { setIsSearching(!isSearching); if (isSearching) setSearchQuery(''); }} className="w-9 h-9 flex items-center justify-center">
          {isSearching ? <X size={20} color="#1A1A1A" /> : <Search size={20} color="#1A1A1A" />}
        </button>
        <button onClick={() => setShowFilter(!showFilter)} className="w-9 h-9 flex items-center justify-center">
          <SlidersHorizontal size={20} color={showFilter ? '#1264F5' : '#1A1A1A'} />
        </button>
      </div>

      {/* Search */}
      {isSearching && (
        <div className="px-4 pb-2">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Tìm theo tên hoặc ghi chú..." autoFocus
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:border-[#1264F5] outline-none" />
        </div>
      )}

      {/* Period Filter */}
      {showFilter && (
        <div className="px-4 pb-2 space-y-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate(-1)} className="w-9 h-9 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><ChevronLeft size={18} /></button>
            {(['week', 'month', 'year', 'all'] as FilterPeriod[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className="flex-1 py-2.5 rounded-full text-xs font-semibold text-center"
                style={{ backgroundColor: period === p ? '#1264F5' : '#fff', color: period === p ? '#fff' : '#1A1A1A', border: period === p ? 'none' : '1px solid #E5E7EB' }}>
                {{ week: 'Tuần', month: 'Tháng', year: 'Năm', all: 'Tất cả' }[p]}
              </button>
            ))}
            <button onClick={() => navigate(1)} className="w-9 h-9 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><ChevronRight size={18} /></button>
          </div>
          {/* Date range display */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-9 px-3 border border-gray-200 rounded-lg flex items-center gap-2">
              <Calendar size={13} className="text-gray-400" />
              <span className="text-xs text-gray-700">{startDate.split('-').reverse().join('/')}</span>
            </div>
            <span className="text-gray-300">→</span>
            <div className="flex-1 h-9 px-3 border border-gray-200 rounded-lg flex items-center gap-2">
              <Calendar size={13} className="text-gray-400" />
              <span className="text-xs text-gray-700">{endDate.split('-').reverse().join('/')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary — matches Android: 2 cards side by side */}
      <div className="px-4 py-2 flex gap-3">
        <div className="flex-1 border border-gray-200 rounded-xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center"><Wallet size={16} className="text-red-500" /></div>
          <div><p className="text-[11px] text-gray-500">Tổng chi</p><p className="text-sm font-bold text-red-600">{fmtCompact(totalExpense)}</p></div>
        </div>
        <div className="flex-1 border border-gray-200 rounded-xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center"><TrendingDown size={16} className="text-green-500" /></div>
          <div><p className="text-[11px] text-gray-500">Tổng thu</p><p className="text-sm font-bold text-green-600">{fmtCompact(totalIncome)}</p></div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-auto pb-4">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <TrendingDown size={40} className="text-gray-200 mb-2" />
            <p className="text-sm">Chưa có giao dịch</p>
          </div>
        ) : (
          grouped.map(([day, txns]) => {
            const dayTotal = txns.filter(t => t.type !== '1').reduce((s, t) => s + t.amount, 0);
            return (
              <div key={day}>
                {/* Day header — matches Android: calendar icon + date + total */}
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: '#F5F7FA' }}>
                  <Calendar size={14} className="text-gray-500" />
                  <span className="flex-1 text-xs font-semibold" style={{ color: '#1A1A1A' }}>{fmtDayLabel(day)}</span>
                  <span className="text-xs font-semibold text-red-600">Tổng: {fmtCompact(dayTotal)}</span>
                </div>
                {/* Transactions */}
                {txns.map(t => (
                  <button key={t.record.id} onClick={() => openDetail(t.record)} className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50 text-left">
                    {/* Category icon */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: t.type === '1' ? '#E8F5E9' : '#FFEBEE' }}>
                      {t.type === '1' ? <TrendingUp size={18} className="text-green-600" /> : <TrendingDown size={18} className="text-red-500" />}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{t.title}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Wallet size={12} className="text-gray-400" />
                        <span className="text-[11px] text-gray-500 truncate">{getAccLabel(t.account)}</span>
                        {t.categoryId && <span className="text-[11px] text-gray-300 mx-1">|</span>}
                        {t.categoryId && <span className="text-[11px] text-gray-500">{getCatName(t.categoryId)}</span>}
                      </div>
                    </div>
                    {/* Amount */}
                    <span className={`text-sm font-bold ${t.type === '1' ? 'text-green-600' : ''}`} style={{ color: t.type !== '1' ? '#1A1A1A' : undefined }}>
                      {fmtMoney(t.amount)}₫
                    </span>
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
