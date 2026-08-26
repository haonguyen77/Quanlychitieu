import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';
import { TimeFilter } from '@/shared/components/ui/TimeFilter';
import type { DatePreset } from '@/core/store/recordStore';
import type { DataRecord, RecordValue } from '@/types';

interface CreditCardViewProps {
  onEditRecord?: (record: DataRecord) => void;
  onAddRecord?: (defaultAccount?: string) => void;
  onAddCard?: () => void;
  onEditCard?: (record: DataRecord) => void;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getYearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreditCardView({ onEditRecord, onAddRecord, onAddCard, onEditCard }: CreditCardViewProps) {
  const { data } = useAppStore();
  const { deleteRecord } = useRecordStore();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showManageCards, setShowManageCards] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [ccPreset, setCcPreset] = useState<DatePreset>('month');
  const [ccDateFrom, setCcDateFrom] = useState(getMonthStart());
  const [ccDateTo, setCcDateTo] = useState(getToday());

  const handlePresetChange = (preset: DatePreset) => {
    setCcPreset(preset);
    if (preset === 'week') { setCcDateFrom(getWeekStart()); setCcDateTo(getToday()); }
    else if (preset === 'month') { setCcDateFrom(getMonthStart()); setCcDateTo(getToday()); }
    else if (preset === 'year') { setCcDateFrom(getYearStart()); setCcDateTo(getToday()); }
    else if (preset === 'all') { setCcDateFrom(''); setCcDateTo(''); }
  };

  const handleDateRangeChange = (from: string, to: string) => {
    setCcDateFrom(from); setCcDateTo(to); setCcPreset('custom');
  };

  // Parse card records
  const cards = useMemo(() => {
    if (!data) return [];
    return data.records
      .filter((r) => r.moduleId === 'mod_creditcard' && !r.isDeleted)
      .map((r) => {
        const getVal = (fn: string): RecordValue => {
          const k = Object.keys(r.values).find((x) => x.endsWith('_' + fn));
          return k ? r.values[k] : null;
        };
        return {
          id: r.id,
          name: String(getVal('card_name') ?? 'The'),
          bank: String(getVal('bank_name') ?? ''),
          last4: String(getVal('last4') ?? ''),
          limit: Number(getVal('credit_limit') ?? 0),
          statementDay: Number(getVal('statement_day') ?? 20),
          paymentDay: Number(getVal('payment_due_day') ?? 10),
          isInstallment: String(getVal('is_installment') ?? '0') === '1',
          installmentMonths: Number(getVal('installment_months') ?? 0),
          installmentAmount: Number(getVal('installment_amount') ?? 0),
          installmentRemaining: Number(getVal('installment_remaining') ?? 0),
        };
      });
  }, [data]);

  // Total spent per card (debt = expenses - payments)
  // App logic: type=0 adds to debt, type=2 reduces debt (payment), type=1 is income (ignored)
  const cardSpent = useMemo(() => {
    if (!data) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const r of data.records) {
      if (r.isDeleted || r.moduleId !== 'mod_chitieu') continue;
      const accKey = Object.keys(r.values).find((k) => k.endsWith('_account'));
      if (!accKey) continue;
      const accVal = String(r.values[accKey] ?? '');
      if (!accVal.startsWith('credit_card_')) continue;
      const cardId = accVal.replace('credit_card_', '');
      const amtKey = Object.keys(r.values).find((k) => k.endsWith('_amount'));
      const amount = amtKey ? Number(r.values[amtKey] ?? 0) : 0;
      const typeKey = Object.keys(r.values).find((k) => k.endsWith('_type'));
      const typeVal = typeKey ? String(r.values[typeKey] ?? '0') : '0';
      // type='0' = expense (adds to debt), type='2' = card payment (reduces debt)
      if (typeVal === '2') {
        map.set(cardId, (map.get(cardId) ?? 0) - amount);
      } else if (typeVal === '0') {
        map.set(cardId, (map.get(cardId) ?? 0) + amount);
      }
      // type='1' (income) is NOT related to card debt
    }
    return map;
  }, [data]);

  // Aggregate stats FOR SELECTED CARD
  const activeCard = selectedCardId ? cards.find((c) => c.id === selectedCardId) : null;
  const activeCardId = activeCard?.id ?? (cards.length > 0 ? cards[0].id : undefined);

  const activeSpent = cardSpent.get(activeCardId ?? '') ?? 0;
  const activeLimit = activeCard?.limit ?? cards[0]?.limit ?? 0;
  const activeRemaining = activeLimit - activeSpent;
  const usagePercent = activeLimit > 0 ? ((activeSpent / activeLimit) * 100).toFixed(2) : '0';
  const remainPercent = activeLimit > 0 ? ((activeRemaining / activeLimit) * 100).toFixed(2) : '0';

  // Payment due date for selected card
  const paymentDueDate = useMemo(() => {
    const card = activeCard ?? cards[0];
    if (!card) return null;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const dueDay = card.paymentDay;
    let dueDate = new Date(currentYear, currentMonth, dueDay);
    if (dueDate < now) {
      dueDate = new Date(currentYear, currentMonth + 1, dueDay);
    }
    return dueDate;
  }, [activeCard, cards]);

  const daysUntilPayment = paymentDueDate
    ? Math.ceil((paymentDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  // Transactions for active card (or all cards)
  const transactions = useMemo(() => {
    if (!data) return [];
    return data.records.filter((r) => {
      if (r.isDeleted || r.moduleId !== 'mod_chitieu') return false;
      const accKey = Object.keys(r.values).find((k) => k.endsWith('_account'));
      if (!accKey) return false;
      const accVal = String(r.values[accKey] ?? '');
      if (!accVal.startsWith('credit_card_')) return false;
      if (activeCardId && accVal !== `credit_card_${activeCardId}`) return false;
      // Date filter
      if (ccDateFrom || ccDateTo) {
        const dateKey = Object.keys(r.values).find((k) => k.endsWith('_date'));
        if (dateKey && r.values[dateKey]) {
          const d = String(r.values[dateKey]);
          if (ccDateFrom && d < ccDateFrom) return false;
          if (ccDateTo && d > ccDateTo) return false;
        }
      }
      return true;
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [data, activeCardId, ccDateFrom, ccDateTo]);

  // Category map
  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; icon?: string; color?: string }>();
    const chiTieu = data?.modules.find((m) => m.id === 'mod_chitieu');
    chiTieu?.categories?.forEach((c) => map.set(c.id, { name: c.name, icon: c.icon, color: c.color }));
    return map;
  }, [data]);

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-secondary)]">
        <div className="text-center">
          <Icon name="credit-card" size={48} className="mx-auto mb-3 opacity-30" />
          <p>Chua co the tin dung</p>
          <p className="text-sm mt-1">Chuyen sang tab "Quan ly the" de them the moi</p>
        </div>
      </div>
    );
  }

  const fmt = (n: number) => n.toLocaleString('vi-VN');

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Stats Cards */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          {/* Total Limit */}
          <div className="flex items-center gap-3 px-4 py-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <Icon name="credit-card" size={18} color="#3B82F6" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-secondary)]">Tong han muc</p>
              <p className="text-lg font-bold text-[var(--color-text)]">{fmt(activeLimit)} <span className="text-xs font-normal text-[var(--color-text-secondary)]">VND</span></p>
            </div>
          </div>

          {/* Used */}
          <div className="flex items-center gap-3 px-4 py-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
              <Icon name="trending-up" size={18} color="#F97316" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-secondary)]">Da su dung</p>
              <p className="text-lg font-bold text-[var(--color-text)]">{fmt(activeSpent)} <span className="text-xs font-normal text-[var(--color-text-secondary)]">VND</span></p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-orange-500 font-medium">({usagePercent}%)</span>
                <Icon name="trending-up" size={12} color="#F97316" />
              </div>
            </div>
          </div>

          {/* Remaining */}
          <div className="flex items-center gap-3 px-4 py-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
              <Icon name="wallet" size={18} color="#22C55E" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-secondary)]">Con lai</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{fmt(activeRemaining)} <span className="text-xs font-normal text-[var(--color-text-secondary)]">VND</span></p>
              <span className="text-xs text-green-500 font-medium">({remainPercent}%)</span>
            </div>
          </div>

          {/* Payment Due */}
          <div className="flex items-center gap-3 px-4 py-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <Icon name="calendar" size={18} color="#EF4444" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-secondary)]">Den han thanh toan</p>
              <p className="text-lg font-bold text-[var(--color-text)]">
                {paymentDueDate ? paymentDueDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '---'}
              </p>
              {daysUntilPayment > 0 && (
                <span className="text-xs text-[var(--color-text-secondary)]">Con {daysUntilPayment} ngay</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* My Cards Section */}
      <div className="px-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">The cua toi ({cards.length})</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPayment(!showPayment)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 border border-green-500 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
            >
              <Icon name="credit-card" size={12} />
              Thanh toán thẻ
            </button>
            <button
              onClick={() => setShowManageCards(!showManageCards)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
            >
              <Icon name="settings" size={12} />
              Quan ly the
            </button>
          </div>
        </div>

        {/* Payment Panel — matches App's CreditCardPaymentScreen */}
        {showPayment && (
          <div className="mb-4 border border-green-200 rounded-xl p-4 bg-green-50/50 dark:bg-green-900/10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-green-800">Thanh toán thẻ tín dụng</h4>
              <button onClick={() => setShowPayment(false)} className="text-gray-400 hover:text-gray-600">
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {/* Card selection */}
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Thẻ cần thanh toán</label>
                <select
                  className="w-full h-8 px-2 text-sm border border-gray-300 rounded-lg focus:border-green-500 outline-none"
                  value={activeCardId ?? ''}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` (*${c.last4})` : ''} — Nợ: {fmt(cardSpent.get(c.id) ?? 0)}đ</option>
                  ))}
                </select>
              </div>
              {/* Amount */}
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Số tiền thanh toán</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 h-8 px-3 text-sm border border-gray-300 rounded-lg focus:border-green-500 outline-none"
                    placeholder="Nhập số tiền..."
                    value={paymentAmount ? Number(paymentAmount).toLocaleString('vi-VN') : ''}
                    onChange={(e) => setPaymentAmount(e.target.value.replace(/[^\d]/g, ''))}
                  />
                  {(cardSpent.get(activeCardId ?? '') ?? 0) > 0 && (
                    <button onClick={() => setPaymentAmount(String(Math.round(cardSpent.get(activeCardId ?? '') ?? 0)))}
                      className="text-[10px] text-green-700 border border-green-300 px-2 rounded-lg hover:bg-green-100 whitespace-nowrap">
                      TT tối đa
                    </button>
                  )}
                </div>
              </div>
              {/* Source account */}
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Nguồn tiền thanh toán</label>
                <select
                  id="payment-source"
                  className="w-full h-8 px-2 text-sm border border-gray-300 rounded-lg focus:border-green-500 outline-none"
                  defaultValue="cash"
                >
                  {(data?.accounts ?? []).filter((a) => a.isActive && !a.id.startsWith('acc_cc_')).map((a) => (
                    <option key={a.id} value={(() => { switch(a.id) { case 'acc_cash': return 'cash'; case 'acc_bank': return 'bank'; case 'acc_momo': return 'momo'; default: return a.id; } })()}>{a.name}</option>
                  ))}
                </select>
              </div>
              {/* Date */}
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Ngày thanh toán</label>
                <input
                  type="date"
                  id="payment-date"
                  className="w-full h-8 px-2 text-sm border border-gray-300 rounded-lg focus:border-green-500 outline-none"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
              {/* Note */}
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Ghi chú (tên giao dịch)</label>
                <input
                  type="text"
                  id="payment-note"
                  className="w-full h-8 px-3 text-sm border border-gray-300 rounded-lg focus:border-green-500 outline-none"
                  defaultValue={`Thanh toán thẻ ${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`}
                />
              </div>
              {/* Submit */}
              <button
                onClick={() => {
                  const amount = parseInt(paymentAmount || '0', 10);
                  if (!amount || !activeCardId) return;
                  const { addRecord } = useRecordStore.getState();
                  const dateEl = document.getElementById('payment-date') as HTMLInputElement;
                  const noteEl = document.getElementById('payment-note') as HTMLInputElement;
                  const sourceEl = document.getElementById('payment-source') as HTMLSelectElement;
                  addRecord('mod_chitieu', {
                    mod_chitieu_title: noteEl?.value || `Thanh toán thẻ`,
                    mod_chitieu_amount: amount,
                    mod_chitieu_type: '2', // type=2 = card payment (NOT income)
                    mod_chitieu_date: dateEl?.value || new Date().toISOString().slice(0, 10),
                    mod_chitieu_account: `credit_card_${activeCardId}`,
                  });
                  setPaymentAmount('');
                  setShowPayment(false);
                }}
                className="w-full h-9 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Xác nhận thanh toán
              </button>
            </div>
          </div>
        )}

        {/* Manage Cards Panel */}
        {showManageCards && (
          <div className="mb-4 border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-surface)]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-[var(--color-text)]">Quan ly the tin dung</h4>
              <button onClick={() => setShowManageCards(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {cards.map((card) => (
                <div key={card.id} className="flex items-center justify-between p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-500">{card.bank?.toUpperCase().slice(0, 4) || 'CARD'}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{card.name}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">**** {card.last4 || '0000'} · Han muc: {fmt(card.limit)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const record = data?.records.find((r) => r.id === card.id);
                        if (record) onEditCard?.(record);
                      }}
                      className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[var(--color-text-secondary)] hover:text-blue-500"
                      title="Sua the"
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Xoa the "${card.name}"?`)) deleteRecord(card.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-secondary)] hover:text-red-500"
                      title="Xoa the"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {/* Add new card button */}
              <button
                onClick={() => {
                  setShowManageCards(false);
                  onAddCard?.();
                }}
                className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <Icon name="plus" size={14} />
                Them the moi
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {cards.map((card) => {
            const isActive = activeCardId === card.id;
            return (
              <div
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                className={`flex items-center gap-4 px-5 py-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md min-w-[280px] ${
                  isActive ? 'border-[var(--color-primary)] bg-blue-50/50 dark:bg-blue-900/10' : 'border-[var(--color-border)] bg-[var(--color-bg)]'
                }`}
              >
                {/* Card brand icon */}
                <div className="w-12 h-8 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    {card.bank?.toUpperCase().slice(0, 4) || 'VISA'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">{card.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] font-mono">**** **** **** {card.last4 || '0000'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-[var(--color-text-secondary)]">Han muc</p>
                  <p className="text-sm font-bold text-[var(--color-text)]">{fmt(card.limit)}</p>
                  <p className="text-[10px] text-orange-500 mt-0.5">Dang su dung</p>
                </div>
              </div>
            );
          })}
          {/* Add new card button */}
          <div
            className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl border-2 border-dashed border-[var(--color-border)] cursor-pointer hover:border-[var(--color-primary)] hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all duration-200 min-w-[160px]"
            onClick={() => {
              onAddCard?.();
            }}
          >
            <Icon name="plus" size={16} className="text-[var(--color-text-secondary)]" />
            <span className="text-sm text-[var(--color-text-secondary)] font-medium">Them the</span>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Giao dich ({transactions.length})</h3>
          <TimeFilter
            datePreset={ccPreset}
            dateFrom={ccDateFrom}
            dateTo={ccDateTo}
            onPresetChange={handlePresetChange}
            onDateRangeChange={handleDateRangeChange}
            presets={['week', 'month', 'year', 'all']}
          />
        </div>

        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] py-8 text-center">Chua co giao dich nao</p>
        ) : (
          <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white border-r border-white/20">Ngay</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white border-r border-white/20">Ten giao dich</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-white border-r border-white/20">So tien</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white border-r border-white/20">Loai</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white border-r border-white/20">Danh muc</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white border-r border-white/20">Trang thai</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white border-r border-white/20">Ghi chu</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-white">Thao tac</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {transactions.map((r) => {
                  const gv = (fn: string) => { const k = Object.keys(r.values).find((x) => x.endsWith('_' + fn)); return k ? r.values[k] : null; };
                  const title = String(gv('title') ?? '—');
                  const amount = Number(gv('amount') ?? 0);
                  const date = gv('date');
                  const type = gv('type');
                  const note = String(gv('note') ?? '');
                  const catId = r.categoryId && !r.categoryId.startsWith('mod_') ? r.categoryId : undefined;
                  const cat = catId ? categoryMap.get(catId) : undefined;

                  // Determine statement status based on statement day
                  const recordDate = date ? new Date(String(date)) : null;
                  const statementDay = activeCard?.statementDay ?? cards[0]?.statementDay ?? 20;
                  let status = 'Cho sao ke';
                  let statusColor = '#F59E0B';
                  if (recordDate) {
                    const dayOfMonth = recordDate.getDate();
                    if (dayOfMonth <= statementDay) {
                      status = 'Da sao ke';
                      statusColor = '#22C55E';
                    }
                  }
                  // Payment type transactions
                  if (type === '1' || title.toLowerCase().includes('thanh toan') || title.toLowerCase().includes('transfer')) {
                    status = 'Da thanh toan';
                    statusColor = '#3B82F6';
                  }

                  return (
                    <tr key={r.id} className="hover:bg-[var(--color-surface)] group transition-colors">
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                        {date ? new Date(String(date)).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text)] font-medium">{title}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-500 whitespace-nowrap">
                        -{fmt(amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: type === '1' ? '#3B82F615' : '#F4433615', color: type === '1' ? '#3B82F6' : '#F44336' }}>
                          {type === '1' ? 'Thanh toan' : 'Chi tieu'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {cat ? (
                          <span className="inline-flex items-center gap-1 text-xs" style={{ color: cat.color || '#64748b' }}>
                            {cat.icon && <Icon name={cat.icon} size={12} />}
                            {cat.name}
                          </span>
                        ) : <span className="text-xs text-[var(--color-text-secondary)]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium" style={{ color: statusColor }}>{status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] max-w-[140px] truncate">{note || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEditRecord?.(r)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[var(--color-text-secondary)] hover:text-blue-500" title="Sua">
                            <Icon name="edit" size={14} />
                          </button>
                          <button onClick={() => { if (confirm('Xoa giao dich nay?')) deleteRecord(r.id); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-secondary)] hover:text-red-500" title="Xoa">
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
