import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { TransactionDetailMobile } from './TransactionDetailMobile';
import { ModuleBottomNav } from './ModuleBottomNav';
import { showPrompt } from './mobileDialog';
import { ArrowLeft, Search, CalendarDays, Bell, Calendar, ChevronUp, ChevronDown, FileText, Home } from 'lucide-react';
import type { DataRecord } from '@/types';

const GREEN = '#16A34A';
const NAVY = '#101B4D';
const BORDER = '#E5E7EB';
const LIGHT_BG = '#F0FDF4';

/**
 * RentalMobile — faithful reproduction of Flutter rental_home_screen.dart.
 * Layout: two info cards (Ngày đóng tiền / Cảnh báo) → Thu gọn/Mở rộng toggle →
 * green table header (THÁNG / NGƯỜI THUÊ / SỐ TIỀN) → expandable rows
 * (Ngày đóng tiền + Ghi chú). Reads existing mod_nhatro records generically by
 * key suffix (title/amount/date/note) — no data model changes.
 * Due day / alert days reuse localStorage keys rental_due_day / rental_alert_days.
 */
export function RentalMobile() {
  const { pop, push } = useMobileNav();
  const { data } = useAppStore();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Config (same localStorage keys as before; app uses SharedPreferences).
  const [dueDay, setDueDay] = useState(() => Number(localStorage.getItem('rental_due_day')) || 29);
  const [alertDays, setAlertDays] = useState(() => Number(localStorage.getItem('rental_alert_days')) || 5);
  useEffect(() => { localStorage.setItem('rental_due_day', String(dueDay)); }, [dueDay]);
  useEffect(() => { localStorage.setItem('rental_alert_days', String(alertDays)); }, [alertDays]);

  const getVal = (r: DataRecord, suffix: string): string => {
    const k = Object.keys(r.values).find(k => k.endsWith(`_${suffix}`));
    return k ? String(r.values[k] ?? '') : '';
  };

  // Rental transactions (all periods — app default is "Tất cả"), newest first.
  const rows = useMemo(() => {
    if (!data) return [];
    return data.records
      .filter(r => !r.isDeleted && (r.moduleId === 'mod_nhatro' || r.linkedModuleId === 'mod_nhatro'))
      .map(r => {
        const title = getVal(r, 'title') || getVal(r, 'tenant_name') || getVal(r, 'room_name') || '—';
        const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount') && !k.endsWith('_total_amount'))
          || Object.keys(r.values).find(k => k.endsWith('_total') || k.endsWith('_rent_amount'));
        const amount = amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0;
        const date = getVal(r, 'date') || r.createdAt?.slice(0, 10) || '';
        const note = getVal(r, 'note');
        return { record: r, title, amount, date, note };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [data]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(t => t.title.toLowerCase().includes(q) || t.note.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  // Next due date + days left (matches app _nextDueDate).
  const { nextDueStr, daysLeft } = useMemo(() => {
    const now = new Date();
    let due = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
    const dl = Math.ceil((due.getTime() - now.getTime()) / 86400000);
    const s = `${String(due.getDate()).padStart(2, '0')}/${String(due.getMonth() + 1).padStart(2, '0')}/${due.getFullYear()}`;
    return { nextDueStr: s, daysLeft: dl };
  }, [dueDay]);

  const nf = (n: number) => n.toLocaleString('vi-VN');
  const fmtMonth = (d: string) => { const p = d.split('-'); return p.length >= 2 ? `${p[1]}/${p[0]}` : d; };
  const fmtDate = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : (d || '—'); };

  const editDueDay = async () => {
    const res = await showPrompt({ title: 'Ngày đóng tiền', fields: [{ key: 'day', label: 'Nhập ngày (1-31)', numeric: true, initialValue: String(dueDay), required: true }] });
    if (res) { const n = Number(res.day); if (n >= 1 && n <= 31) setDueDay(n); }
  };
  const editAlertDays = async () => {
    const res = await showPrompt({ title: 'Cảnh báo trước', fields: [{ key: 'days', label: 'Số ngày cảnh báo trước', numeric: true, initialValue: String(alertDays), required: true }] });
    if (res) { const n = Number(res.days); if (n >= 1 && n <= 30) setAlertDays(n); }
  };

  const openDetail = (record: DataRecord) => push({ id: `rent-detail-${record.id}`, component: <TransactionDetailMobile record={record} /> });

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center gap-2 px-2 py-2 border-b border-gray-100" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <button onClick={pop} className="w-10 h-10 flex items-center justify-center"><ArrowLeft size={22} style={{ color: NAVY }} /></button>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: LIGHT_BG }}><Home size={20} color={GREEN} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold" style={{ color: NAVY }}>Nhà trọ</p>
          <p className="text-[11px] text-gray-500 truncate">Quản lý nhà trọ, thu tiền hàng tháng</p>
        </div>
        <button onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }} className="w-9 h-9 flex items-center justify-center"><Search size={18} color={NAVY} /></button>
      </header>

      {showSearch && (
        <div className="px-4 py-2">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Tìm người thuê, ghi chú..." autoFocus
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 outline-none focus:border-green-500" />
        </div>
      )}

      <div className="flex-1 overflow-auto pb-4">
        {/* Info cards */}
        <div className="px-4 pt-3 flex gap-2.5">
          {/* Ngày đóng tiền */}
          <button onClick={editDueDay} className="flex-1 text-left p-3 rounded-xl bg-white border" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-1.5">
              <CalendarDays size={16} color={GREEN} />
              <span className="text-[11px] text-gray-500">Ngày đóng tiền</span>
            </div>
            <p className="mt-1.5 text-[15px] font-bold" style={{ color: GREEN }}>{nextDueStr}</p>
            <p className="mt-1 text-[10px] text-gray-400">Ngày thu tiền tiếp theo</p>
          </button>
          {/* Cảnh báo */}
          <button onClick={editAlertDays} className="flex-1 text-left p-3 rounded-xl bg-white border" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-1.5">
              <Bell size={16} className="text-orange-500" />
              <span className="text-[11px] text-gray-500">Cảnh báo</span>
            </div>
            <p className="mt-1.5 text-[15px] font-bold" style={{ color: GREEN }}>{alertDays} ngày</p>
            <p className="mt-1 text-[10px] text-gray-400">Cảnh báo trước ngày đóng tiền</p>
          </button>
        </div>

        {/* days-left hint (mirrors app warning color) */}
        <div className="px-4 pt-1.5">
          {daysLeft <= alertDays
            ? <p className="text-[11px] text-orange-600">⚠️ Còn {daysLeft} ngày đến hạn đóng tiền!</p>
            : <p className="text-[11px]" style={{ color: GREEN }}>Còn {daysLeft} ngày đến hạn</p>}
        </div>

        {/* Expand toggle */}
        <div className="px-4 pt-2 flex justify-end">
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1" style={{ color: GREEN }}>
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            <span className="text-[12px] font-medium">{isExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
          </button>
        </div>

        {/* Table */}
        <div className="px-4 pt-1">
          {/* Header bar */}
          <div className="flex items-center px-3 py-2 rounded-t-lg" style={{ backgroundColor: GREEN }}>
            <span className="w-[56px] text-[12px] font-bold text-white">THÁNG</span>
            <span className="flex-1 text-[12px] font-bold text-white">NGƯỜI THUÊ</span>
            <span className="text-[12px] font-bold text-white">SỐ TIỀN</span>
          </div>

          {filtered.length === 0 ? (
            <div className="border rounded-b-lg py-8 flex flex-col items-center" style={{ borderColor: BORDER }}>
              <Home size={40} className="text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Chưa có giao dịch nhà trọ</p>
            </div>
          ) : (
            <div className="border rounded-b-lg overflow-hidden" style={{ borderColor: BORDER }}>
              {filtered.map((t, idx) => (
                <button key={t.record.id} onClick={() => openDetail(t.record)}
                  className={`w-full text-left px-3 py-3 active:bg-gray-50 ${idx > 0 ? 'border-t' : ''}`} style={{ borderColor: `${BORDER}80` }}>
                  <div className="flex items-center">
                    <span className="w-[56px] text-[13px]" style={{ color: NAVY }}>{fmtMonth(t.date)}</span>
                    <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: NAVY }}>{t.title}</span>
                    <span className="text-[13px] font-semibold" style={{ color: NAVY }}>{nf(t.amount)} đ</span>
                    <span className="ml-1">{isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}</span>
                  </div>
                  {isExpanded && (
                    <div className="mt-2.5 flex items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-1"><Calendar size={12} className="text-gray-400" /><span className="text-[11px] text-gray-500">Ngày đóng tiền</span></div>
                        <p className="mt-0.5 text-[13px] font-semibold" style={{ color: NAVY }}>{fmtDate(t.date)}</p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1"><FileText size={12} className="text-gray-400" /><span className="text-[11px] text-gray-500">Ghi chú</span></div>
                        <p className="mt-0.5 text-[13px] font-medium" style={{ color: NAVY }}>{t.note || '—'}</p>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav (shared) with green accent + FAB adds a rental transaction */}
      <ModuleBottomNav accentColor={GREEN} moduleId="mod_nhatro" />
    </div>
  );
}
