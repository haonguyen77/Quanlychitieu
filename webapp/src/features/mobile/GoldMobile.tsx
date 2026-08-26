import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { TransactionDetailMobile } from './TransactionDetailMobile';
import { ModuleBottomNav } from './ModuleBottomNav';
import { ArrowLeft, Search, X, SlidersHorizontal, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Gem, TrendingUp, Tag, ShoppingCart, Star } from 'lucide-react';
import type { DataRecord } from '@/types';

type FilterPeriod = 'month' | 'year' | 'all';

// Colors (match Flutter gold_home_screen)
const GOLD = '#F59E0B';
const DARK_GOLD = '#D97706';
const NAVY = '#101B4D';
const GREEN = '#16A34A';
const RED = '#EF4444';
const BORDER = '#E5E7EB';
const LIGHT_BG = '#FFFBEB';

/**
 * GoldMobile — faithful reproduction of Flutter gold_home_screen.dart.
 * 5 stat cards (Tổng số chỉ / Đã bán / Hiện tại / Đã mua gần nhất / Giá vốn TB),
 * expand toggle, gold-colored table header (NGÀY/LOẠI VÀNG/LOẠI GD/SỐ TIỀN),
 * Mua/Bán chips, expandable row2 (Ghi chú/Người nhận/Số chỉ/Giá/chỉ).
 */
export function GoldMobile() {
  const { pop, push } = useMobileNav();
  const { data } = useAppStore();
  const [period, setPeriod] = useState<FilterPeriod>('all');
  const [refDate, setRefDate] = useState(new Date());
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(true);

  const { startDate, endDate } = useMemo(() => {
    const ref = refDate;
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    switch (period) {
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
        if (r.moduleId !== 'mod_vang' && r.linkedModuleId !== 'mod_vang') return false;
        const dk = Object.keys(r.values).find(k => k.endsWith('_date'));
        const d = dk ? String(r.values[dk] ?? '') : '';
        if (d && (d < startDate || d > endDate)) return false;
        return true;
      })
      .map(r => {
        const get = (s: string) => { const k = Object.keys(r.values).find(k => k.endsWith(`_${s}`)); return k ? String(r.values[k] ?? '') : ''; };
        const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount') && !k.endsWith('_total_amount'));
        const type = get('type');
        return {
          record: r,
          title: get('title') || 'DOJI',
          amount: amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0,
          isBuy: type !== '1', // Chi (0) = Mua; Thu (1) = Bán
          qty: Number(get('quantity')) || 0,
          note: get('note'),
          beneficiary: get('beneficiary'),
          date: get('date') || r.createdAt?.slice(0, 10) || '',
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, startDate, endDate]);

  const displayed = useMemo(() => {
    if (!query.trim()) return txns;
    const q = query.toLowerCase();
    return txns.filter(t => t.title.toLowerCase().includes(q) || t.note.toLowerCase().includes(q));
  }, [txns, query]);

  // Stats
  const buys = txns.filter(t => t.isBuy);
  const sells = txns.filter(t => !t.isBuy);
  const totalBought = buys.reduce((s, t) => s + t.qty, 0);
  const totalSold = sells.reduce((s, t) => s + t.qty, 0);
  const currentChi = totalBought - totalSold;
  const lastPurchase = buys.length ? [...buys].sort((a, b) => b.date.localeCompare(a.date))[0] : null;
  const avgCost = (() => {
    if (currentChi <= 0) return 0;
    const boughtAmt = buys.reduce((s, t) => s + t.amount, 0);
    const soldAmt = sells.reduce((s, t) => s + t.amount, 0);
    return (boughtAmt - soldAmt) / currentChi;
  })();

  const nf = (n: number) => Math.round(n).toLocaleString('vi-VN');
  const navigate = (dir: number) => { const d = new Date(refDate); if (period === 'month') d.setMonth(d.getMonth() + dir); else if (period === 'year') d.setFullYear(d.getFullYear() + dir); setRefDate(d); };
  const openDetail = (record: DataRecord) => push({ id: `detail-${record.id}`, component: <TransactionDetailMobile record={record} /> });

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center gap-1 px-1 py-2">
        <button onClick={pop} className="w-10 h-10 flex items-center justify-center"><ArrowLeft size={22} style={{ color: NAVY }} /></button>
        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: LIGHT_BG }}><Gem size={22} color={GOLD} /></div>
        <div className="flex-1 min-w-0 ml-1">
          <p className="text-[18px] font-bold" style={{ color: NAVY }}>Vàng</p>
          <p className="text-[11px] text-gray-500">Quản lý mua bán và tồn vàng</p>
        </div>
        <button onClick={() => { setShowSearch(s => !s); if (showSearch) { setQuery(''); } }} className="w-10 h-10 flex items-center justify-center">{showSearch ? <X size={20} color={NAVY} /> : <Search size={20} color={NAVY} />}</button>
        <button onClick={() => setShowFilter(f => !f)} className="w-10 h-10 flex items-center justify-center"><SlidersHorizontal size={20} color={showFilter ? GOLD : NAVY} /></button>
      </header>

      <div className="flex-1 overflow-auto">
        {/* Search */}
        {showSearch && (
          <div className="px-4 pb-2">
            <input value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder="Tìm theo loại vàng hoặc ghi chú..."
              className="w-full px-3.5 py-2.5 rounded-[10px] border text-sm outline-none" style={{ borderColor: BORDER, backgroundColor: LIGHT_BG }} />
          </div>
        )}

        {/* Period filter */}
        {showFilter && (
          <div className="px-3 pt-1 flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0" style={{ borderColor: BORDER }}><ChevronLeft size={18} color={NAVY} /></button>
            {(['month', 'year', 'all'] as FilterPeriod[]).map(p => (
              <button key={p} onClick={() => { setPeriod(p); setRefDate(new Date()); }} className="flex-1 mx-0.5 py-2 rounded-full text-[13px] font-semibold text-center"
                style={{ backgroundColor: period === p ? GOLD : '#fff', color: period === p ? '#fff' : NAVY, border: period === p ? `1px solid ${GOLD}` : `1px solid ${BORDER}` }}>
                {{ month: 'Tháng', year: 'Năm', all: 'Tất cả' }[p]}
              </button>
            ))}
            <button onClick={() => navigate(1)} className="w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0" style={{ borderColor: BORDER }}><ChevronRight size={18} color={NAVY} /></button>
          </div>
        )}

        {/* Stats */}
        <div className="px-4 pt-3">
          <div className="flex gap-2">
            <StatCard label="TỔNG SỐ (CHỈ)" value={`${totalBought.toFixed(0)} chỉ`} subtitle="Tổng đã mua trừ bán" icon={<TrendingUp size={18} color={GOLD} />} />
            <StatCard label="ĐÃ BÁN" value={`${totalSold.toFixed(0)} chỉ`} subtitle="Tổng đã bán" icon={<Tag size={18} color={RED} />} />
            <StatCard label="HIỆN TẠI" value={`${currentChi.toFixed(0)} chỉ`} subtitle="Số lượng còn lại" icon={<Gem size={18} color={GREEN} />} />
          </div>
          <div className="flex gap-2 mt-2">
            <StatCardLarge label="ĐÃ MUA GẦN NHẤT" value={lastPurchase ? `${lastPurchase.qty} chỉ` : '--'}
              line2={lastPurchase && lastPurchase.qty > 0 ? `${nf(lastPurchase.amount / lastPurchase.qty)} đ/chỉ` : ''}
              line3={lastPurchase ? lastPurchase.date.split('-').reverse().join('/') : ''} icon={<ShoppingCart size={20} color={DARK_GOLD} />} />
            <StatCardLarge label="GIÁ VỐN TRUNG BÌNH" value={`${nf(avgCost)} đ/chỉ`} line2="Trung bình giá mua/chỉ" line3="" icon={<Star size={20} color={GOLD} />} />
          </div>
        </div>

        {/* Expand toggle */}
        <div className="px-4 pt-2 flex justify-end">
          <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-[12px] font-medium" style={{ color: GOLD }}>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            {expanded ? 'Thu gọn' : 'Mở rộng'}
          </button>
        </div>

        {/* Table header */}
        <div className="mx-4 mt-1 px-2 py-2 flex items-center" style={{ backgroundColor: GOLD, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
          <span className="text-[11px] font-bold text-white" style={{ width: 70 }}>NGÀY</span>
          <span className="text-[11px] font-bold text-white flex-[3]">LOẠI VÀNG</span>
          <span className="text-[11px] font-bold text-white text-center" style={{ width: 50 }}>LOẠI GD</span>
          <span className="text-[11px] font-bold text-white text-right flex-[3]">SỐ TIỀN</span>
        </div>

        {/* Rows */}
        <div className="mx-4 mb-4 border rounded-b-lg" style={{ borderColor: BORDER }}>
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-gray-400">
              <Gem size={40} className="text-gray-200 mb-2" />
              <p className="text-sm">Chưa có giao dịch vàng</p>
            </div>
          ) : displayed.map(t => {
            const pricePerChi = t.qty > 0 ? t.amount / t.qty : 0;
            const typeColor = t.isBuy ? GOLD : RED;
            return (
              <button key={t.record.id} onClick={() => openDetail(t.record)} className="w-full text-left px-2 py-2.5" style={{ borderBottom: `1px solid ${BORDER}80` }}>
                <div className="flex items-center">
                  <span className="text-[12px]" style={{ width: 70, color: NAVY }}>{t.date.split('-').reverse().join('/')}</span>
                  <span className="text-[12px] font-semibold flex-[3] truncate" style={{ color: NAVY }}>{t.title}</span>
                  <span className="flex items-center justify-center" style={{ width: 50 }}>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: `${typeColor}1a`, color: typeColor, border: `1px solid ${typeColor}66` }}>{t.isBuy ? 'Mua' : 'Bán'}</span>
                  </span>
                  <span className="text-[12px] font-semibold text-right flex-[3]" style={{ color: NAVY }}>{nf(t.amount)} đ</span>
                </div>
                {expanded && (
                  <div className="flex items-start mt-1">
                    <div style={{ width: 70 }}><p className="text-[8px] text-gray-400">GHI CHÚ</p><p className="text-[11px] text-gray-700 truncate">{t.note || '—'}</p></div>
                    <div className="flex-[3]"><p className="text-[8px] text-gray-400">NGƯỜI NHẬN</p><p className="text-[11px] text-gray-700">{t.beneficiary || '—'}</p></div>
                    <div className="text-center" style={{ width: 50 }}><p className="text-[8px] text-gray-400">SỐ CHỈ</p><p className="text-[11px]" style={{ color: NAVY }}>{t.qty} chỉ</p></div>
                    <div className="flex-[3] text-right"><p className="text-[8px] text-gray-400">GIÁ/CHỈ</p><p className="text-[11px]" style={{ color: NAVY }}>{nf(pricePerChi)} đ</p></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ModuleBottomNav accentColor={GOLD} moduleId="mod_vang" />
    </div>
  );
}

function StatCard({ label, value, subtitle, icon }: { label: string; value: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="flex-1 rounded-[10px] border p-2.5" style={{ borderColor: BORDER }}>
      <p className="text-[9px] font-semibold text-gray-500">{label}</p>
      <div className="flex items-center gap-1.5 mt-1.5">{icon}<span className="text-[14px] font-bold truncate" style={{ color: NAVY }}>{value}</span></div>
      <p className="text-[9px] text-gray-400 mt-1 truncate">{subtitle}</p>
    </div>
  );
}

function StatCardLarge({ label, value, line2, line3, icon }: { label: string; value: string; line2: string; line3: string; icon: React.ReactNode }) {
  return (
    <div className="flex-1 rounded-[10px] border p-3" style={{ borderColor: BORDER }}>
      <p className="text-[9px] font-semibold text-gray-500">{label}</p>
      <div className="flex items-center gap-2 mt-2">{icon}<span className="text-[14px] font-bold truncate" style={{ color: NAVY }}>{value}</span></div>
      {line2 && <p className="text-[10px] text-gray-500 mt-1">{line2}</p>}
      {line3 && <p className="text-[10px] text-gray-400 mt-0.5">{line3}</p>}
    </div>
  );
}
