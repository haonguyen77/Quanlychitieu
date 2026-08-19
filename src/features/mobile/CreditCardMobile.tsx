import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { useMobileNav } from './MobileNavigation';
import { ArrowLeft, CreditCard, AlertCircle, TrendingDown, Wallet, X } from 'lucide-react';
import { getRecordField, formatMoney } from './mobileDataMapper';

/**
 * CreditCardMobile — Matches Android credit_card_screen.dart.
 * 
 * KEY DATA INSIGHT: In Android, credit card transactions are regular transactions
 * stored in the main transactions table with account_id = 'acc_cc_{cardId}'.
 * In Web's finance.json, they're stored as regular mod_chitieu records where
 * the account field matches a credit card account.
 * 
 * type=0 (expense) → adds to debt
 * type=2 (payment) → reduces debt
 * 
 * Layout: Hero card (gradient) → Stats → Transaction list
 */
export function CreditCardMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const { addRecord } = useRecordStore();
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  // Find credit card accounts (Android uses icon='card' or id starts with 'acc_cc_')
  const cardAccounts = useMemo(() => {
    if (!data) return [];
    return data.accounts?.filter(a => a.isActive && (a.icon === 'card' || a.id.startsWith('acc_cc_'))) || [];
  }, [data]);

  // Find all transactions using credit card accounts
  const transactions = useMemo(() => {
    if (!data || cardAccounts.length === 0) return [];
    const cardAccountIds = new Set(cardAccounts.map(a => a.id));
    return data.records
      .filter(r => {
        if (r.isDeleted) return false;
        const account = getRecordField(r, 'account');
        return cardAccountIds.has(account);
      })
      .map(r => ({
        id: r.id,
        title: getRecordField(r, 'title') || '—',
        amount: Math.abs(Number(getRecordField(r, 'amount')) || 0),
        type: getRecordField(r, 'type'), // 0=expense, 1=income, 2=payment
        date: getRecordField(r, 'date'),
        account: getRecordField(r, 'account'),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, cardAccounts]);

  // Calculate outstanding (Android: SUM(type=0) - SUM(type=2))
  const totalSpent = transactions.filter(t => t.type === '0').reduce((s, t) => s + t.amount, 0);
  const totalPaid = transactions.filter(t => t.type === '2').reduce((s, t) => s + t.amount, 0);
  const outstanding = totalSpent - totalPaid;

  // Card info
  const cardName = cardAccounts.length > 0 ? cardAccounts[0].name : 'Thẻ tín dụng';

  const fmtDate = (d: string) => d ? d.split('-').reverse().join('/') : '';

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-gray-100"><ArrowLeft size={20} /></button>
        <CreditCard size={20} color="#6C2BD9" />
        <div className="flex-1">
          <h2 className="text-base font-bold" style={{ color: '#101B4D' }}>Thẻ tín dụng</h2>
          <p className="text-[10px] text-gray-500">Quản lý thẻ tín dụng, trả góp</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Hero Card — Android gradient #1A237E → #3949AB */}
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #1A237E, #3949AB)' }}>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={20} />
            <span className="text-sm font-medium">{cardName}</span>
          </div>
          <p className="text-[10px] text-white/60">Dư nợ hiện tại</p>
          <p className="text-2xl font-bold mt-1">{formatMoney(Math.max(0, outstanding))}</p>
          <div className="flex justify-between mt-4 text-xs">
            <div><p className="text-white/60">Tổng chi</p><p className="font-medium">{formatMoney(totalSpent)}</p></div>
            <div><p className="text-white/60">Đã thanh toán</p><p className="font-medium">{formatMoney(totalPaid)}</p></div>
          </div>
        </div>

        {/* Stats (Android: 4 stat boxes) */}
        {outstanding > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-xl">
            <AlertCircle size={16} className="text-orange-500" />
            <span className="text-xs text-orange-700">Còn nợ {formatMoney(outstanding)} chưa thanh toán</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <StatBox icon={<TrendingDown size={14} />} color="#EF4444" label="Đã sử dụng" value={`-${formatMoney(totalSpent)}`} />
          <StatBox icon={<Wallet size={14} />} color="#16A34A" label="Đã trả" value={formatMoney(totalPaid)} />
        </div>

        {/* Payment button — Android: "Thanh toán thẻ" */}
        {cardAccounts.length > 0 && (
          <button onClick={() => setShowPayment(true)} className="w-full py-2.5 rounded-xl border border-green-300 text-sm font-medium text-green-700 active:bg-green-50">
            Thanh toán thẻ
          </button>
        )}

        {/* Transactions — Android: grouped by day with titles and amounts */}
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: '#101B4D' }}>Giao dịch ({transactions.length})</h3>
          {transactions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Chưa có giao dịch thẻ tín dụng</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${t.type === '2' ? 'bg-green-50' : 'bg-red-50'}`}>
                    <CreditCard size={15} className={t.type === '2' ? 'text-green-600' : 'text-red-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: '#101B4D' }}>{t.title}</p>
                    <p className="text-[10px] text-gray-400">{fmtDate(t.date)}</p>
                  </div>
                  <span className={`text-xs font-bold ${t.type === '2' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === '2' ? '+' : '-'}{formatMoney(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {cardAccounts.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <CreditCard size={40} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm">Chưa có thẻ tín dụng</p>
            <p className="text-xs mt-1">Thêm tài khoản loại "card" trong Cài đặt → Phương thức thanh toán</p>
          </div>
        )}
      </div>

      {/* Payment Modal — Android: addPayment creates type=2 transaction */}
      {showPayment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setShowPayment(false)}>
          <div className="relative bg-white rounded-2xl p-5 mx-6 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h3 className="text-sm font-semibold">Thanh toán thẻ</h3><button onClick={() => setShowPayment(false)}><X size={18} color="#666" /></button></div>
            <input type="text" inputMode="numeric" value={payAmount} onChange={e => setPayAmount(e.target.value.replace(/\D/g, ''))} placeholder="Số tiền thanh toán" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <button onClick={() => {
              const amt = Number(payAmount) || 0;
              if (amt <= 0) return;
              // Create type=2 payment transaction with the credit card account
              const ccAccountId = cardAccounts[0]?.id || '';
              addRecord('mod_chitieu', {
                mod_chitieu_title: 'Thanh toán thẻ',
                mod_chitieu_amount: amt,
                mod_chitieu_type: '2',
                mod_chitieu_date: payDate,
                mod_chitieu_account: ccAccountId,
              });
              setShowPayment(false); setPayAmount('');
            }} className="w-full py-3 rounded-lg bg-green-600 text-white text-sm font-semibold">Thanh toán</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <span className="text-[10px] text-gray-500">{label}</span>
      </div>
      <p className="text-sm font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
