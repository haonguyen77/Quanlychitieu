import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { TransactionDetailMobile } from './TransactionDetailMobile';
import { MobileIcon } from './MobileIcon';
import { getCategoryDisplay, getAccountDisplay, getRecordField } from './mobileDataMapper';
import { Search, X, SlidersHorizontal, ChevronLeft, ChevronRight, Calendar, ArrowLeft } from 'lucide-react';
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
export function ExpenseMobile({ initialCategoryId, initialPeriod }: { initialCategoryId?: string; initialPeriod?: FilterPeriod } = {}) {
  const { data } = useAppStore();
  const { push, pop } = useMobileNav();
  // When opened as an overlay (e.g. from Dashboard by tapping a category), show
  // a back button. The root Chi tiêu tab has no category preset → no back button.
  const showBack = !!initialCategoryId;

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [period, setPeriod] = useState<FilterPeriod>(initialPeriod ?? 'month');
  const [refDate, setRefDate] = useState(new Date());
  // Type filter for the summary cards: null=all, '0'=Chi, '1'=Thu (UI-only).
  const [typeFilter, setTypeFilter] = useState<'0' | '1' | null>(null);
  // Category filter (UI-only), e.g. opened from Dashboard.
  const [categoryFilter] = useState<string | null>(initialCategoryId ?? null);

  // Date range calculation (Android: _startDate, _endDate)
  // IMPORTANT: dùng local date format thay vì toISOString() (UTC) để tránh lệch ngày
  // ở múi giờ UTC+7 (VD: 01/09/2026 00:00 local = 31/08/2026 17:00 UTC).
  const { startDate, endDate } = useMemo(() => {
    const ref = refDate;
    const fmtLocal = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    switch (period) {
      case 'week': {
        const day = ref.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const s = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diff);
        const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
        return { startDate: fmtLocal(s), endDate: fmtLocal(e) };
      }
      case 'month': {
        const s = new Date(ref.getFullYear(), ref.getMonth(), 1);
        const e = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
        return { startDate: fmtLocal(s), endDate: fmtLocal(e) };
      }
      case 'year':
        return { startDate: `${ref.getFullYear()}-01-01`, endDate: `${ref.getFullYear()}-12-31` };
      default:
        return { startDate: '2020-01-01', endDate: '2099-12-31' };
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
        if (type === '2') return false; // exclude transfer
        // Category filter (opened from Dashboard). '__other' = uncategorized.
        if (categoryFilter) {
          const cid = r.categoryId || '';
          if (categoryFilter === '__other' ? cid !== '' : cid !== categoryFilter) return false;
        }
        return true;
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
      .sort((a, b) => {
        // Primary: date descending
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        // Tiebreaker: updatedAt/createdAt descending — giao dịch mới nhập nằm trên
        const timeA = a.record.updatedAt || a.record.createdAt || '';
        const timeB = b.record.updatedAt || b.record.createdAt || '';
        return timeB.localeCompare(timeA);
      });
  }, [data, startDate, endDate]);

  // Search filter (Android: _displayedTransactions) — base for the summary cards.
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allTxns;
    const q = searchQuery.toLowerCase();
    return allTxns.filter(t => t.title.toLowerCase().includes(q));
  }, [allTxns, searchQuery]);

  // List respects the summary-card type filter (toggle) on top of search.
  const listTxns = useMemo(() => {
    if (!typeFilter) return filtered;
    return filtered.filter(t => (typeFilter === '1' ? t.type === '1' : t.type === '0'));
  }, [filtered, typeFilter]);

  // Group by day (Android: _grouped)
  const grouped = useMemo(() => {
    const map = new Map<string, typeof listTxns>();
    for (const t of listTxns) { const day = t.date.slice(0, 10); if (!map.has(day)) map.set(day, []); map.get(day)!.push(t); }
    return Array.from(map.entries());
  }, [listTxns]);

  // Totals (Android: _totalExpense, _totalIncome) — from search+category base, NOT type filter.
  const totalExpense = filtered.filter(t => t.type !== '1').reduce((s, t) => s + t.amount, 0);
  const totalIncome = filtered.filter(t => t.type === '1').reduce((s, t) => s + t.amount, 0);

  // Format helpers (Android: Formatters.currencyCompact)
  const fmtCompact = (n: number) => {
    if (n >= 1000000) { const m = Math.floor(n / 1000000); const h = Math.floor((n - m * 1000000) / 100000); return h > 0 ? `${m}M${h}` : `${m}M`; }
    if (n >= 1000) return `${Math.round(n / 1000).toLocaleString('vi-VN')}K`;
    return n.toLocaleString('vi-VN');
  };
  const fmtMoney = (n: number) => n.toLocaleString('vi-VN');
  const navigate = (dir: number) => {
    if (period === 'week') { const d = new Date(refDate); d.setDate(d.getDate() + 7 * dir); setRefDate(d); }
    else if (period === 'month') {
      // Luôn set ngày = 1 trước khi đổi tháng để tránh overflow (VD: 31/08 + 1 tháng = 01/10 thay vì 01/09)
      const d = new Date(refDate.getFullYear(), refDate.getMonth() + dir, 1);
      setRefDate(d);
    }
    else if (period === 'year') { const d = new Date(refDate); d.setFullYear(d.getFullYear() + dir); setRefDate(d); }
  };

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
        {showBack && (
          <button onClick={pop} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-lg active:bg-gray-100">
            <ArrowLeft size={22} color="#0F1F4D" />
          </button>
        )}
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
        <button onClick={() => setTypeFilter(f => f === '0' ? null : '0')}
          className="flex-1 border rounded-[14px] p-3 flex items-center gap-2.5 text-left"
          style={{ borderColor: typeFilter === '0' ? '#EF3030' : '#E5E7EB', borderWidth: typeFilter === '0' ? 1.5 : 1, backgroundColor: typeFilter === '0' ? '#FFEBEE55' : '#fff' }}>
          <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFEBEE' }}>
            <MobileIcon name="wallet" size={18} color="#EF3030" />
          </div>
          <div><p className="text-[12px] text-gray-500">Tổng chi</p><p className="text-[15px] font-bold" style={{ color: '#EF3030' }}>{fmtCompact(totalExpense)}</p></div>
        </button>
        <button onClick={() => setTypeFilter(f => f === '1' ? null : '1')}
          className="flex-1 border rounded-[14px] p-3 flex items-center gap-2.5 text-left"
          style={{ borderColor: typeFilter === '1' ? '#20A84A' : '#E5E7EB', borderWidth: typeFilter === '1' ? 1.5 : 1, backgroundColor: typeFilter === '1' ? '#E8F5E955' : '#fff' }}>
          <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#E8F5E9' }}>
            <MobileIcon name="arrow-down" size={18} color="#20A84A" />
          </div>
          <div><p className="text-[12px] text-gray-500">Tổng thu</p><p className="text-[15px] font-bold" style={{ color: '#20A84A' }}>{fmtCompact(totalIncome)}</p></div>
        </button>
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
            const dayExpense = txns.filter(t => t.type === '0').reduce((s, t) => s + t.amount, 0);
            const dayIncome = txns.filter(t => t.type === '1').reduce((s, t) => s + t.amount, 0);
            return (
              <div key={day}>
                {/* Day header — Android: bgLight + calendar + label + total.
                    Both income & expense → "+thu (xanh) | -chi (đỏ)"; only expense
                    → "Tổng: -chi" red; only income → "+thu" green. */}
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: '#F5F7FA' }}>
                  <Calendar size={14} color="#757575" />
                  <span className="flex-1 text-xs font-semibold" style={{ color: '#0F1F4D' }}>{fmtDayLabel(day)}</span>
                  {dayIncome > 0 && dayExpense > 0 ? (
                    <span className="text-xs font-semibold">
                      <span style={{ color: '#20A84A' }}>+{fmtCompact(dayIncome)}</span>
                      <span className="text-gray-400 mx-1">|</span>
                      <span style={{ color: '#EF3030' }}>-{fmtCompact(dayExpense)}</span>
                    </span>
                  ) : dayIncome > 0 ? (
                    <span className="text-xs font-semibold" style={{ color: '#20A84A' }}>+{fmtCompact(dayIncome)}</span>
                  ) : (
                    <span className="text-xs font-semibold" style={{ color: '#EF3030' }}>Tổng: {fmtCompact(dayExpense)}</span>
                  )}
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
