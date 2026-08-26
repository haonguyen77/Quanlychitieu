import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { TransactionDetailMobile } from './TransactionDetailMobile';
import { showPrompt } from './mobileDialog';
import { ArrowLeft, Search, TrendingDown, TrendingUp, Calendar, ChevronLeft, ChevronRight, ShoppingCart, Gem, Home, CreditCard, Wine, Package } from 'lucide-react';
import type { ModuleDefinition, DataRecord } from '@/types';
import { ModuleBottomNav } from './ModuleBottomNav';

interface Props { module: ModuleDefinition; }

type FilterPeriod = 'week' | 'month' | 'year' | 'all';

const NAVY = '#101B4D';

/** Accent-tinted light background for the header icon tile (matches app). */
const ACCENT_LIGHT_BG: Record<string, string> = {
  mod_shopee: '#FFF7F5',
  mod_vang: '#FFFBEB',
  mod_nhatro: '#F0FDF4',
  mod_creditcard: '#F5F3FF',
};

/**
 * ModuleViewMobile — Generic module transaction view for Shopee, Gold, Rental, Credit Card.
 * Based on Android module home screens (shopee_home_screen, gold_home_screen, etc.)
 * Header with back + module info + search → stats → period filter → transaction list grouped by day.
 */
export function ModuleViewMobile({ module }: Props) {
  const { pop, push } = useMobileNav();
  const { data } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [period, setPeriod] = useState<FilterPeriod>('month');
  const [refDate, setRefDate] = useState(new Date());

  // Rental due date config (stored in localStorage like Android SharedPreferences)
  const [dueDay, setDueDay] = useState(() => Number(localStorage.getItem('rental_due_day')) || 29);
  const [alertDays] = useState(() => Number(localStorage.getItem('rental_alert_days')) || 5);
  const isRental = module.id === 'mod_nhatro';
  useEffect(() => { if (isRental) localStorage.setItem('rental_due_day', String(dueDay)); }, [dueDay, isRental]);

  // Module accent color (Android uses module-specific primary color)
  const accentColor = (() => {
    switch (module.id) {
      case 'mod_shopee': return '#FF2D16';
      case 'mod_vang': return '#F59E0B';
      case 'mod_nhatro': return '#16A34A';
      case 'mod_creditcard': return '#6C2BD9';
      default: return '#1264F5';
    }
  })();

  // Date range
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

  const transactions = useMemo(() => {
    if (!data) return [];
    return data.records
      .filter(r => {
        if (r.isDeleted) return false;
        if (r.moduleId !== module.id && r.linkedModuleId !== module.id) return false;
        const dk = Object.keys(r.values).find(k => k.endsWith('_date'));
        const d = dk ? String(r.values[dk] ?? '') : '';
        if (d < startDate || d > endDate) return false;
        const tk = Object.keys(r.values).find(k => k.endsWith('_type'));
        if (tk && String(r.values[tk]) === '2') return false;
        return true;
      })
      .map(r => {
        const get = (s: string) => { const k = Object.keys(r.values).find(k => k.endsWith(`_${s}`)); return k ? String(r.values[k] ?? '') : ''; };
        const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount') && !k.endsWith('_total_amount'));
        return { record: r, title: get('title') || get('order_name') || get('room_name') || '—', amount: amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0, type: get('type'), date: get('date') || get('order_date') || r.createdAt?.slice(0, 10) || '' };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, module.id, startDate, endDate]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter(t => t.title.toLowerCase().includes(q));
  }, [transactions, searchQuery]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) { const day = t.date.slice(0, 10); if (!map.has(day)) map.set(day, []); map.get(day)!.push(t); }
    return Array.from(map.entries());
  }, [filtered]);

  const totalExpense = filtered.filter(t => t.type !== '1').reduce((s, t) => s + t.amount, 0);
  const totalIncome = filtered.filter(t => t.type === '1').reduce((s, t) => s + t.amount, 0);

  const fmtCompact = (n: number) => { if (n >= 1000000) { const m = Math.floor(n / 1000000); const h = Math.floor((n - m * 1000000) / 100000); return h > 0 ? `${m}M${h}` : `${m}M`; } if (n >= 1000) return `${Math.round(n / 1000)}K`; return String(n); };
  const fmtMoney = (n: number) => n.toLocaleString('vi-VN');
  const navigate = (dir: number) => { const d = new Date(refDate); if (period === 'week') d.setDate(d.getDate() + 7 * dir); else if (period === 'month') d.setMonth(d.getMonth() + dir); else if (period === 'year') d.setFullYear(d.getFullYear() + dir); setRefDate(d); };

  const getModuleIcon = () => {
    switch (module.id) {
      case 'mod_shopee': return <ShoppingCart size={20} className="text-orange-500" />;
      case 'mod_vang': return <Gem size={20} className="text-amber-500" />;
      case 'mod_nhatro': return <Home size={20} className="text-green-500" />;
      case 'mod_creditcard': return <CreditCard size={20} className="text-indigo-600" />;
      case 'mod_ruou': return <Wine size={20} className="text-purple-600" />;
      default: return <Package size={20} className="text-gray-500" />;
    }
  };

  const openDetail = (record: DataRecord) => { push({ id: `detail-${record.id}`, component: <TransactionDetailMobile record={record} /> }); };

  // Rental (and gold/creditcard) use only 3 period pills in the app (no Tuần).
  const periods: FilterPeriod[] = module.id === 'mod_nhatro' ? ['month', 'year', 'all'] : ['week', 'month', 'year', 'all'];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header — Android style: back + icon + title + subtitle */}
      <header className="flex items-center gap-2 px-2 py-2 border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 flex items-center justify-center"><ArrowLeft size={22} style={{ color: NAVY }} /></button>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: ACCENT_LIGHT_BG[module.id] || '#F5F7FA' }}>{getModuleIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold" style={{ color: NAVY }}>{module.name}</p>
          {module.description && <p className="text-[11px] text-gray-500 truncate">{module.description}</p>}
        </div>
        <button onClick={() => setShowSearch(!showSearch)} className="w-9 h-9 flex items-center justify-center"><Search size={18} color={NAVY} /></button>
      </header>

      {/* Search */}
      {showSearch && (
        <div className="px-4 py-2"><input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Tìm kiếm..." autoFocus className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 outline-none focus:border-blue-500" /></div>
      )}

      {/* Period filter */}
      <div className="px-4 py-2 flex items-center gap-1.5">
        <button onClick={() => navigate(-1)} className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><ChevronLeft size={16} /></button>
        {periods.map(p => (
          <button key={p} onClick={() => setPeriod(p)} className="flex-1 py-2 rounded-full text-[11px] font-semibold text-center"
            style={{ backgroundColor: period === p ? accentColor : '#fff', color: period === p ? '#fff' : '#1A1A1A', border: period === p ? 'none' : '1px solid #E5E7EB' }}>
            {{ week: 'Tuần', month: 'Tháng', year: 'Năm', all: 'Tất cả' }[p]}
          </button>
        ))}
        <button onClick={() => navigate(1)} className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><ChevronRight size={16} /></button>
      </div>

      {/* Summary */}
      <div className="px-4 py-2 flex gap-3">
        <div className="flex-1 border border-gray-200 rounded-xl p-2.5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><TrendingDown size={14} className="text-red-500" /></div>
          <div><p className="text-[10px] text-gray-500">Chi</p><p className="text-xs font-bold text-red-600">{fmtCompact(totalExpense)}₫</p></div>
        </div>
        <div className="flex-1 border border-gray-200 rounded-xl p-2.5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center"><TrendingUp size={14} className="text-green-500" /></div>
          <div><p className="text-[10px] text-gray-500">Thu</p><p className="text-xs font-bold text-green-600">{fmtCompact(totalIncome)}₫</p></div>
        </div>
      </div>

      {/* Rental due date config (only for mod_nhatro) */}
      {isRental && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
            <Calendar size={16} className="text-green-600" />
            <div className="flex-1">
              <p className="text-xs text-green-800">Ngày đóng tiền: <strong>{dueDay}</strong> hàng tháng</p>
              {(() => { const now = new Date(); let due = new Date(now.getFullYear(), now.getMonth(), dueDay); if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, dueDay); const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000); return daysLeft <= alertDays ? <p className="text-[10px] text-orange-600 mt-0.5">⚠️ Còn {daysLeft} ngày đến hạn!</p> : <p className="text-[10px] text-green-600 mt-0.5">Còn {daysLeft} ngày</p>; })()}
            </div>
            <button onClick={async () => { const res = await showPrompt({ title: 'Ngày đóng tiền', fields: [{ key: 'day', label: 'Ngày (1-31)', numeric: true, initialValue: String(dueDay), required: true }] }); if (res) { const n = Number(res.day); if (n >= 1 && n <= 31) setDueDay(n); } }} className="text-xs text-green-700 font-medium px-2 py-1 rounded bg-green-100">Sửa</button>
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className="flex-1 overflow-auto pb-4">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Package size={32} className="text-gray-200 mb-2" />
            <p className="text-sm">Chưa có giao dịch</p>
          </div>
        ) : (
          grouped.map(([day, txns]) => (
            <div key={day}>
              <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: '#F5F7FA' }}>
                <Calendar size={13} className="text-gray-500" />
                <span className="flex-1 text-[11px] font-semibold text-gray-700">{day.split('-').reverse().join('/')}</span>
                <span className="text-[11px] font-semibold text-red-600">{fmtCompact(txns.filter(t => t.type !== '1').reduce((s, t) => s + t.amount, 0))}₫</span>
              </div>
              {txns.map(t => (
                <button key={t.record.id} onClick={() => openDetail(t.record)} className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50 text-left">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.type === '1' ? 'bg-green-50' : 'bg-red-50'}`}>
                    {t.type === '1' ? <TrendingUp size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: t.type === '1' ? '#20A84A' : '#1A1A1A' }}>{fmtMoney(t.amount)}₫</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Per-module bottom navigation with accent-colored + button */}
      <ModuleBottomNav accentColor={accentColor} moduleId={module.id} />
    </div>
  );
}
