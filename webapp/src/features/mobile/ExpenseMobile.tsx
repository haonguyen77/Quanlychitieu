import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { TransactionDetailMobile } from './TransactionDetailMobile';
import { MobileIcon } from './MobileIcon';
import { getCategoryDisplay, getAccountDisplay, getRecordField } from './mobileDataMapper';
import { Search, X, SlidersHorizontal, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { DataRecord } from '@/types';

type FilterPeriod = 'week' | 'month' | 'year' | 'all';

/**
 * ExpenseMobile — Reproduction of Android expense_screen.dart.
 * Layout: Header → Search → Period Filter → Date Range → Summary → Grouped List
 * 
 * Key Android details:
 * - Header: "Chi tiêu" (26px bold, #0F1F4D) + search + filter buttons
 * - Summary: 2 cards (Tổng chi = wallet icon red, Tổng thu = arrow_down icon green)
 * - Day header: bgLight (#F5F7FA), calendar icon + "Hôm nay, dd/MM/yyyy" + "Tổng: 3M5"
 * - Transaction row: 40x40 category icon (rounded 10, bgColor+icon) + title + account+module sub + amount
 * - Amount color: expenses = #0F1F4D (dark), income = #20A84A (green)
 */
export function ExpenseMobile() {
  const { data } = useAppStore();
  const { push } = useMobileNav();

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [period, setPeriod] = useState<FilterPeriod>('month');
  const [refDate, setRefDate] = useState(new Date());

  // Date range calculation (Android: _startDate, _endDate)
  const { startDate, endDate } = useMemo(() => {
    const ref = refDate;
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    switch (period) {
      case 'week': { const day = ref.getDay(); const diff = day === 0 ? -6 : 1 - day; const s = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diff); const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6); return { startDate: fmt(s), endDate: fmt(e) }; }
      case 'month': { const s = new Date(ref.getFullYear(), ref.getMonth(), 1); const e = new Date(ref.getFullYear(), ref.getMonth() + 1, 0); return { startDate: fmt(s), endDate: fmt(e) }; }
      case 'year': return { startDate: `${ref.getFullYear()}-01-01`, endDate: `${ref.getFullYear()}-12-31` };
      default: return { startDate: '2020-01-01', endDate: '2099-12-31' };
    }
  }, [period, refDate]);

  // Transactions (Android: _loadData + _displayedTransactions)
  const allTxns = useMemo(() => {
    if (!data) return [];
    return data.records
      .filter(r => {
        if (r.isDeleted || r.moduleId !== 'mod_chitieu') return false;
        const d = getRecordField(r, 'date');
        if (d < startDate || d > endDate) return false;
        const type = getRecordField(r, 'type');
        return type !== '2'; // exclude transfer
      })
      .map(r => ({
        record: r,
        title: getRecordField(r, 'title') || '—',
        amount: Math.abs(Number(getRecordField(r, 'amount')) || 0),
        type: getRecordField(r, 'type'),
        date: getRecordField(r, 'date') || r.createdAt?.slice(0, 10) || '',
        account: getRecordField(r, 'account'),
        categoryId: r.categoryId || '',
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, startDate, endDate]);

  // Search filter (Android: _displayedTransactions)
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allTxns;
    const q = searchQuery.toLowerCase();
    return allTxns.filter(t => t.title.toLowerCase().includes(q));
  }, [allTxns, searchQuery]);

  // Group by day (Android: _grouped)
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) { const day = t.date.slice(0, 10); if (!map.has(day)) map.set(day, []); map.get(day)!.push(t); }
    return Array.from(map.entries());
  }, [filtered]);

  // Totals (Android: _totalExpense, _totalIncome)
  const totalExpense = filtered.filter(t => t.type !== '1').reduce((s, t) => s + t.amount, 0);
  const totalIncome = filtered.filter(t => t.type === '1').reduce((s, t) => s + t.amount, 0);

  // Format helpers (Android: Formatters.currencyCompact)
  const fmtCompact = (n: number) => {
    if (n >= 1000000) { const m = Math.floor(n / 1000000); const h = Math.floor((n - m * 1000000) / 100000); return h > 0 ? `${m}M${h}` : `${m}M`; }
    if (n >= 1000) return `${Math.round(n / 1000).toLocaleString('vi-VN')}K`;
    return n.toLocaleString('vi-VN');
  };
  const fmtMoney = (n: number) => n.toLocaleString('vi-VN');
  const navigate = (dir: number) => { const d = new Date(refDate); if (period === 'week') d.setDate(d.getDate() + 7 * dir); else if (period === 'month') d.setMonth(d.getMonth() + dir); else if (period === 'year') d.setFullYear(d.getFullYear() + dir); setRefDate(d); };

  // Day label (Android: "Hôm nay, dd/MM/yyyy")
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

  // Resolve display info using shared mapper
  const getCatInfo = (catId: string) => getCategoryDisplay(catId, data);
  const getAccInfo = (accId: string) => getAccountDisplay(accId, data);

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* ═══ HEADER — Android: "Chi tiêu" 26px bold + search + filter ═══ */}
      <div className="px-5 pb-1 flex items-center gap-2" style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
        <h1 className="flex-1 font-bold" style={{ fontSize: 26, color: '#0F1F4D' }}>Chi tiêu</h1>
        <button onClick={() => { setIsSearching(!isSearching); if (isSearching) setSearchQuery(''); }} className="w-10 h-10 flex items-center justify-center rounded-lg active:bg-gray-100">
          {isSearching ? <X size={20} color="#0F1F4D" /> : <Search size={20} color="#0F1F4D" />}
        </button>
        <button onClick={() => setShowFilter(!showFilter)} className="w-10 h-10 flex items-center justify-center rounded-lg active:bg-gray-100">
          <SlidersHorizontal size={20} color={showFilter ? '#1264F5' : '#0F1F4D'} />
        </button>
      </div>

      {/* ═══ SEARCH BAR — Android: TextField with hint ═══ */}
      {isSearching && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] border border-gray-200" style={{ backgroundColor: '#F5F7FA' }}>
            <Search size={16} color="#9E9E9E" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Tìm theo tên hoặc ghi chú..." autoFocus
              className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400" />
          </div>
        </div>
      )}

      {/* ═══ PERIOD FILTER — Android: pills (Tuần/Tháng/Năm/Tất cả) + arrows ═══ */}
      {showFilter && (
        <div className="px-4 pb-2 space-y-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => period !== 'all' && navigate(-1)} className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 active:bg-gray-50">
              <ChevronLeft size={16} color="#616161" />
            </button>
            {(['week', 'month', 'year', 'all'] as FilterPeriod[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className="flex-1 py-2.5 rounded-full text-xs font-semibold text-center"
                style={{ backgroundColor: period === p ? '#1264F5' : '#fff', color: period === p ? '#fff' : '#0F1F4D', border: period === p ? 'none' : '1px solid #E5E7EB' }}>
                {{ week: 'Tuần', month: 'Tháng', year: 'Năm', all: 'Tất cả' }[p]}
              </button>
            ))}
            <button onClick={() => period !== 'all' && navigate(1)} className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 active:bg-gray-50">
              <ChevronRight size={16} color="#616161" />
            </button>
          </div>
          {/* Date range */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-9 px-3 border border-gray-200 rounded-lg flex items-center gap-2">
              <Calendar size={13} color="#9E9E9E" />
              <span className="text-xs text-gray-700">{startDate.split('-').reverse().join('/')}</span>
            </div>
            <span className="text-xs text-gray-300">→</span>
            <div className="flex-1 h-9 px-3 border border-gray-200 rounded-lg flex items-center gap-2">
              <Calendar size={13} color="#9E9E9E" />
              <span className="text-xs text-gray-700">{endDate.split('-').reverse().join('/')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SUMMARY — Android: 2 cards (Tổng chi = wallet/red, Tổng thu = arrow_down/green) ═══ */}
      <div className="px-4 py-2 flex gap-3">
        <div className="flex-1 border border-gray-200 rounded-[14px] p-3 flex items-center gap-2.5">
          <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center" style={{ backgroundColor: '#FFEBEE' }}>
            <MobileIcon name="wallet" size={18} color="#EF3030" />
          </div>
          <div><p className="text-[12px] text-gray-500">Tổng chi</p><p className="text-[15px] font-bold" style={{ color: '#EF3030' }}>{fmtCompact(totalExpense)}</p></div>
        </div>
        <div className="flex-1 border border-gray-200 rounded-[14px] p-3 flex items-center gap-2.5">
          <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center" style={{ backgroundColor: '#E8F5E9' }}>
            <MobileIcon name="arrow-down" size={18} color="#20A84A" />
          </div>
          <div><p className="text-[12px] text-gray-500">Tổng thu</p><p className="text-[15px] font-bold" style={{ color: '#20A84A' }}>{fmtCompact(totalIncome)}</p></div>
        </div>
      </div>

      {/* ═══ TRANSACTION LIST — grouped by day ═══ */}
      <div className="flex-1 overflow-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <MobileIcon name="receipt" size={40} color="#E0E0E0" />
            <p className="text-sm mt-2">Chưa có giao dịch</p>
          </div>
        ) : (
          grouped.map(([day, txns]) => {
            const dayTotal = txns.filter(t => t.type !== '1').reduce((s, t) => s + t.amount, 0);
            return (
              <div key={day}>
                {/* Day header — Android: bgLight + calendar + label + total */}
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: '#F5F7FA' }}>
                  <Calendar size={14} color="#757575" />
                  <span className="flex-1 text-xs font-semibold" style={{ color: '#0F1F4D' }}>{fmtDayLabel(day)}</span>
                  <span className="text-xs font-semibold" style={{ color: '#EF3030' }}>Tổng: {fmtCompact(dayTotal)}</span>
                </div>
                {/* Transaction rows */}
                {txns.map(t => {
                  const catInfo = getCatInfo(t.categoryId);
                  const accInfo = getAccInfo(t.account);
                  const isIncome = t.type === '1';
                  return (
                    <button key={t.record.id} onClick={() => openDetail(t.record)} className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50 text-left">
                      {/* Category icon — Android: 40x40 rounded-10 container + icon */}
                      <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: t.categoryId ? catInfo.bgColor : (isIncome ? '#E8F5E9' : '#FFEBEE') }}>
                        {t.categoryId ? (
                          <MobileIcon name={catInfo.icon} size={20} color={catInfo.color} />
                        ) : (
                          <MobileIcon name={isIncome ? 'trending-up' : 'arrow-down'} size={18} color={isIncome ? '#20A84A' : '#EF3030'} />
                        )}
                      </div>
                      {/* Content — Android: title (14px w600) + subtitle (account icon + name | module) */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold truncate" style={{ color: '#0F1F4D' }}>{t.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MobileIcon name={accInfo.icon} size={13} color={accInfo.color} />
                          <span className="text-[11px] truncate" style={{ color: accInfo.color }}>{accInfo.label}</span>
                          {t.categoryId && (
                            <>
                              <span className="text-[11px] text-gray-300 mx-0.5">|</span>
                              <span className="text-[11px] text-gray-500 truncate">{catInfo.label}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Amount — Android: 14px w700, dark for expense, green for income */}
                      <span className="text-[14px] font-bold flex-shrink-0" style={{ color: isIncome ? '#20A84A' : '#0F1F4D' }}>
                        {fmtMoney(t.amount)}₫
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}
