import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { useMobileNav } from './MobileNavigation';
import { ModuleBottomNav } from './ModuleBottomNav';
import { MobileIcon } from './MobileIcon';
import {
  getRecordField, getCreditCards, resolveCreditCardIdFromAccount,
  getCategoryDisplay, getModuleDisplay, type CreditCardInfo,
} from './mobileDataMapper';
import {
  ArrowLeft, CreditCard, Search, X, SlidersHorizontal, Calendar,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, TrendingDown,
  Wallet, CheckCircle2,
} from 'lucide-react';

type FilterPeriod = 'month' | 'year' | 'all';

// Android _cardColors palette (credit_card_screen.dart)
const CARD_COLORS = ['#1264F5', '#6C2BD9', '#EF4444', '#16A34A', '#D97706', '#0891B2', '#DB2777', '#4F46E5'];
const PURPLE = '#6C2BD9';
const NAVY = '#101B4D';
const GREEN = '#16A34A';
const RED = '#EF4444';

/**
 * CreditCardMobile — Reproduction of Android credit_card_screen.dart.
 *
 * DATA MODEL (from real finance.json):
 * - Cards are records with moduleId "mod_creditcard"; record.id === cardId.
 *   Fields: card_name, bank_name, last4, credit_limit, statement_day, payment_due_day.
 * - A transaction (ANY module) belongs to a card when its `account` value
 *   normalizes (credit_card_<id> | acc_cc_<id>) to that cardId.
 *   → We match by cardId, NOT by moduleId === 'mod_creditcard'.
 * - Debt (Đã sử dụng) = Σ expense(type 0) − Σ payment(type 2) in the active range.
 * - Due date = statementDay-of-month + paymentDueDays days (Android logic).
 */
export function CreditCardMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const { addRecord } = useRecordStore();

  const [period, setPeriod] = useState<FilterPeriod>('month');
  const [refDate, setRefDate] = useState(new Date());
  const [showFilter, setShowFilter] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const cards = useMemo(() => getCreditCards(data), [data]);
  const selectedCard: CreditCardInfo | null =
    cards.find(c => c.id === selectedCardId) || cards[0] || null;

  // Active date range (Android: month/year/all + prev/next)
  const { startDate, endDate } = useMemo(() => {
    const ref = refDate;
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    switch (period) {
      case 'month': return { startDate: fmt(new Date(ref.getFullYear(), ref.getMonth(), 1)), endDate: fmt(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)) };
      case 'year': return { startDate: `${ref.getFullYear()}-01-01`, endDate: `${ref.getFullYear()}-12-31` };
      default: return { startDate: '2020-01-01', endDate: '2099-12-31' };
    }
  }, [period, refDate]);

  const navigate = (dir: number) => {
    const d = new Date(refDate);
    if (period === 'month') d.setMonth(d.getMonth() + dir);
    else if (period === 'year') d.setFullYear(d.getFullYear() + dir);
    setRefDate(d);
  };

  // Transactions linked to the selected card (matched by normalized account → cardId)
  const transactions = useMemo(() => {
    if (!data || !selectedCard) return [];
    return data.records
      .filter(r => {
        if (r.isDeleted || r.moduleId === 'mod_creditcard') return false;
        const cid = resolveCreditCardIdFromAccount(getRecordField(r, 'account'));
        if (!cid || cid !== selectedCard.id) return false;
        const d = getRecordField(r, 'date');
        return d >= startDate && d <= endDate;
      })
      .map(r => ({
        id: r.id,
        title: getRecordField(r, 'title') || '—',
        amount: Math.abs(Number(getRecordField(r, 'amount')) || 0),
        type: getRecordField(r, 'type'),
        note: getRecordField(r, 'note'),
        date: getRecordField(r, 'date'),
        categoryId: r.categoryId || '',
        moduleId: r.linkedModuleId || r.moduleId,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, selectedCard, startDate, endDate]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter(t => t.title.toLowerCase().includes(q) || t.note.toLowerCase().includes(q));
  }, [transactions, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) { if (!map.has(t.date)) map.set(t.date, []); map.get(t.date)!.push(t); }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // Stats (Android: debt = Σexpense − Σpayment over the period, independent of search)
  const debt = transactions.reduce((s, t) => s + (t.type === '2' ? -t.amount : t.amount), 0);
  const limit = selectedCard?.creditLimit || 0;
  const remaining = limit - debt;
  const usagePercent = limit > 0 ? (debt / limit) * 100 : 0;
  const remainPercent = limit > 0 ? (remaining / limit) * 100 : 0;

  const dueInfo = useMemo(() => {
    if (!selectedCard || !selectedCard.statementDay) return null;
    const now = new Date();
    const stmt = new Date(now.getFullYear(), now.getMonth(), selectedCard.statementDay);
    const due = new Date(stmt);
    due.setDate(due.getDate() + selectedCard.paymentDueDays);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
    return { due, daysLeft };
  }, [selectedCard]);

  const nf = (n: number) => Math.round(n).toLocaleString('vi-VN');
  const fmtDate = (d: string) => d ? d.split('-').reverse().join('/') : '';
  const fmtDMY = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const dayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00'); const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    const f = fmtDate(dateStr);
    if (diff === 0) return `Hôm nay, ${f}`;
    if (diff === 1) return `Hôm qua, ${f}`;
    return f;
  };
  const cardColor = (id: string) => CARD_COLORS[Math.max(0, cards.findIndex(c => c.id === id)) % CARD_COLORS.length];

  const submitPayment = () => {
    const amt = Number(payAmount) || 0;
    if (amt <= 0 || !selectedCard) return;
    addRecord('mod_chitieu', {
      mod_chitieu_title: 'Thanh toán thẻ',
      mod_chitieu_amount: amt,
      mod_chitieu_type: '2',
      mod_chitieu_date: payDate,
      mod_chitieu_account: `credit_card_${selectedCard.id}`,
    });
    setShowPayment(false); setPayAmount('');
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* ═══ HEADER ═══ */}
      <header className="flex items-center gap-1 px-2 py-2">
        <button onClick={pop} className="w-10 h-10 flex items-center justify-center rounded-lg active:bg-gray-100"><ArrowLeft size={20} color={NAVY} /></button>
        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: '#F5F3FF' }}><CreditCard size={22} color={PURPLE} /></div>
        <div className="flex-1 min-w-0 ml-1">
          <h2 className="text-[18px] font-bold leading-tight" style={{ color: NAVY }}>Thẻ tín dụng</h2>
          <p className="text-[11px] text-gray-500 truncate">Quản lý thẻ tín dụng, trả góp</p>
        </div>
        <button onClick={() => { setIsSearching(!isSearching); if (isSearching) setSearchQuery(''); }} className="w-10 h-10 flex items-center justify-center rounded-lg active:bg-gray-100">
          {isSearching ? <X size={20} color={NAVY} /> : <Search size={20} color={NAVY} />}
        </button>
        <button onClick={() => setShowFilter(!showFilter)} className="w-10 h-10 flex items-center justify-center rounded-lg active:bg-gray-100">
          <SlidersHorizontal size={20} color={showFilter ? PURPLE : NAVY} />
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {/* ═══ SEARCH ═══ */}
        {isSearching && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] border" style={{ backgroundColor: '#F5F3FF', borderColor: '#E5E7EB' }}>
              <Search size={16} color="#9E9E9E" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Tìm theo tên giao dịch hoặc ghi chú..." autoFocus
                className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400" />
            </div>
          </div>
        )}

        {/* ═══ FILTER (hidden by default) ═══ */}
        {showFilter && (
          <div className="px-3 pb-2 space-y-2">
            <div className="flex items-center gap-1.5">
              <button onClick={() => period !== 'all' && navigate(-1)} className="w-9 h-9 border border-gray-200 rounded-full flex items-center justify-center flex-shrink-0"><ChevronLeft size={18} color={period !== 'all' ? NAVY : '#D1D5DB'} /></button>
              {(['month', 'year', 'all'] as FilterPeriod[]).map(p => (
                <button key={p} onClick={() => { setPeriod(p); setRefDate(new Date()); }} className="flex-1 py-2.5 rounded-full text-[13px] font-semibold text-center"
                  style={{ backgroundColor: period === p ? PURPLE : '#fff', color: period === p ? '#fff' : NAVY, border: period === p ? 'none' : '1px solid #E5E7EB' }}>
                  {{ month: 'Tháng', year: 'Năm', all: 'Tất cả' }[p]}
                </button>
              ))}
              <button onClick={() => period !== 'all' && navigate(1)} className="w-9 h-9 border border-gray-200 rounded-full flex items-center justify-center flex-shrink-0"><ChevronRight size={18} color={period !== 'all' ? NAVY : '#D1D5DB'} /></button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-[11px] text-gray-500 mb-1">Từ ngày</p>
                <div className="h-9 px-3 border border-gray-200 rounded-lg flex items-center gap-2"><Calendar size={13} color="#9E9E9E" /><span className="text-xs font-medium text-gray-700">{startDate.split('-').reverse().join('/')}</span></div>
              </div>
              <span className="text-gray-400 mt-4">-</span>
              <div className="flex-1">
                <p className="text-[11px] text-gray-500 mb-1">Đến ngày</p>
                <div className="h-9 px-3 border border-gray-200 rounded-lg flex items-center gap-2"><Calendar size={13} color="#9E9E9E" /><span className="text-xs font-medium text-gray-700">{endDate.split('-').reverse().join('/')}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CARD CHIPS ═══ */}
        <div className="px-4 pt-1">
          {cards.length === 0 ? (
            <div className="p-5 border border-gray-200 rounded-xl flex flex-col items-center text-gray-400">
              <CreditCard size={32} className="mb-2 text-gray-300" />
              <p className="text-sm">Chưa có thẻ tín dụng</p>
            </div>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {cards.map(card => {
                const isSel = selectedCard?.id === card.id;
                const col = cardColor(card.id);
                return (
                  <button key={card.id} onClick={() => setSelectedCardId(card.id)}
                    className="flex-shrink-0 rounded-xl p-3 text-left" style={{ width: 140, backgroundColor: isSel ? `${col}0A` : '#fff', border: `${isSel ? 2 : 1}px solid ${isSel ? col : '#E5E7EB'}` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[20px] font-bold" style={{ color: col }}>{card.name.length > 2 ? card.name.slice(0, 2).toUpperCase() : card.name.toUpperCase()}</span>
                      <CreditCard size={20} color={col} style={{ opacity: 0.6 }} />
                    </div>
                    <p className="mt-2 text-xs font-medium text-gray-500">{card.last4 ? `**** ${card.last4}` : '**** ****'}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ ACTION BUTTONS ═══ */}
        {cards.length > 0 && (
          <div className="px-4 pt-3 flex items-center justify-center gap-2">
            <button onClick={() => setShowManage(true)} className="px-3 py-1.5 rounded-2xl text-[11px] font-medium" style={{ color: '#B45309', border: '1px solid #F59E0B80' }}>Quản lý thẻ</button>
            <button onClick={() => setShowPayment(true)} className="px-3 py-1.5 rounded-2xl text-[11px] font-medium" style={{ color: GREEN, border: `1px solid ${GREEN}80` }}>Thanh toán thẻ</button>
            <button onClick={() => setShowStats(!showStats)} className="px-2.5 py-1.5 rounded-2xl text-[11px] font-medium flex items-center gap-0.5" style={{ color: PURPLE, border: `1px solid ${PURPLE}80` }}>
              {showStats ? 'Thu gọn' : 'Mở rộng'}{showStats ? <ChevronUp size={16} color={PURPLE} /> : <ChevronDown size={16} color={PURPLE} />}
            </button>
          </div>
        )}

        {/* ═══ STATS (expand) ═══ */}
        {showStats && selectedCard && (
          <div className="px-4 pt-3 grid grid-cols-2 gap-2">
            <StatBox icon={<CreditCard size={14} />} color={PURPLE} label="Tổng hạn mức" value={`${nf(limit)}`} sub="VND" />
            <StatBox icon={<TrendingDown size={14} />} color={RED} label="Đã sử dụng" value={`-${nf(debt)} VND`} sub={`(${usagePercent.toFixed(2)}%)`} valueColor={RED} />
            <StatBox icon={<Wallet size={14} />} color={GREEN} label="Còn lại" value={`${nf(remaining)} VND`} sub={`(${remainPercent.toFixed(2)}%)`} valueColor={GREEN} />
            <StatBox icon={<Calendar size={14} />} color="#1D4ED8" label="Đến hạn thanh toán" value={dueInfo ? fmtDMY(dueInfo.due) : '—'} sub={dueInfo ? `Còn ${dueInfo.daysLeft} ngày` : ''} />
          </div>
        )}

        {/* ═══ TRANSACTION LIST ═══ */}
        <div className="px-4 pt-3 pb-6">
          <div className="flex items-center px-3 py-2 rounded-t-lg text-white text-[11px] font-bold" style={{ backgroundColor: PURPLE }}>
            <span className="flex-1">Tên giao dịch</span>
            <span>Số tiền</span>
          </div>
          {grouped.length === 0 ? (
            <div className="border border-gray-200 rounded-b-lg py-8 flex flex-col items-center text-gray-400">
              <CreditCard size={40} className="mb-2 text-gray-200" />
              <p className="text-sm">Chưa có giao dịch</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-b-lg overflow-hidden">
              {grouped.map(([day, items]) => {
                const dayTotal = items.reduce((s, t) => s + (t.type === '2' ? t.amount : -t.amount), 0);
                return (
                  <div key={day}>
                    <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ backgroundColor: '#FAFAFA' }}>
                      <Calendar size={12} color="#9CA3AF" />
                      <span className="flex-1 text-[11px] font-semibold text-gray-600">{dayLabel(day)}</span>
                      {items.length >= 2 && (
                        <span className="text-[10px] font-semibold" style={{ color: dayTotal >= 0 ? GREEN : RED }}>{dayTotal >= 0 ? '+' : ''}{nf(dayTotal)} VND</span>
                      )}
                    </div>
                    {items.map(t => {
                      const isPayment = t.type === '2';
                      const cat = getCategoryDisplay(t.categoryId, data);
                      const mod = getModuleDisplay(t.moduleId, data);
                      return (
                        <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50">
                          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isPayment ? '#E8F5E9' : cat.bgColor }}>
                            {isPayment ? <CheckCircle2 size={18} color={GREEN} /> : <MobileIcon name={cat.icon} size={18} color={cat.color} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: NAVY }}>{t.title}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <MobileIcon name={mod.icon} size={12} color={mod.color} />
                              <span className="text-[11px]" style={{ color: mod.color }}>{mod.label}</span>
                            </div>
                          </div>
                          <span className="text-sm font-bold flex-shrink-0" style={{ color: isPayment ? GREEN : RED }}>
                            {isPayment ? '+' : '-'}{nf(t.amount)} VND
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ModuleBottomNav accentColor={PURPLE} moduleId="mod_creditcard" />

      {/* ═══ PAYMENT MODAL ═══ */}
      {showPayment && selectedCard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setShowPayment(false)}>
          <div className="relative bg-white rounded-2xl p-5 mx-6 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h3 className="text-sm font-semibold">Thanh toán {selectedCard.name}</h3><button onClick={() => setShowPayment(false)}><X size={18} color="#666" /></button></div>
            <input type="text" inputMode="numeric" value={payAmount} onChange={e => setPayAmount(e.target.value.replace(/\D/g, ''))} placeholder="Số tiền thanh toán" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <button onClick={submitPayment} className="w-full py-3 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: GREEN }}>Thanh toán</button>
          </div>
        </div>
      )}

      {/* ═══ MANAGE CARDS SHEET (read-only details) ═══ */}
      {showManage && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" onClick={() => setShowManage(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-t-2xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">Quản lý thẻ</h3>
              <button onClick={() => setShowManage(false)} className="w-8 h-8 flex items-center justify-center"><X size={20} color="#9E9E9E" /></button>
            </div>
            <div className="overflow-auto p-4 space-y-3">
              {cards.map(c => (
                <div key={c.id} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cardColor(c.id)}1A` }}><CreditCard size={18} color={cardColor(c.id)} /></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: NAVY }}>{c.name} {c.last4 ? `(*${c.last4})` : ''}</p>
                      <p className="text-[11px] text-gray-500">{c.bankName || 'Ngân hàng —'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-gray-600">
                    <div>Hạn mức: <span className="font-medium">{c.creditLimit ? nf(c.creditLimit) : '—'} VND</span></div>
                    <div>Ngày chốt: <span className="font-medium">{c.statementDay || '—'}</span></div>
                    <div>Hạn TT sau chốt: <span className="font-medium">{c.paymentDueDays || '—'} ngày</span></div>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-gray-400 text-center pt-1">Thêm/sửa thẻ được thực hiện trên ứng dụng điện thoại.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ icon, color, label, value, sub, valueColor }: { icon: React.ReactNode; color: string; label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1A` }}><div style={{ color }}>{icon}</div></div>
        <span className="text-[10px] text-gray-500 truncate">{label}</span>
      </div>
      <p className="mt-2 text-sm font-bold truncate" style={{ color: valueColor || NAVY }}>{value}</p>
      {sub && <p className="text-[10px]" style={{ color: valueColor || '#9CA3AF' }}>{sub}</p>}
    </div>
  );
}
