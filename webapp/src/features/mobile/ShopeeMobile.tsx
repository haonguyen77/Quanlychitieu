import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { TransactionDetailMobile } from './TransactionDetailMobile';
import { getRecordField } from './mobileDataMapper';
import { ArrowLeft, Search, ShoppingCart, ChevronLeft, ChevronRight, SlidersHorizontal, Calendar, X } from 'lucide-react';
import type { DataRecord } from '@/types';
import { ModuleBottomNav } from './ModuleBottomNav';

const NAVY = '#101B4D';

type FilterPeriod = 'week' | 'month' | 'year' | 'all';

/**
 * ShopeeMobile — Reproduction of Android shopee_home_screen.dart.
 * Header (icon + title + subtitle) → 3-stat summary card → red transaction table grouped by day.
 * Shopee primary color: #FF2D16.
 */
export function ShopeeMobile() {
  const { pop, push } = useMobileNav();
  const { data } = useAppStore();
  const [period, setPeriod] = useState<FilterPeriod>('month');
  const [refDate, setRefDate] = useState(new Date());
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const RED = '#FF2D16';

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

  const txns = useMemo(() => {
    if (!data) return [];
    return data.records
      .filter(r => {
        if (r.isDeleted) return false;
        if (r.moduleId !== 'mod_shopee' && r.linkedModuleId !== 'mod_shopee') return false;
        const d = getRecordField(r, 'date');
        if (d < startDate || d > endDate) return false;
        return getRecordField(r, 'type') !== '2';
      })
      .map(r => ({
        record: r,
        title: getRecordField(r, 'title') || '—',
        amount: Math.abs(Number(getRecordField(r, 'amount')) || 0),
        beneficiary: getRecordField(r, 'beneficiary'),
        type: getRecordField(r, 'type'),
        date: getRecordField(r, 'date'),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, startDate, endDate]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return txns;
    const q = searchQuery.toLowerCase();
    return txns.filter(t => t.title.toLowerCase().includes(q));
  }, [txns, searchQuery]);

  // Stats
  const totalSpent = filtered.filter(t => t.type !== '1').reduce((s, t) => s + t.amount, 0);
  const orderCount = filtered.length;
  const topDay = useMemo(() => {
    const dayMap = new Map<string, number>();
    for (const t of filtered) dayMap.set(t.date, (dayMap.get(t.date) || 0) + t.amount);
    let best = ''; let bestAmt = 0;
    for (const [d, amt] of dayMap) if (amt > bestAmt) { best = d; bestAmt = amt; }
    return { date: best, amount: bestAmt, count: filtered.filter(t => t.date === best).length };
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) { if (!map.has(t.date)) map.set(t.date, []); map.get(t.date)!.push(t); }
    return Array.from(map.entries());
  }, [filtered]);

  const fmtC = (n: number) => { if (n >= 1000000) return `${(n / 1000000).toFixed(1)}tr đ`; if (n >= 1000) return `${Math.round(n / 1000)}K đ`; return `${n} đ`; };
  const fmtDate = (d: string) => d ? d.split('-').reverse().join('/') : '';
  const navigate = (dir: number) => { const d = new Date(refDate); if (period === 'week') d.setDate(d.getDate() + 7 * dir); else if (period === 'month') d.setMonth(d.getMonth() + dir); else if (period === 'year') d.setFullYear(d.getFullYear() + dir); setRefDate(d); };
  const openDetail = (record: DataRecord) => push({ id: `detail-${record.id}`, component: <TransactionDetailMobile record={record} /> });

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center gap-2 px-2 py-2 border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 flex items-center justify-center"><ArrowLeft size={22} style={{ color: NAVY }} /></button>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF7F5' }}><ShoppingCart size={18} color={RED} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold" style={{ color: NAVY }}>Mua sắm online</p>
          <p className="text-[11px] text-gray-500 truncate">Chi tiêu mua sắm trên các sàn TMĐT</p>
        </div>
        <button onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }} className="w-9 h-9 flex items-center justify-center">
          {showSearch ? <X size={18} color={NAVY} /> : <Search size={18} color={NAVY} />}
        </button>
        <button onClick={() => setShowFilter(!showFilter)} className="w-9 h-9 flex items-center justify-center">
          <SlidersHorizontal size={18} color={showFilter ? RED : NAVY} />
        </button>
      </header>

      {showSearch && (
        <div className="px-4 py-2"><input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Tìm kiếm..." autoFocus className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 outline-none" /></div>
      )}

      {/* Period filter — hidden by default, toggled by Filter button (matches App) */}
      {showFilter && (
        <div className="px-4 py-2 space-y-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => period !== 'all' && navigate(-1)} className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><ChevronLeft size={16} /></button>
            {(['week', 'month', 'year', 'all'] as FilterPeriod[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className="flex-1 py-2 rounded-full text-[11px] font-semibold text-center"
                style={{ backgroundColor: period === p ? RED : '#fff', color: period === p ? '#fff' : '#1A1A1A', border: period === p ? 'none' : '1px solid #E5E7EB' }}>
                {{ week: 'Tuần', month: 'Tháng', year: 'Năm', all: 'Tất cả' }[p]}
              </button>
            ))}
            <button onClick={() => period !== 'all' && navigate(1)} className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><ChevronRight size={16} /></button>
          </div>
          {/* Date range (read-only display of the active period, matches App) */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-9 px-3 border border-gray-200 rounded-lg flex items-center gap-2">
              <Calendar size={13} color="#9E9E9E" />
              <span className="text-xs text-gray-700">{startDate.split('-').reverse().join('/')}</span>
            </div>
            <span className="text-xs text-gray-300">-</span>
            <div className="flex-1 h-9 px-3 border border-gray-200 rounded-lg flex items-center gap-2">
              <Calendar size={13} color="#9E9E9E" />
              <span className="text-xs text-gray-700">{endDate.split('-').reverse().join('/')}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3-stat summary card */}
      <div className="mx-4 my-2 border border-gray-200 rounded-2xl p-4 flex">
        <div className="flex-1 text-center border-r border-gray-100">
          <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center mb-1" style={{ backgroundColor: '#FBE9E7' }}><ShoppingCart size={15} color={RED} /></div>
          <p className="text-[10px] text-gray-500">Tổng chi</p>
          <p className="text-sm font-bold" style={{ color: RED }}>{fmtC(totalSpent)}</p>
          <p className="text-[9px] text-gray-400">{orderCount} giao dịch</p>
        </div>
        <div className="flex-1 text-center border-r border-gray-100">
          <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center mb-1" style={{ backgroundColor: '#E3F2FD' }}><ShoppingCart size={15} color="#1565C0" /></div>
          <p className="text-[10px] text-gray-500">Đơn hàng</p>
          <p className="text-sm font-bold" style={{ color: '#1565C0' }}>{orderCount}</p>
          <p className="text-[9px] text-gray-400">{orderCount} đơn</p>
        </div>
        <div className="flex-1 text-center">
          <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center mb-1" style={{ backgroundColor: '#F3E5F5' }}><Search size={15} color="#7B1FA2" /></div>
          <p className="text-[10px] text-gray-500">Ngày mua nhiều nhất</p>
          <p className="text-xs font-bold" style={{ color: '#7B1FA2' }}>{topDay.date ? fmtDate(topDay.date) : '—'}</p>
          <p className="text-[9px] text-gray-400">{topDay.amount > 0 ? `${fmtC(topDay.amount)} (${topDay.count} đơn)` : ''}</p>
        </div>
      </div>

      {/* Transaction table */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {/* Red table header */}
        <div className="flex items-center px-3 py-2 rounded-t-lg text-white text-[11px] font-semibold" style={{ backgroundColor: RED }}>
          <span className="flex-1">GIAO DỊCH</span>
          <span className="w-14 text-center">CỦA</span>
          <span className="w-24 text-right">SỐ TIỀN</span>
        </div>
        {grouped.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">Chưa có giao dịch</p>
        ) : (
          <div className="border border-gray-100 rounded-b-lg overflow-hidden">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <div className="flex items-center px-3 py-1.5" style={{ backgroundColor: '#FFF5F3' }}>
                  <span className="flex-1 text-[11px] font-medium" style={{ color: RED }}>📅 {fmtDate(day)}</span>
                  <span className="text-[11px] font-semibold" style={{ color: RED }}>Tổng: {fmtC(items.reduce((s, t) => s + t.amount, 0))}</span>
                </div>
                {items.map(t => (
                  <button key={t.record.id} onClick={() => openDetail(t.record)} className="w-full flex items-center px-3 py-2.5 border-b border-gray-50 active:bg-gray-50 text-left">
                    <span className="flex-1 text-sm text-gray-900 truncate">{t.title}</span>
                    <span className="w-14 text-center text-[11px] text-gray-500 truncate">{t.beneficiary || ''}</span>
                    <span className="w-24 text-right text-sm font-bold text-gray-900">{fmtC(t.amount)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <ModuleBottomNav accentColor={RED} moduleId="mod_shopee" />
    </div>
  );
}
