import { useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { ArrowLeft, CreditCard, Calendar, AlertCircle } from 'lucide-react';
import { getRecordField, formatMoney } from './mobileDataMapper';

/**
 * CreditCardMobile — Shows credit card transactions, outstanding, payments.
 * Reuses existing data.records where moduleId === 'mod_creditcard'.
 */
export function CreditCardMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();

  const records = useMemo(() => {
    if (!data) return [];
    return data.records
      .filter(r => !r.isDeleted && (r.moduleId === 'mod_creditcard' || r.linkedModuleId === 'mod_creditcard'))
      .map(r => ({
        id: r.id,
        title: getRecordField(r, 'title') || '—',
        amount: Math.abs(Number(getRecordField(r, 'amount')) || 0),
        type: getRecordField(r, 'type'),
        date: getRecordField(r, 'date'),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  const totalSpent = records.filter(r => r.type === '0').reduce((s, r) => s + r.amount, 0);
  const totalPaid = records.filter(r => r.type === '2').reduce((s, r) => s + r.amount, 0);
  const outstanding = totalSpent - totalPaid;

  // Find card info from module or account
  const cardModule = data?.modules.find(m => m.id === 'mod_creditcard');
  const cardAccount = data?.accounts?.find(a => a.icon === 'card');

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-gray-100"><ArrowLeft size={20} /></button>
        <h2 className="flex-1 text-base font-bold">Thẻ tín dụng</h2>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Card info */}
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #1A237E, #3949AB)' }}>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={20} />
            <span className="text-sm font-medium">{cardAccount?.name || cardModule?.name || 'Thẻ tín dụng'}</span>
          </div>
          <p className="text-[10px] text-white/60">Dư nợ hiện tại</p>
          <p className="text-2xl font-bold mt-1">{formatMoney(outstanding)}</p>
          <div className="flex justify-between mt-4 text-xs">
            <div><p className="text-white/60">Tổng chi</p><p className="font-medium">{formatMoney(totalSpent)}</p></div>
            <div><p className="text-white/60">Đã thanh toán</p><p className="font-medium">{formatMoney(totalPaid)}</p></div>
          </div>
        </div>

        {outstanding > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-xl">
            <AlertCircle size={16} className="text-orange-500" />
            <span className="text-xs text-orange-700">Còn nợ {formatMoney(outstanding)} chưa thanh toán</span>
          </div>
        )}

        {/* Transactions */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Giao dịch ({records.length})</h3>
          {records.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Chưa có giao dịch thẻ tín dụng</p>
          ) : (
            <div className="space-y-2">
              {records.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.type === '2' ? 'bg-green-50' : 'bg-red-50'}`}>
                    {r.type === '2' ? <CreditCard size={14} className="text-green-600" /> : <CreditCard size={14} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{r.title}</p>
                    <p className="text-[10px] text-gray-400">{r.date.split('-').reverse().join('/')}</p>
                  </div>
                  <span className={`text-xs font-semibold ${r.type === '2' ? 'text-green-600' : 'text-red-500'}`}>
                    {r.type === '2' ? '+' : '-'}{formatMoney(r.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
